import gsap from 'gsap';
import type { Agent, Arc, Frame, Guide, Trace } from '../swarm/overlay';
import { travel } from './agents';
import { docRect, type Rect } from './dom';
import { glyph, metrics } from './glyphs';
import type { PlanContext } from './plans/context';

interface CharBox {
  char: string;
  x: number;
  top: number;
  height: number;
  size: number;
  weight: number;
  color: string;
}

/** La posición real de cada letra, sin tocar el DOM: incluye kerning y saltos de línea. */
function measureChars(el: Element): CharBox[] {
  const out: CharBox[] = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const text = node.nodeValue ?? '';
    const parent = node.parentElement;
    if (!parent) continue;
    const style = getComputedStyle(parent);
    for (let i = 0; i < text.length; i++) {
      const char = text.charAt(i);
      if (/\s/.test(char)) continue;
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const r = range.getBoundingClientRect();
      if (!r.width) continue;
      out.push({
        char,
        x: r.left + scrollX,
        top: r.top + scrollY,
        height: r.height,
        size: parseFloat(style.fontSize),
        weight: Number(style.fontWeight),
        color: style.color,
      });
    }
  }
  return out;
}

/** El fondo real detrás de un texto: tapa el interior de las letras mientras se trazan. */
function coverFor(el: Element): string {
  for (let node: Element | null = el; node; node = node.parentElement) {
    const bg = getComputedStyle(node).backgroundColor;
    if (bg && bg !== 'transparent' && !bg.endsWith(', 0)')) return node === document.documentElement ? '#181317' : bg;
  }
  return '#181317';
}

export interface TraceResult {
  traces: Trace[];
  end: number;
  vectors: number;
  box: Rect;
}

/** Herramientas con las que un plan describe el trabajo: reserva agentes para que nunca se pisen. */
export class Kit {
  private readonly busy = new Map<Agent, number>();
  private readonly saved = new Map<Element, string | null>();
  private spot: Agent | null = null;

  constructor(
    readonly tl: gsap.core.Timeline,
    readonly ctx: PlanContext,
  ) {}

  /**
   * Hay que llamarlo antes de animar: al terminar, cada elemento vuelve al `style` que trae el HTML.
   * `clearProps: 'all'` solo no alcanza, porque también borra las posiciones y variables de Astro.
   */
  keep(els: Iterable<Element>): void {
    if (!this.saved.size) this.ctx.onCleanup(() => this.restore());
    for (const el of els) {
      if (!this.saved.has(el)) this.saved.set(el, el.getAttribute('style'));
    }
  }

  private restore(): void {
    for (const [el, style] of this.saved) {
      gsap.set(el, { clearProps: 'all' });
      if (style === null) el.removeAttribute('style');
      else el.setAttribute('style', style);
    }
  }

  /** Devuelve desde cuándo el agente está libre y lo reserva. */
  private book(agent: Agent, at: number, duration: number): number {
    const start = Math.max(at, this.busy.get(agent) ?? 0, 0);
    this.busy.set(agent, start + duration);
    this.ctx.working.add(agent);
    return start;
  }

  /** El agente sale de la órbita hasta ese punto. Devuelve cuándo llega. */
  go(agent: Agent, x: number, y: number, at: number, duration = 0.18): number {
    const start = this.book(agent, at, duration);
    travel(this.tl, this.ctx.crew, agent, x, y, start, duration);
    return start + duration;
  }

  /** Se mueve de un punto a otro con una tarea: el timeline lo acompaña con lo que dibuja. */
  sweep(agent: Agent, x: number, y: number, at: number, duration: number, ease = 'power2.inOut'): number {
    const start = this.book(agent, at, duration);
    this.tl.to(agent, { x, y, duration, ease }, start);
    return start + duration;
  }

  /** La etiqueta con el oficio la lleva un solo agente por vez: se lee quién está trabajando. */
  spotlight(agent: Agent, at: number): void {
    if (this.spot) this.tl.to(this.spot, { tag: 0, duration: 0.1 }, at);
    this.tl.to(agent, { tag: 1, duration: 0.1 }, at);
    this.spot = agent;
  }

  frame(el: Element, at: number, agent: Agent, chip = true): { frame: Frame; end: number } {
    const r = docRect(el);
    const frame: Frame = { ...r, grow: 0, alpha: 1, chip: 0, label: `${Math.round(r.w)} × ${Math.round(r.h)}` };
    this.ctx.overlay.frames.push(frame);
    const start = this.go(agent, r.x, r.y, at - 0.16, 0.16);
    const end = this.sweep(agent, r.x + r.w, r.y + r.h, start, 0.24);
    this.tl.to(frame, { grow: 1, duration: 0.24, ease: 'power2.inOut' }, end - 0.24);
    if (chip) this.tl.to(frame, { chip: 1, duration: 0.1 }, end - 0.06);
    return { frame, end };
  }

  dismiss(frame: Frame, at: number): void {
    this.tl.to(frame, { alpha: 0, duration: 0.26, ease: 'power1.out' }, at);
  }

  /** Una guía de construcción: el agente la dibuja recorriéndola. */
  guide(line: Omit<Guide, 'draw' | 'alpha'>, at: number, agent: Agent | null, hold = 1.2, duration = 0.34): number {
    const item: Guide = { ...line, draw: 0, alpha: 1 };
    this.ctx.overlay.guides.push(item);
    let start = at;
    if (agent) {
      start = this.go(agent, line.x1, line.y1, at - 0.14, 0.14);
      this.sweep(agent, line.x2, line.y2, start, duration);
    }
    this.tl.to(item, { draw: 1, duration, ease: 'power2.inOut' }, start);
    this.tl.to(item, { alpha: 0, duration: 0.34 }, start + duration + hold);
    return start + duration;
  }

