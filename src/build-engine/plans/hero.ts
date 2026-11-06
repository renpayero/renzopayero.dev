import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { SplitText } from 'gsap/SplitText';
import { travel, type Crew } from '../agents';
import type { Frame, Guide, Note, Overlay } from '../overlay';
import type { RoleId } from '../../i18n/ui';

gsap.registerPlugin(SplitText, CustomEase);
// Medidas en Apple: docs/referencia-apple.md
CustomEase.create('entrada', '0.28,0.11,0.32,1');

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlanContext {
  overlay: Overlay;
  crew: Crew;
  announce: (role: RoleId | 'go-live') => void;
  onCleanup: (fn: () => void) => void;
}

const docRect = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
};

const need = <T extends Element>(root: ParentNode, selector: string): T => {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`falta ${selector}`);
  return el;
};

/** Contraste WCAG real, medido sobre lo que el navegador está pintando. */
function contrast(el: Element): number {
  const lum = (css: string): number => {
    const parts = css.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
    const [r = 0, g = 0, b = 0] = parts.map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const fg = lum(getComputedStyle(el).color);
  const bg = lum(getComputedStyle(document.documentElement).backgroundColor);
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
}

/**
 * Orden del hero. Protagonista: el nombre. Apoyo: lema, CTA y retrato. Decoración: nav.
 * Todo el plan dura menos de 4 s y sigue el orden de una entrega real.
 */
export function heroPlan(root: HTMLElement, ctx: PlanContext): gsap.core.Timeline {
  const { overlay, crew, announce } = ctx;
  const tl = gsap.timeline({ paused: true, defaults: { overwrite: false } });

  const nameEl = need(root, '[data-b="name"]');
  const nav = need(document, '[data-b="nav"]');
  const lede = need<HTMLElement>(root, '[data-b="lede"]');
  const cta = need<HTMLElement>(root, '[data-b="cta"]');
  const portrait = need<HTMLElement>(root, '[data-b="portrait"]');
  const img = need(portrait, 'img');
  const fill = need(portrait, '[data-portrait-fill]');
  const ambient = need(root, '[data-ambient]');
  const words = [...nameEl.querySelectorAll<HTMLElement>('[data-word]')];

  const addFrame = (el: Element, at: number, agentIndex: number): Frame => {
    const r = docRect(el);
    const frame: Frame = { ...r, grow: 0, alpha: 1, chip: 0, label: `${Math.round(r.w)} × ${Math.round(r.h)}` };
    overlay.frames.push(frame);
    const agent = crew.pick('relevamiento', agentIndex);
    travel(tl, agent, r.x, r.y, at - 0.22, 0.24);
    tl.to(agent, { x: r.x + r.w, y: r.y + r.h, duration: 0.28, ease: 'power2.inOut' }, at);
    tl.to(frame, { grow: 1, duration: 0.28, ease: 'power2.inOut' }, at);
    tl.to(frame, { chip: 1, duration: 0.14 }, at + 0.22);
    return frame;
  };

  const handOver = (frame: Frame, at: number): void => {
    tl.to(frame, { alpha: 0, duration: 0.32, ease: 'power1.out' }, at);
  };

  // Entran todos, sin metrónomo: quien llega primero es quien trabaja primero.
  tl.call(() => announce('relevamiento'), undefined, 0);
  crew.all.forEach((agent, i) => {
    tl.to(agent, { alpha: 1, duration: 0.18 }, i * 0.018 + (i % 3) * 0.03);
  });
  [0, 1, 2].forEach((i) => tl.to(crew.pick('relevamiento', i), { tag: i === 0 ? 1 : 0, duration: 0.16 }, 0.1));

  // Relevamiento: mide lo que hay en la página real.
  const nameFrame = addFrame(nameEl, 0.2, 0);
  const portraitFrame = addFrame(portrait, 0.3, 1);
  const ledeFrame = addFrame(lede, 0.46, 2);
  const ctaFrame = addFrame(cta, 0.72, 0);
  const navFrame = addFrame(nav, 0.82, 1);

  // Arquitectura: alinea con guías; las columnas salen del layout, no de un dibujo.
  tl.call(() => announce('arquitectura'), undefined, 0.6);
  const left = docRect(nameEl).x;
  const portraitRect = docRect(portrait);
  const guide = (g: Omit<Guide, 'draw' | 'alpha'>, at: number): void => {
    const item: Guide = { ...g, draw: 0, alpha: 1 };
    overlay.guides.push(item);
    tl.to(item, { draw: 1, duration: 0.4, ease: 'power2.inOut' }, at);
    tl.to(item, { alpha: 0, duration: 0.4 }, at + 1.5);
  };
  const top = scrollY;
  const bottom = scrollY + innerHeight;
  guide({ x1: left, y1: top, x2: left, y2: bottom }, 0.62);
  guide({ x1: portraitRect.x, y1: bottom, x2: portraitRect.x, y2: top }, 0.7);
  guide({ x1: 0, y1: portraitRect.y, x2: innerWidth, y2: portraitRect.y }, 0.78);
  travel(tl, crew.pick('arquitectura', 0), left, top + 70, 0.5, 0.34);
  if (crew.count('arquitectura') > 1) travel(tl, crew.pick('arquitectura', 1), portraitRect.x, portraitRect.y, 0.56, 0.34);
  tl.to(crew.pick('arquitectura', 0), { tag: 1, duration: 0.16 }, 0.62);
  tl.to(crew.pick('relevamiento', 0), { tag: 0, duration: 0.16 }, 0.62);

  // Desarrollo: los agentes trazan cada contorno del nombre, de verdad sobre el glifo.
  tl.call(() => announce('desarrollo'), undefined, 0.92);
  words.forEach((word, w) => {
    const svg = need<SVGSVGElement>(word, 'svg');
    const strokes = [...svg.querySelectorAll<SVGPathElement>('.name__stroke')];
    const lengths = strokes.map((s) => s.getTotalLength());
    const total = lengths.reduce((a, b) => a + b, 0);
    const box = docRect(word);
    const advance = Number(svg.dataset.advance);
    const baseline = Number(svg.dataset.baseline);
    const lineBox = Number(svg.dataset.linebox);
    const agent = crew.pick('desarrollo', w);
    const toPage = (x: number, y: number) => ({
      x: box.x + (x / advance) * box.w,
      y: box.y + ((y + baseline) / lineBox) * box.h,
    });
    const start = toPage(strokes[0]?.getPointAtLength(0).x ?? 0, strokes[0]?.getPointAtLength(0).y ?? 0);
    const begin = 0.92 + w * 0.16;
    const span = 1.14;
    travel(tl, agent, start.x, start.y, begin - 0.22, 0.22);
    let cursor = begin;
    strokes.forEach((stroke, i) => {
      const length = lengths[i] ?? 0;
      const duration = span * (length / total);
      const state = { p: 0 };
      tl.to(
        state,
        {
          p: 1,
          duration,
          ease: 'none',
          onUpdate() {
            stroke.style.strokeDashoffset = String(1 - state.p);
            const pt = stroke.getPointAtLength(state.p * length);
            const page = toPage(pt.x, pt.y);
            agent.x = page.x;
            agent.y = page.y;
          },
        },
        cursor,
      );
      cursor += duration;
    });
  });
  handOver(nameFrame, 1.05);
  tl.to(crew.pick('desarrollo', 0), { tag: 1, duration: 0.16 }, 0.92);
  tl.to(crew.pick('arquitectura', 0), { tag: 0, duration: 0.16 }, 0.92);

  // Desarrollo: el lema se tipea con una cadencia que acelera, no carácter a carácter fijo.
  const split = SplitText.create(lede, { type: 'words,chars', aria: 'none' });
  ctx.onCleanup(() => split.revert());
  gsap.set(lede, { opacity: 1 });
  gsap.set(split.chars, { opacity: 0 });
  const typist = crew.pick('desarrollo', 2);
  const firstChar = split.chars[0];
  if (firstChar) {
    const r = docRect(firstChar);
    travel(tl, typist, r.x, r.y + r.h, 0.96, 0.24);
  }
  const typeStart = 1.2;
  const typeSpan = 0.86;
  split.chars.forEach((char, i) => {
    const at = typeStart + typeSpan * (i / split.chars.length) ** 0.9;
    const r = docRect(char);
    tl.set(char, { opacity: 1 }, at);
    tl.set(typist, { x: r.x + r.w, y: r.y + r.h }, at);
  });
  handOver(ledeFrame, typeStart);

  // Diseño: un solo gesto por contenedor. El retrato se descubre y su imagen ya está adentro.
  tl.call(() => announce('diseno'), undefined, 1.42);
  const pr = portraitRect;
  travel(tl, crew.pick('diseno', 0), pr.x + pr.w * 0.5, pr.y + pr.h, 1.2, 0.3);
  tl.to(crew.pick('diseno', 0), { tag: 1, duration: 0.16 }, 1.42);
  tl.to(crew.pick('desarrollo', 0), { tag: 0, duration: 0.16 }, 1.42);
  tl.fromTo(fill, { scaleY: 0 }, { scaleY: 1, duration: 0.62, ease: 'entrada' }, 1.42);
  tl.fromTo(img, { opacity: 0.14, scale: 1.06 }, { opacity: 1, scale: 1, duration: 0.74, ease: 'entrada' }, 1.42);
  tl.to(crew.pick('diseno', 0), { y: pr.y - 6, duration: 0.62, ease: 'entrada' }, 1.42);
  handOver(portraitFrame, 1.5);

  const ctaRect = docRect(cta);
  if (crew.count('diseno') > 1) travel(tl, crew.pick('diseno', 1), ctaRect.x + ctaRect.w * 0.6, ctaRect.y + ctaRect.h, 1.4, 0.3);
  if (crew.count('desarrollo') > 3) travel(tl, crew.pick('desarrollo', 3), ctaRect.x + ctaRect.w * 0.2, ctaRect.y - 6, 1.35, 0.3);
  tl.fromTo(cta, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.42, ease: 'entrada' }, 1.7);
  handOver(ctaFrame, 1.72);
  tl.fromTo(nav, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 1.78);
  handOver(navFrame, 1.8);

  // QA: revisa de verdad. Lo que muestra es el contraste calculado del DOM.
  tl.call(() => announce('qa'), undefined, 2.2);
  const ledeRect = docRect(lede);
  const firstSpan = need(lede, 'span');
  const ratio = contrast(firstSpan).toFixed(1);
  const note: Note = { x: ledeRect.x + ledeRect.w + 10, y: ledeRect.y + 4, alpha: 0, text: `${ratio}:1 ok` };
  overlay.notes.push(note);
  travel(tl, crew.pick('qa', 0), note.x, note.y + 18, 2.0, 0.26);
  tl.to(crew.pick('qa', 0), { tag: 1, duration: 0.16 }, 2.2);
  tl.to(crew.pick('diseno', 0), { tag: 0, duration: 0.16 }, 2.2);
  tl.to(note, { alpha: 1, duration: 0.14 }, 2.24);
  tl.to(note, { alpha: 0, duration: 0.24 }, 2.86);
  if (crew.count('qa') > 1) travel(tl, crew.pick('qa', 1), ctaRect.x + 20, ctaRect.y + ctaRect.h, 2.06, 0.3);

  // Deploy: go-live. El tubo arranca con parpadeo: 3 destellos en 0.8 s como máximo (WCAG 2.3.1).
  const nameRect = docRect(nameEl);
  const deploy = crew.pick('deploy', 0);
  travel(tl, deploy, nameRect.x + nameRect.w * 0.55, nameRect.y + nameRect.h * 0.5, 2.34, 0.34);
  tl.to(deploy, { tag: 1, duration: 0.16 }, 2.5);
  tl.to(crew.pick('qa', 0), { tag: 0, duration: 0.16 }, 2.5);
  tl.call(() => announce('go-live'), undefined, 2.68);
  const live = 2.7;
  const lit = root.querySelectorAll('.name__lit');
  const halos = root.querySelectorAll('.name__halo');
  const flicker = { opacity: [0.001, 0.82, 0.12, 1, 0.5, 1], easeEach: 'none' };
  tl.to(lit, { keyframes: flicker, duration: 0.8, ease: 'none' }, live);
  tl.to(halos, { keyframes: flicker, duration: 0.8, ease: 'none' }, live);
  tl.to(ambient, { opacity: 1, duration: 0.8, ease: 'entrada' }, live + 0.42);

  // Se apagan las herramientas: los agentes vuelven al HUD y queda la página sola.
  const hud = document.querySelector('[data-hud]')?.getBoundingClientRect();
  const homeX = hud ? hud.left + hud.width / 2 : innerWidth / 2;
  const homeY = (hud ? hud.top + hud.height / 2 : innerHeight - 40) + scrollY;
  crew.all.forEach((agent, i) => {
    const at = 3.12 + (i % 5) * 0.03;
    tl.to(agent, { tag: 0, duration: 0.12 }, at);
    tl.to(agent, { x: homeX, y: homeY, scale: 0.6, duration: 0.42, ease: 'power2.in' }, at);
    tl.to(agent, { alpha: 0, duration: 0.14 }, at + 0.3);
  });

  return tl;
}
