import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { travel } from '../agents';
import { contrast, docRect } from '../dom';
import type { Agent, Frame, Note } from '../overlay';
import type { PlanContext } from './context';

const MAX_FRAMES = 7;

/**
 * Plan genérico de una sección, en el mismo orden que una entrega: medir, escribir, diseñar,
 * verificar y publicar. Solo toca lo que está por entrar en pantalla: lo demás lo revela el scroll.
 */
export function sectionPlan(section: HTMLElement, ctx: PlanContext): gsap.core.Timeline {
  const { overlay, crew, announce, onCleanup, dock, random } = ctx;
  const tl = gsap.timeline({ paused: true });
  const near = (el: Element): boolean => el.getBoundingClientRect().top < innerHeight * 1.05;
  const home = dock();

  // Solo entra quien tiene trabajo: en cada sección trabaja una parte del equipo.
  for (const agent of crew.all) agent.alpha = 0;
  const working = new Set<Agent>();
  const summon = (agent: Agent, at: number): Agent => {
    if (!working.has(agent)) {
      working.add(agent);
      agent.x = home.x + (random() - 0.5) * 80;
      agent.y = home.y;
      agent.scale = 1;
      agent.tag = 0;
      tl.to(agent, { alpha: 1, duration: 0.14 }, Math.max(0, at - 0.1));
    }
    return agent;
  };

  // Relevamiento
  tl.call(() => announce('relevamiento'), undefined, 0);
  const lead = summon(crew.pick('relevamiento', 0), 0.08);
  tl.to(lead, { tag: 1, duration: 0.14 }, 0.08);
  const measured = [...section.querySelectorAll('[data-frame]')].filter(near).slice(0, MAX_FRAMES);
  const frames = new Map<Element, Frame>();
  measured.forEach((el, i) => {
    const r = docRect(el);
    const frame: Frame = { ...r, grow: 0, alpha: 1, chip: 0, label: `${Math.round(r.w)} × ${Math.round(r.h)}` };
    overlay.frames.push(frame);
    frames.set(el, frame);
    const at = 0.22 + i * 0.09;
    const agent = summon(crew.pick('relevamiento', i), at - 0.2);
    travel(tl, agent, r.x, r.y, at - 0.2, 0.2);
    tl.to(agent, { x: r.x + r.w, y: r.y + r.h, duration: 0.26, ease: 'power2.inOut' }, at);
    tl.to(frame, { grow: 1, duration: 0.26, ease: 'power2.inOut' }, at);
    tl.to(frame, { chip: 1, duration: 0.12 }, at + 0.2);
  });

  const release = (el: Element, at: number): void => {
    const frame = frames.get(el);
    if (frame) tl.to(frame, { alpha: 0, duration: 0.28, ease: 'power1.out' }, at);
  };

  // Desarrollo: tipea los titulares reales.
  let cursor = 0.5;
  const typed = [...section.querySelectorAll<HTMLElement>('[data-type]')].filter(near).slice(0, 2);
  if (typed.length) tl.call(() => announce('desarrollo'), undefined, cursor);
  if (typed.length) tl.to(summon(crew.pick('desarrollo', 0), cursor), { tag: 1, duration: 0.14 }, cursor);
  tl.to(lead, { tag: 0, duration: 0.14 }, cursor);
  typed.forEach((el, n) => {
    const split = SplitText.create(el, { type: 'words,chars', aria: 'none' });
    onCleanup(() => {
      split.revert();
      gsap.set(el, { clearProps: 'all' });
    });
    gsap.set(el, { opacity: 1 });
    gsap.set(split.chars, { opacity: 0 });
    const typist = summon(crew.pick('desarrollo', n), cursor - 0.2);
    const span = gsap.utils.clamp(0.35, 0.8, split.chars.length * 0.014);
    const first = split.chars[0];
    if (first) {
      const r = docRect(first);
      travel(tl, typist, r.x, r.y + r.h, cursor - 0.2, 0.2);
    }
    split.chars.forEach((char, i) => {
      const at = cursor + span * (i / split.chars.length) ** 0.9;
      const r = docRect(char);
      tl.set(char, { opacity: 1 }, at);
      tl.set(typist, { x: r.x + r.w, y: r.y + r.h }, at);
    });
    release(el, cursor + span * 0.5);
    cursor += span * 0.8;
  });

  // Diseño: entregan los bloques, y la transición es la de Apple (CSS), no un tween.
  cursor = Math.max(cursor, 0.74);
  tl.call(() => announce('diseno'), undefined, cursor);
  tl.to(summon(crew.pick('diseno', 0), cursor), { tag: 1, duration: 0.14 }, cursor);
  if (typed.length) tl.to(crew.pick('desarrollo', 0), { tag: 0, duration: 0.14 }, cursor);
  const reveals = [...section.querySelectorAll<HTMLElement>('.reveal')].filter(near);
  reveals.forEach((el, i) => {
    const r = docRect(el);
    // El siguiente bloque llega antes que el anterior termine: una ola, no una fila.
    const at = cursor + 0.13 * (1 - 0.9 ** i) * 8;
    if (i < crew.count('diseno')) {
      travel(tl, summon(crew.pick('diseno', i), at - 0.18), r.x + r.w * 0.7, r.y + Math.min(r.h, 80), at - 0.18, 0.2);
    }
    tl.call(() => el.classList.add('is-in'), undefined, at);
    release(el, at);
  });
  for (const el of frames.keys()) {
    if (!el.classList.contains('reveal') && !el.hasAttribute('data-type')) release(el, cursor + 0.3);
  }
  const lastReveal = reveals.length ? cursor + 0.13 * (1 - 0.9 ** (reveals.length - 1)) * 8 : cursor;

  // QA: revisa de verdad, con el contraste calculado del DOM.
  const qaAt = lastReveal + 0.26;
  tl.call(() => announce('qa'), undefined, qaAt);
  const checked = typed[0] ?? reveals[0];
  if (checked) {
    const r = docRect(checked);
    const note: Note = {
      x: Math.min(r.x + r.w + 10, innerWidth - 80),
      y: r.y + 4,
      alpha: 0,
      text: `${contrast(checked).toFixed(1)}:1 ok`,
    };
    overlay.notes.push(note);
    travel(tl, summon(crew.pick('qa', 0), qaAt - 0.22), note.x, note.y + 18, qaAt - 0.22, 0.22);
    tl.to(crew.pick('qa', 0), { tag: 1, duration: 0.14 }, qaAt);
    tl.to(crew.pick('diseno', 0), { tag: 0, duration: 0.14 }, qaAt);
    tl.to(note, { alpha: 1, duration: 0.12 }, qaAt + 0.02);
    tl.to(note, { alpha: 0, duration: 0.2 }, qaAt + 0.42);
  }

  // Deploy: go-live de la sección. Si tiene neón, arranca con su parpadeo.
  const liveAt = qaAt + 0.4;
  tl.call(() => announce('go-live'), undefined, liveAt);
  const live = [...section.querySelectorAll<HTMLElement>('[data-live]')].filter(near);
  if (live.length) {
    const r = docRect(live[0] as HTMLElement);
    const deploy = summon(crew.pick('deploy', 0), liveAt - 0.3);
    travel(tl, deploy, r.x + r.w * 0.5, r.y + r.h * 0.6, liveAt - 0.3, 0.3);
    tl.to(deploy, { tag: 1, duration: 0.14 }, liveAt - 0.1);
    gsap.set(live, { opacity: 0.25 });
    tl.to(live, { keyframes: { opacity: [0.25, 0.85, 0.3, 1, 0.6, 1], easeEach: 'none' }, duration: 0.74, ease: 'none' }, liveAt);
    onCleanup(() => gsap.set(live, { clearProps: 'all' }));
  }

  // Vuelven al HUD y queda la sección sola.
  const exitAt = liveAt + (live.length ? 0.5 : 0.12);
  [...working].forEach((agent, i) => {
    const at = exitAt + (i % 5) * 0.025;
    tl.to(agent, { tag: 0, duration: 0.1 }, at);
    tl.to(agent, { x: home.x, y: home.y, scale: 0.6, duration: 0.36, ease: 'power2.in' }, at);
    tl.to(agent, { alpha: 0, duration: 0.12 }, at + 0.26);
  });

  return tl;
}