  /** Círculo de compás: el agente hace de punta y lo va cerrando. */
  compass(x: number, y: number, radius: number, at: number, agent: Agent, duration = 0.6, keep = 1): number {
    const arc: Arc = { x, y, r: radius, from: -Math.PI / 2, p: 0, alpha: 1 };
    this.ctx.overlay.arcs.push(arc);
    const start = this.go(agent, x + radius * Math.cos(arc.from), y + radius * Math.sin(arc.from), at - 0.16, 0.16);
    this.book(agent, start, duration);
    this.tl.to(
      arc,
      {
        p: 1,
        duration,
        ease: 'power1.inOut',
        onUpdate() {
          const a = arc.from + arc.p * Math.PI * 2;
          agent.x = x + radius * Math.cos(a);
          agent.y = y + radius * Math.sin(a);
        },
      },
      start,
    );
    this.tl.to(arc, { alpha: 0, duration: 0.34 }, start + duration + keep);
    return start + duration;
  }

  note(x: number, y: number, text: string, at: number, hold = 0.44): void {
    const note = { x, y, alpha: 0, text };
    this.ctx.overlay.notes.push(note);
    this.tl.to(note, { alpha: 1, duration: 0.1 }, at);
    this.tl.to(note, { alpha: 0, duration: 0.18 }, at + hold);
  }

  ripple(x: number, y: number, at: number): void {
    const { overlay } = this.ctx;
    this.tl.call(() => overlay.ripples.push({ x: x - scrollX, y, age: 0 }), undefined, at);
  }

  /**
   * Lo mismo que en el hero, para cualquier texto: primero aparecen los puntos de control de cada
   * letra, después varios agentes recorren los contornos a toda velocidad y al final se pinta.
   */
  trace(el: HTMLElement, at: number, workers: Agent[], options: { span?: number; paint?: boolean } = {}): TraceResult {
    const { overlay } = this.ctx;
    this.keep([el]);
    const box = docRect(el);
    const m = metrics();
    const chars = m ? measureChars(el) : [];
    const paint = options.paint ?? true;
    const reveal = (when: number): void => {
      if (!paint) return;
      this.tl.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.22, ease: 'entrada' }, when);
    };
    if (!m || !chars.length || !workers.length) {
      reveal(at);
      return { traces: [], end: at + 0.22, vectors: 0, box };
    }

    const cover = coverFor(el);
    const ascentRatio = m.ascent / (m.ascent - m.descent);
    const items: Array<{ trace: Trace; outline: SVGPathElement; outlineLength: number; px: number }> = [];
    let vectors = 0;
    for (const c of chars) {
      const g = glyph(c.char, c.weight);
      if (!g) continue;
      const scale = c.size / m.upm;
      const trace: Trace = {
        path: g.path,
        length: g.length,
        x: c.x,
        y: c.top + c.height * ascentRatio,
        scale,
        width: Math.max(2.4, c.size * 0.045),
        p: 0,
        alpha: 1,
        color: c.color,
        cover,
        points: g.points,
        pointsAlpha: 0,
      };
      vectors += g.vectors;
      overlay.traces.push(trace);
      items.push({ trace, outline: g.outline, outlineLength: g.outlineLength, px: g.length * scale });
    }
    const traces = items.map((item) => item.trace);
    if (!items.length) {
      reveal(at);
      return { traces: [], end: at + 0.22, vectors: 0, box };
    }

    // Cálculo: los vectores aparecen en una ola, de punta a punta del texto.
    const calc = 0.24;
    this.tl.to(traces, { pointsAlpha: 1, duration: 0.1, stagger: { amount: calc - 0.08 } }, at);

    // Trazado: cada agente toma un tramo seguido del texto, repartido por longitud real.
    const total = items.reduce((sum, item) => sum + item.px, 0);
    const span = options.span ?? gsap.utils.clamp(0.5, 1.1, total / 5200);
    const share = total / workers.length;
    const start = at + calc;
    let index = 0;
    workers.forEach((agent, w) => {
      const group: typeof items = [];
      let length = 0;
      while (index < items.length && (length < share || w === workers.length - 1)) {
        const item = items[index++];
        if (!item) break;
        group.push(item);
        length += item.px;
      }
      const first = group[0];
      if (!first) return;
      const entry = first.outline.getPointAtLength(0);
      const arrive = this.go(agent, first.trace.x + entry.x * first.trace.scale, first.trace.y + entry.y * first.trace.scale, at, calc * 0.9);
      let cursor = Math.max(arrive, start);
      for (const item of group) {
        const duration = Math.max(0.012, span * (item.px / length));
        const { trace, outline, outlineLength } = item;
        this.tl.set(trace, { pointsAlpha: 0 }, cursor + duration);
        this.tl.to(
          trace,
          {
            p: 1,
            duration,
            ease: 'none',
            onUpdate() {
              const point = outline.getPointAtLength(trace.p * outlineLength);
              agent.x = trace.x + point.x * trace.scale;
              agent.y = trace.y + point.y * trace.scale;
            },
          },
          cursor,
        );
        cursor += duration;
      }
      this.book(agent, cursor - span, span);
    });

    const end = start + span;
    if (paint) this.tl.to(traces, { alpha: 0, duration: 0.24 }, end);
    reveal(end);
    return { traces, end: end + 0.22, vectors, box };
  }
}
