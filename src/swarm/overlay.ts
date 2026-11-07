import type { RoleId } from '../i18n/ui';

/** orbit: lo mueve la física; task: el timeline; pin: fijo en un punto; talk: al costado del cursor, hablando. */
export type AgentMode = 'orbit' | 'task' | 'pin' | 'talk';

export const TRAIL = 14;
const TETHER_LIFE = 0.5;

/** Agente en coordenadas de documento. En órbita lo mueve la física; en tarea, el timeline. */
export interface Agent {
  role: RoleId;
  name: string;
  color: string;
  mode: AgentMode;
  x: number;
  y: number;
  vx: number;
  vy: number;
  lastX: number;
  lastY: number;
  angle: number;
  alpha: number;
  scale: number;
  tag: number;
  depth: number;
  radius: number;
  speed: number;
  phase: number;
  tilt: number;
  spin: number;
  stiffness: number;
  pinX: number;
  pinY: number;
  aimX: number;
  aimY: number;
  trailX: Float32Array;
  trailY: Float32Array;
  trailAt: number;
}

/** Marco de wireframe en coordenadas de documento. `grow` lo despliega desde su esquina. */
export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
  grow: number;
  alpha: number;
  chip: number;
  label: string;
}

export interface Guide {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  draw: number;
  alpha: number;
}

export interface Note {
  x: number;
  y: number;
  alpha: number;
  text: string;
}

/** Una letra que los agentes están dibujando, con sus puntos de control. */
export interface Trace {
  path: Path2D;
  length: number;
  x: number;
  y: number;
  scale: number;
  width: number;
  p: number;
  alpha: number;
  color: string;
  cover: string;
  points: Float32Array;
  pointsAlpha: number;
}

/** Círculo de compás en coordenadas de documento. */
export interface Arc {
  x: number;
  y: number;
  r: number;
  from: number;
  p: number;
  alpha: number;
}

export interface Ripple {
  x: number;
  y: number;
  age: number;
}

/** Lo que dice un agente: se dibuja junto a su punta, del lado opuesto al cursor. */
export interface Bubble {
  name: string;
  color: string;
  text: string;
  lines: string[];
  w: number;
  h: number;
  /** Punta del agente, en pantalla. */
  x: number;
  y: number;
  side: 1 | -1;
  alpha: number;
}

/** Línea de despacho: el cursor es el orquestador y cada agente sale con una orden. */
export interface Tether {
  agent: Agent;
  age: number;
}

const LINE = '208, 139, 189'; // ciruela claro: el color de las herramientas, nunca de la página
const CHIP = '#714b67';
const INK = '#f5f2f4';
const ARROW = 'M0 0 L0 15.5 L4.2 11.8 L6.9 18 L9.9 16.7 L7.2 10.7 L12.6 10.4 Z';
const SPRITE_SIZE = 56;
const SPRITE_ORIGIN = 20;
const RIPPLE_LIFE = 0.55;
const SURFACE = 'rgba(24, 19, 23, 0.95)';
const TICK = 'rgba(143, 143, 143, 0.6)';
// Después de una sección las reglas esperan un poco: entre dos secciones seguidas no parpadean.
const RULER_HOLD = 1.5;
const BUBBLE = { pad: 11, line: 17, nameLine: 15, maxText: 220, radius: 10 };

export class Overlay {
  readonly frames: Frame[] = [];
  readonly hoverFrames: Frame[] = [];
  readonly guides: Guide[] = [];
  readonly notes: Note[] = [];
  readonly ripples: Ripple[] = [];
  readonly tethers: Tether[] = [];
  readonly traces: Trace[] = [];
  readonly arcs: Arc[] = [];
  readonly bubbles: Bubble[] = [];
  /** Corrimiento de la escena fija respecto de cuando se midió: las herramientas la acompañan. */
  dx = 0;
  dy = 0;
  private anchor: { el: Element; x: number; y: number } | null = null;

  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly mono: string;
  private readonly sans: string;
  private tooling = false;
  private toolsOffAt = -Infinity;
  private tools = 0;
  private clock = 0;
  private readonly sprites = new Map<string, HTMLCanvasElement>();
  private dpr = 1;
  private width = 0;
  private height = 0;

