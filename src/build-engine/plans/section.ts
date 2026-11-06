import gsap from 'gsap';
import { comeHome } from '../agents';
import { contrast, docRect } from '../dom';
import { Kit } from '../kit';
import type { Agent } from '../../swarm/overlay';
import type { PlanContext } from './context';

const MAX_FRAMES = 7;

const visible = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.top < innerHeight * 1.05;
};

const team = (crew: PlanContext['crew'], role: Parameters<PlanContext['crew']['pick']>[0], n = 4): Agent[] =>
  Array.from({ length: Math.min(n, crew.count(role)) }, (_, i) => crew.pick(role, i));

/**
 * Plan de una sección, en el orden de una entrega: medir, trazar la estructura, calcular y dibujar
 * los vectores de los titulares, pintar, verificar y publicar. Sale todo el equipo, cada uno con su tarea.
 */
export function sectionPlan(section: HTMLElement, ctx: PlanContext): gsap.core.Timeline {
  const { crew, announce } = ctx;
  const tl = gsap.timeline({ paused: true });
  const kit = new Kit(tl, ctx);

  const surveyors = team(crew, 'relevamiento');
  const architects = team(crew, 'arquitectura');
  const developers = team(crew, 'desarrollo');
  const designers = team(crew, 'diseno');
  const reviewers = team(crew, 'qa');
  const deploy = crew.pick('deploy', 0);

  const painted = [...section.querySelectorAll<HTMLElement>('[data-paint]')].filter(visible);
  const inside = (el: Element): boolean => painted.some((tile) => tile.contains(el));
  const traced = [...section.querySelectorAll<HTMLElement>('[data-trace]')].filter((el) => visible(el) && !inside(el));
  const measured = [...section.querySelectorAll('[data-frame]')].filter(visible).slice(0, MAX_FRAMES);
  const reveals = [...section.querySelectorAll<HTMLElement>('.reveal')].filter(
    (el) => visible(el) && !el.hasAttribute('data-paint') && !inside(el),
  );

  // Relevamiento: mide lo que hay en la página real.
  tl.call(() => announce('relevamiento'), undefined, 0);
  const frames = new Map<Element, ReturnType<Kit['frame']>['frame']>();
  measured.forEach((el, i) => {
    const agent = surveyors[i % surveyors.length];
    if (agent) frames.set(el, kit.frame(el, 0.2 + i * 0.07, agent, i < 4).frame);
  });
  if (surveyors[0]) kit.spotlight(surveyors[0], 0.08);
  const release = (el: Element, at: number): void => {
    const frame = frames.get(el);
    if (frame) kit.dismiss(frame, at);
  };

  // Arquitectura: la grilla sale del layout real y queda a la vista mientras se construye.
  const wrap = section.querySelector('.wrap') ?? section;
  const box = docRect(wrap);
  const top = scrollY;
  const bottom = scrollY + innerHeight;
  const anchor = traced[0] ?? measured[0];
  const anchorBox = anchor ? docRect(anchor) : box;
  tl.call(() => announce('arquitectura'), undefined, 0.3);
  if (architects[0]) kit.spotlight(architects[0], 0.3);
  kit.guide({ x1: box.x, y1: top, x2: box.x, y2: bottom }, 0.3, architects[0] ?? null);
  kit.guide({ x1: box.x + box.w, y1: bottom, x2: box.x + box.w, y2: top }, 0.36, architects[1] ?? null);
  kit.guide({ x1: 0, y1: anchorBox.y, x2: innerWidth, y2: anchorBox.y }, 0.44, null);

  // Desarrollo: calcula y dibuja los vectores de cada titular.
  let cursor = 0.62;
  let vectors = 0;
  let lastTraced: HTMLElement | null = null;
  if (traced.length) {
    tl.call(() => announce('desarrollo'), undefined, cursor);
    if (developers[0]) kit.spotlight(developers[0], cursor);
  }
  const liveTraces: ReturnType<Kit['trace']>['traces'] = [];
  for (const el of traced) {
    const isLive = Boolean(el.closest('[data-live]'));
    const result = kit.trace(el, cursor, developers, { paint: !isLive });
    if (isLive) liveTraces.push(...result.traces);
    vectors += result.vectors;
    release(el, result.end - 0.22);
    cursor = result.end - 0.1;
    lastTraced = el;
  }
  const first = traced[0];
  if (first && vectors) {
    const r = docRect(first);
    kit.note(Math.max(8, Math.min(r.x, innerWidth - 150)), r.y - 22, ctx.vectorsLabel(vectors), 0.72, Math.max(0.5, cursor - 0.9));
  }

  // Diseño: las tarjetas se pintan desde el cursor del agente; lo demás entra como en Apple.
  const paintAt = traced.length ? Math.max(0.9, cursor - 0.4) : 0.7;
  tl.call(() => announce('diseno'), undefined, paintAt);
  if (designers[0]) kit.spotlight(designers[0], paintAt);
  let end = paintAt;
  painted.forEach((tile, i) => {
    const painter = designers[i % designers.length];
    if (!painter) return;
    const r = docRect(tile);
    const at = paintAt + i * 0.13;
    const start = kit.go(painter, r.x, r.y, at - 0.14, 0.14);
    kit.keep([tile]);
    gsap.set(tile, { transition: 'none', opacity: 1, transform: 'none', clipPath: 'circle(0px at 0px 0px)' });
    tl.to(tile, { clipPath: `circle(${Math.ceil(Math.hypot(r.w, r.h)) + 2}px at 0px 0px)`, duration: 0.46, ease: 'entrada' }, start);
    kit.sweep(painter, r.x + r.w, r.y + r.h, start, 0.46, 'power2.out');
    tl.call(() => tile.classList.add('is-in'), undefined, start + 0.46);
    release(tile, start + 0.1);

    const title = tile.querySelector<HTMLElement>('[data-trace]');
    const writer = developers[i % developers.length];
    if (title && writer) {
      const result = kit.trace(title, start + 0.12, [writer], { span: 0.3 });
      end = Math.max(end, result.end);
    }
    const chips = [...tile.querySelectorAll<HTMLElement>('li')];
    if (chips.length) {
      kit.keep(chips);
      gsap.set(chips, { opacity: 0, scale: 0.7 });
      tl.to(chips, { opacity: 1, scale: 1, duration: 0.2, ease: 'back.out(2.2)', stagger: 0.03 }, start + 0.36);
      const placer = architects[i % architects.length];
      const chip = chips[chips.length - 1];
      if (placer && chip) {
        const c = docRect(chip);
        kit.go(placer, c.x + c.w / 2, c.y + c.h, start + 0.3, 0.22);
      }
      end = Math.max(end, start + 0.36 + chips.length * 0.03 + 0.2);
    }
    end = Math.max(end, start + 0.46);
  });
  reveals.forEach((el, i) => {
    const r = docRect(el);
    // El siguiente bloque llega antes de que el anterior termine: una ola, no una fila.
    const at = paintAt + 0.8 * (1 - 0.88 ** i);
    const painter = designers[i % designers.length];
    if (painter) kit.go(painter, r.x + r.w * 0.7, r.y + Math.min(r.h, 80), at - 0.16, 0.16);
    tl.call(() => el.classList.add('is-in'), undefined, at);
    release(el, at);
    end = Math.max(end, at);
  });
  for (const el of frames.keys()) {
    if (!el.classList.contains('reveal') && !el.hasAttribute('data-trace') && !painted.includes(el as HTMLElement)) release(el, end);
  }
  end = Math.max(end, cursor);

  // QA: revisa de verdad, con el contraste calculado del DOM.
  const qaAt = end + 0.12;
  tl.call(() => announce('qa'), undefined, qaAt);
  const checked = lastTraced ?? reveals[0];
  const reviewer = reviewers[0];
  if (checked && reviewer) {
    const r = docRect(checked);
    const x = Math.min(r.x + r.w + 10, innerWidth - 90);
    kit.go(reviewer, x, r.y + 22, qaAt - 0.18, 0.18);
    kit.spotlight(reviewer, qaAt);
    kit.note(x, r.y + 4, `${contrast(checked).toFixed(1)}:1 ok`, qaAt + 0.02, 0.4);
  }
  const second = reviewers[1];
  const lastBlock = reveals[reveals.length - 1] ?? painted[painted.length - 1];
  if (second && lastBlock) {
    const r = docRect(lastBlock);
    kit.go(second, r.x + 12, r.y + r.h, qaAt - 0.1, 0.2);
  }

  // Deploy: go-live de la sección. Si tiene neón, arranca con su parpadeo.
  const liveAt = qaAt + 0.34;
  tl.call(() => announce('go-live'), undefined, liveAt);
  const live = [...section.querySelectorAll<HTMLElement>('[data-live]')].filter(visible);
  const center = docRect(live[0] ?? first ?? wrap);
  kit.go(deploy, center.x + center.w * 0.5, center.y + center.h * 0.6, liveAt - 0.22, 0.22);
  kit.spotlight(deploy, liveAt - 0.08);
  kit.ripple(center.x + center.w * 0.5, center.y + center.h * 0.6, liveAt);
  if (live.length) {
    kit.keep(live);
    gsap.set(live, { opacity: 0 });
    tl.to(live, { keyframes: { opacity: [0.001, 0.85, 0.3, 1, 0.6, 1], easeEach: 'none' }, duration: 0.74, ease: 'none' }, liveAt);
    // Lo trazado adentro espera a este momento: se enciende junto con su neón, no al terminar.
    const litText = live.flatMap((el) => [...el.querySelectorAll<HTMLElement>('[data-trace]')]);
    if (litText.length) {
      kit.keep(litText);
      tl.set(litText, { opacity: 1 }, liveAt);
    }
    if (liveTraces.length) tl.to(liveTraces, { alpha: 0, duration: 0.3 }, liveAt + 0.3);
  }

  // Vuelven a orbitar el cursor y queda la sección sola.
  comeHome(tl, crew, [...ctx.working], liveAt + (live.length ? 0.62 : 0.14));
  return tl;
}