  constructor() {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d no disponible');
    this.ctx = ctx;
    const vars = getComputedStyle(document.documentElement);
    this.mono = vars.getPropertyValue('--font-geist') || 'monospace';
    this.sans = vars.getPropertyValue('--font-inter') || 'system-ui';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.dataset.swarm = '';
    this.canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:40;pointer-events:none';
    document.body.append(this.canvas);
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.width = innerWidth;
    this.height = innerHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.sprites.clear();
  }

  clear(): void {
    this.frames.length = 0;
    this.guides.length = 0;
    this.notes.length = 0;
    this.traces.length = 0;
    this.arcs.length = 0;
  }

  /** Mientras se construye una sección aparecen las reglas, como en una herramienta de diseño. */
  setTooling(busy: boolean): void {
    if (this.tooling && !busy) this.toolsOffAt = this.clock;
    this.tooling = busy;
  }

  /** Corta la frase en renglones que entran en el globito. */
  measureBubble(name: string, text: string): Pick<Bubble, 'lines' | 'w' | 'h'> {
    const { ctx } = this;
    ctx.font = `500 13px ${this.sans}`;
    const lines: string[] = [];
    let current = '';
    for (const word of text.split(' ')) {
      const next = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(next).width > BUBBLE.maxText) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    ctx.font = `600 9.5px ${this.mono}`;
    const nameW = ctx.measureText(name).width;
    return {
      lines,
      w: Math.ceil(Math.max(widest, nameW) + BUBBLE.pad * 2),
      h: Math.ceil(BUBBLE.pad * 1.5 + BUBBLE.nameLine + lines.length * BUBBLE.line),
    };
  }

  setAnchor(el: Element | null): void {
    this.dx = 0;
    this.dy = 0;
    if (!el) {
      this.anchor = null;
      return;
    }
    const r = el.getBoundingClientRect();
    this.anchor = { el, x: r.left + scrollX, y: r.top + scrollY };
  }

  private drawTrace(t: Trace, scroll: number): void {
    if (t.alpha <= 0.01) return;
    const { ctx } = this;
    ctx.save();
    ctx.translate(t.x, t.y - scroll);
    ctx.scale(t.scale, t.scale);
    if (t.pointsAlpha > 0.01) {
      ctx.globalAlpha = t.alpha * t.pointsAlpha;
      ctx.fillStyle = `rgb(${LINE})`;
      const size = 2.2 / t.scale;
      for (let i = 0; i + 1 < t.points.length; i += 2) {
        ctx.fillRect((t.points[i] ?? 0) - size / 2, (t.points[i + 1] ?? 0) - size / 2, size, size);
      }
    }
    if (t.p > 0) {
      ctx.globalAlpha = t.alpha;
      ctx.lineJoin = 'round';
      ctx.lineWidth = t.width / t.scale;
      ctx.strokeStyle = t.color;
      ctx.setLineDash([t.length * t.p, t.length]);
      ctx.stroke(t.path);
      ctx.setLineDash([]);
      // El relleno tapa la mitad interna del trazo y los solapamientos de la fuente variable.
      ctx.fillStyle = t.cover;
      ctx.fill(t.path);
    }
    ctx.restore();
  }

  private drawArc(a: Arc, scroll: number): void {
    if (a.alpha <= 0.01 || a.p <= 0) return;
    const { ctx } = this;
    ctx.strokeStyle = `rgba(${LINE}, ${a.alpha * 0.8})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(a.x, a.y - scroll, a.r, a.from, a.from + a.p * Math.PI * 2);
    ctx.stroke();
  }

  /** La flecha con su halo se dibuja una vez por color: rotarla después es solo copiar un bitmap. */
  private sprite(color: string): HTMLCanvasElement {
    const cached = this.sprites.get(color);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SPRITE_SIZE * this.dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(this.dpr, this.dpr);
      ctx.translate(SPRITE_ORIGIN, SPRITE_ORIGIN);
      const arrow = new Path2D(ARROW);
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = color;
      ctx.fill(arrow);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(11, 7, 10, 0.9)';
      ctx.lineWidth = 1;
      ctx.fill(arrow);
      ctx.stroke(arrow);
    }
    this.sprites.set(color, canvas);
    return canvas;
  }

  /** La luz que acompaña al cursor: tiñe apenas lo que tiene cerca, con el ciruela de Odoo. */
  private drawAura(x: number, y: number, strength: number): void {
    if (strength <= 0.01) return;
    const { ctx } = this;
    const radius = 240;
    const aura = ctx.createRadialGradient(x, y, 0, x, y, radius);
    aura.addColorStop(0, `rgba(113, 75, 103, ${0.42 * strength})`);
    aura.addColorStop(0.45, `rgba(113, 75, 103, ${0.14 * strength})`);
    aura.addColorStop(1, 'rgba(113, 75, 103, 0)');
    ctx.fillStyle = aura;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawTethers(x: number, y: number, scroll: number): void {
    const { ctx } = this;
    ctx.globalCompositeOperation = 'lighter';
    for (const tether of this.tethers) {
      const t = tether.age / TETHER_LIFE;
      if (t >= 1) continue;
      const { agent } = tether;
      ctx.strokeStyle = agent.color;
      ctx.globalAlpha = (1 - t) ** 2 * 0.75;
      ctx.lineWidth = 1.4 * (1 - t) + 0.3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(agent.x, agent.y - scroll);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  render(agents: Agent[], anchorX: number, anchorY: number, aura: number, dt: number): void {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    const scroll = scrollY;
    this.clock += dt;
    const want = this.tooling || this.clock - this.toolsOffAt < RULER_HOLD ? 1 : 0;
    this.tools += (want - this.tools) * (1 - Math.exp(-(want ? 10 : 6) * dt));
    this.drawAura(anchorX, anchorY, aura);
    for (const tether of this.tethers) tether.age += dt;
    while (this.tethers[0] && this.tethers[0].age >= TETHER_LIFE) this.tethers.shift();
    this.drawTethers(anchorX, anchorY, scroll);
    if (this.anchor) {
      const r = this.anchor.el.getBoundingClientRect();
      this.dx = r.left + scrollX - this.anchor.x;
      this.dy = r.top + scroll - this.anchor.y;
    }
    ctx.save();
    ctx.translate(this.dx, this.dy);
    for (const guide of this.guides) this.drawGuide(guide, scroll);
    for (const arc of this.arcs) this.drawArc(arc, scroll);
    for (const frame of this.frames) this.drawFrame(frame, scroll);
    for (const trace of this.traces) this.drawTrace(trace, scroll);
    for (const note of this.notes) this.drawNote(note, scroll);
    this.drawRipples(scroll);
    ctx.restore();
    for (const frame of this.hoverFrames) this.drawFrame(frame, scroll);
    this.drawRulers(scroll);

    ctx.globalCompositeOperation = 'lighter';
    for (const agent of agents) this.drawTrail(agent, scroll);
    ctx.globalCompositeOperation = 'source-over';
    // Los que pasan por detrás se pintan primero: la profundidad también es orden.
    const ordered = agents.slice().sort((a, b) => a.depth - b.depth);
    for (const agent of ordered) this.drawAgent(agent, scroll);
    for (const bubble of this.bubbles) this.drawBubble(bubble);
  }

  /**
   * Reglas arriba y a la izquierda, con medidas reales de la página: la de la izquierda cuenta desde
   * el principio del documento. Lo que se está construyendo se marca en las dos, como una selección.
   */
  private drawRulers(scroll: number): void {
    const a = this.tools;
    if (a <= 0.01) return;
    const { ctx } = this;
    const t = this.width < 768 ? 14 : 16;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(11, 7, 10, 0.82)';
    ctx.fillRect(0, 0, this.width, t);
    ctx.fillRect(0, t, t, this.height - t);

    ctx.fillStyle = CHIP;
    for (const f of this.frames) {
      if (f.alpha <= 0.02 || f.grow <= 0) continue;
      ctx.globalAlpha = a * Math.min(f.alpha, 1) * 0.55;
      ctx.fillRect(Math.max(f.x + this.dx, t), 0, f.w * f.grow, t);
      ctx.fillRect(0, Math.max(f.y + this.dy - scroll, t), t, f.h * f.grow);
    }
    ctx.globalAlpha = a;

    ctx.strokeStyle = TICK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const tick = (n: number): number => (n % 100 === 0 ? 0.6 : n % 50 === 0 ? 0.38 : 0.2) * t;
    for (let x = Math.ceil(t / 10) * 10; x < this.width; x += 10) {
      ctx.moveTo(x + 0.5, t);
      ctx.lineTo(x + 0.5, t - tick(x));
    }
    for (let y = Math.ceil((scroll + t) / 10) * 10; y < scroll + this.height; y += 10) {
      const sy = Math.round(y - scroll) + 0.5;
      ctx.moveTo(t, sy);
      ctx.lineTo(t - tick(y), sy);
    }
    ctx.stroke();
    ctx.strokeStyle = `rgba(${LINE}, 0.28)`;
    ctx.beginPath();
    ctx.moveTo(0, t - 0.5);
    ctx.lineTo(this.width, t - 0.5);
    ctx.moveTo(t - 0.5, t);
    ctx.lineTo(t - 0.5, this.height);
    ctx.stroke();

    ctx.font = `500 8px ${this.mono}`;
    ctx.fillStyle = TICK;
    ctx.textBaseline = 'top';
    for (let x = 100; x < this.width; x += 100) ctx.fillText(String(x), x + 3, 2);
    for (let y = Math.ceil((scroll + t + 30) / 100) * 100; y < scroll + this.height; y += 100) {
      ctx.save();
      ctx.translate(2, y - scroll - 3);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(String(y), 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  /** Aparece desde la punta del agente y crece apenas: de 94% a 100%, nunca desde cero. */
  private drawBubble(b: Bubble): void {
    if (b.alpha <= 0.01) return;
    const { ctx } = this;
    const left = Math.min(Math.max(b.side === 1 ? b.x + 16 : b.x - 16 - b.w, 8), this.width - b.w - 8);
    const top = Math.min(Math.max(b.y - b.h / 2 + 4, 24), this.height - b.h - 8);
    const edge = b.side === 1 ? left : left + b.w;
    const tipY = Math.min(Math.max(b.y, top + 10), top + b.h - 10);
    const s = 0.94 + 0.06 * b.alpha;
    ctx.save();
    ctx.globalAlpha = b.alpha;
    ctx.translate(edge, tipY);
    ctx.scale(s, s);
    ctx.translate(-edge, -tipY);

    ctx.beginPath();
    ctx.roundRect(left, top, b.w, b.h, BUBBLE.radius);
    ctx.fillStyle = SURFACE;
    ctx.fill();
    ctx.strokeStyle = `rgba(${LINE}, 0.4)`;
    ctx.lineWidth = 1;
    ctx.stroke();
    // La cola tapa el borde donde nace y solo dibuja sus dos lados.
    ctx.beginPath();
    ctx.moveTo(edge + b.side, tipY - 5);
    ctx.lineTo(edge - 6 * b.side, tipY);
    ctx.lineTo(edge + b.side, tipY + 5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(edge, tipY - 5);
    ctx.lineTo(edge - 6 * b.side, tipY);
    ctx.lineTo(edge, tipY + 5);
    ctx.stroke();

    ctx.textBaseline = 'top';
    ctx.font = `600 9.5px ${this.mono}`;
    ctx.fillStyle = b.color;
    ctx.fillText(b.name, left + BUBBLE.pad, top + BUBBLE.pad * 0.75);
    ctx.font = `500 13px ${this.sans}`;
    ctx.fillStyle = INK;
    b.lines.forEach((line, i) => {
      ctx.fillText(line, left + BUBBLE.pad, top + BUBBLE.pad * 0.75 + BUBBLE.nameLine + i * BUBBLE.line);
    });
    ctx.restore();
  }

  private drawTrail(a: Agent, scroll: number): void {
    if (a.alpha <= 0.02) return;
    const { ctx } = this;
    ctx.strokeStyle = a.color;
    ctx.lineWidth = 1.1;
    ctx.lineCap = 'round';
    ctx.globalAlpha = a.alpha * (0.34 + 0.2 * a.depth);
    const ox = a.mode === 'task' ? this.dx : 0;
    const oy = a.mode === 'task' ? this.dy : 0;
    ctx.beginPath();
    ctx.moveTo(a.x + ox, a.y + oy - scroll);
    for (let i = 0; i < TRAIL; i++) {
      const x = a.trailX[i] ?? a.x;
      const y = a.trailY[i] ?? a.y;
      ctx.lineTo(x + ox, y + oy - scroll);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawRipples(scroll: number): void {
    const { ctx } = this;
    for (const ripple of this.ripples) {
      const t = ripple.age / RIPPLE_LIFE;
      if (t >= 1) continue;
      ctx.strokeStyle = `rgba(${LINE}, ${(1 - t) * 0.7})`;
      ctx.lineWidth = 1.5 * (1 - t) + 0.25;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y - scroll, 8 + 120 * (1 - (1 - t) ** 3), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawGuide(g: Guide, scroll: number): void {
    if (g.alpha <= 0.01 || g.draw <= 0) return;
    const { ctx } = this;
    ctx.strokeStyle = `rgba(${LINE}, ${g.alpha * 0.55})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(g.x1, g.y1 - scroll);
    ctx.lineTo(g.x1 + (g.x2 - g.x1) * g.draw, g.y1 + (g.y2 - g.y1) * g.draw - scroll);
    ctx.stroke();
  }

  private drawFrame(f: Frame, scroll: number): void {
    if (f.alpha <= 0.01 || f.grow <= 0) return;
    const { ctx } = this;
    const w = f.w * f.grow;
    const h = f.h * f.grow;
    const x = f.x;
    const y = f.y - scroll;
    ctx.fillStyle = `rgba(245, 242, 244, ${f.alpha * 0.05})`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = `rgba(${LINE}, ${f.alpha})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);

    ctx.fillStyle = `rgba(245, 242, 244, ${f.alpha})`;
    for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]] as const) {
      ctx.fillRect(cx - 2.5, cy - 2.5, 5, 5);
    }

    if (f.chip > 0.01) this.drawChip(f.label, x + w / 2, y + h + 8, f.alpha * f.chip, CHIP, INK, true);
  }

  private drawNote(n: Note, scroll: number): void {
    if (n.alpha > 0.01) this.drawChip(n.text, n.x, n.y - scroll, n.alpha, INK, '#0b070a', false);
  }

  private drawChip(text: string, x: number, y: number, alpha: number, bg: string, fg: string, center: boolean): void {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `500 10px ${this.mono}`;
    const w = ctx.measureText(text).width + 12;
    const left = center ? x - w / 2 : x;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(left, y, w, 16, 4);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, left + 6, y + 8.5);
    ctx.restore();
  }

  private drawAgent(a: Agent, scroll: number): void {
    if (a.alpha <= 0.01) return;
    const { ctx } = this;
    const near = (a.depth + 1) / 2;
    const size = a.scale * (0.76 + 0.34 * near);
    ctx.save();
    ctx.globalAlpha = a.alpha * (0.5 + 0.5 * near);
    const ox = a.mode === 'task' ? this.dx : 0;
    const oy = a.mode === 'task' ? this.dy : 0;
    ctx.translate(a.x + ox, a.y + oy - scroll);
    ctx.rotate(a.angle);
    ctx.scale(size, size);
    ctx.drawImage(this.sprite(a.color), -SPRITE_ORIGIN, -SPRITE_ORIGIN, SPRITE_SIZE, SPRITE_SIZE);
    ctx.restore();
    if (a.tag > 0.01) this.drawChip(a.name, a.x + ox + 12, a.y + oy - scroll + 16, a.alpha * a.tag, a.color, '#0b070a', false);
  }
}

export { RIPPLE_LIFE };
