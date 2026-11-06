import gsap from 'gsap';
import { comeHome } from '../agents';
import { docRect, need } from '../dom';
import { Kit } from '../kit';
import type { PlanContext } from './context';

/**
 * El sistema lo construye el equipo, sin depender del scroll: compás y guías primero, el círculo de
 * Odoo con sus vectores, un cable por módulo y cada integración. Al final Deploy enciende el neón.
 */
export function systemPlan(scene: HTMLElement, ctx: PlanContext): gsap.core.Timeline {
  const { crew, announce, onCleanup, overlay } = ctx;
  const tl = gsap.timeline({ paused: true });
  const kit = new Kit(tl, ctx);

  const stage = need<HTMLElement>(scene, '.system__stage');
  const core = need<HTMLElement>(scene, '.system__core');
  const label = need<HTMLElement>(scene, '.system__core-label');
  const glow = need<HTMLElement>(scene, '.system__glow');
  const nodes = [...scene.querySelectorAll<HTMLElement>('.system__node')];
  const links = [...scene.querySelectorAll<HTMLElement>('.system__link')];
  const wires = [...scene.querySelectorAll<SVGLineElement>('.wire:not(.wire--link)')];
  const linkWires = [...scene.querySelectorAll<SVGLineElement>('.wire--link')];
  const stats = [...scene.querySelectorAll<HTMLElement>('.system__stat')];

  kit.keep([core, label, glow, ...nodes, ...links, ...stats, ...wires, ...linkWires]);

  // La escena queda fija mientras se scrollea: todo lo dibujado acompaña al escenario.
  overlay.setAnchor(stage);
  onCleanup(() => overlay.setAnchor(null));

  const r = docRect(stage);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const centerOf = (el: Element): { x: number; y: number } => {
    const b = docRect(el);
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  };
  const inner = nodes[0] ? Math.hypot(centerOf(nodes[0]).x - cx, centerOf(nodes[0]).y - cy) : r.w * 0.29;
  const outer = links[0] ? Math.hypot(centerOf(links[0]).x - cx, centerOf(links[0]).y - cy) : r.w * 0.44;
  const coreRadius = docRect(core).w / 2;

  const pick = (role: Parameters<typeof crew.pick>[0], i: number) => crew.pick(role, i);

  // Arquitectura: ejes y compás. Acá se calcula dónde va cada cosa.
  tl.call(() => announce('arquitectura'), undefined, 0);
  kit.spotlight(pick('arquitectura', 0), 0.05);
  kit.guide({ x1: r.x - 20, y1: cy, x2: r.x + r.w + 20, y2: cy }, 0.12, pick('arquitectura', 0), 2.3, 0.3);
  kit.guide({ x1: cx, y1: r.y + r.h + 20, x2: cx, y2: r.y - 20 }, 0.18, crew.count('arquitectura') > 1 ? pick('arquitectura', 1) : null, 2.3, 0.3);
  kit.compass(cx, cy, inner, 0.5, pick('relevamiento', 0), 0.5, 1.8);
  kit.note(cx + inner + 6, cy - 22, `r ${Math.round(inner)}`, 0.56, 1);
  kit.compass(cx, cy, outer, 0.62, pick('relevamiento', 1), 0.56, 1.7);
  kit.note(cx + outer + 6, cy + 6, `r ${Math.round(outer)}`, 0.7, 1);

  // Relevamiento: una guía por módulo, en su ángulo real.
  nodes.forEach((node, i) => {
    const c = centerOf(node);
    kit.guide({ x1: cx, y1: cy, x2: c.x, y2: c.y }, 0.72 + i * 0.03, null, 1.5, 0.14);
    if (i < 2) {
      const degrees = (Math.round((Math.atan2(c.x - cx, cy - c.y) * 180) / Math.PI) + 360) % 360;
      kit.note(c.x + 8, c.y - 26, `${degrees}°`, 0.84 + i * 0.06, 0.6);
    }
  });

  // Desarrollo: el centro, con sus vectores.
  tl.call(() => announce('desarrollo'), undefined, 0.98);
  const builder = pick('desarrollo', 0);
  kit.spotlight(builder, 0.98);
  kit.compass(cx, cy, coreRadius, 1.0, builder, 0.34, 0.1);
  tl.fromTo(core, { opacity: 0, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'entrada' }, 1.26);
  const traced = kit.trace(label, 1.34, [pick('desarrollo', 1)], { span: 0.34 });

  // Un cable por módulo: el agente sale del centro y tira la línea hasta que llega.
  const developers = [0, 1, 2, 3].map((i) => pick('desarrollo', i));
  let at = 1.56;
  wires.forEach((wire, i) => {
    const node = nodes[i];
    const agent = developers[i % developers.length];
    if (!node || !agent) return;
    const c = centerOf(node);
    const start = kit.go(agent, cx, cy, at, 0.1);
    kit.sweep(agent, c.x, c.y, start, 0.2);
    tl.to(wire, { strokeDashoffset: 0, duration: 0.2, ease: 'power2.inOut' }, start);
    tl.fromTo(node, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.2, ease: 'back.out(2.4)' }, start + 0.16);
    at += 0.075;
  });

  // Diseño: cada integración sale del módulo con el que se conecta.
  const linkAt = at + 0.24;
  tl.call(() => announce('diseno'), undefined, linkAt);
  const designers = [0, 1].map((i) => pick('diseno', i));
  kit.spotlight(pick('diseno', 0), linkAt);
  links.forEach((link, i) => {
    const wire = linkWires[i];
    const agent = designers[i % designers.length];
    if (!wire || !agent) return;
    const c = centerOf(link);
    const from = {
      x: r.x + (Number(wire.getAttribute('x1')) / 100) * r.w,
      y: r.y + (Number(wire.getAttribute('y1')) / 100) * r.h,
    };
    const start = kit.go(agent, from.x, from.y, linkAt + i * 0.04, 0.12);
    kit.sweep(agent, c.x, c.y, start, 0.16);
    tl.to(wire, { strokeDashoffset: 0, duration: 0.16, ease: 'power2.inOut' }, start);
    tl.fromTo(link, { opacity: 0 }, { opacity: 1, duration: 0.16 }, start + 0.1);
  });
  const qaAt = linkAt + links.length * 0.1 + 0.2;

  // QA: los números salen del DOM.
  tl.call(() => announce('qa'), undefined, qaAt);
  const reviewer = pick('qa', 0);
  kit.go(reviewer, cx + coreRadius + 8, cy + 18, qaAt - 0.16, 0.16);
  kit.spotlight(reviewer, qaAt);
  kit.note(cx + coreRadius + 8, cy + 2, `${nodes.length} + ${links.length} ok`, qaAt + 0.02, 0.4);

  // Deploy: go-live. El neón del centro arranca con su parpadeo.
  const liveAt = qaAt + 0.32;
  tl.call(() => announce('go-live'), undefined, liveAt);
  const deploy = pick('deploy', 0);
  kit.go(deploy, cx, cy - coreRadius, liveAt - 0.22, 0.22);
  kit.spotlight(deploy, liveAt - 0.08);
  kit.ripple(cx, cy, liveAt + 0.1);
  tl.to(glow, { keyframes: { opacity: [0, 0.8, 0.2, 1, 0.55, 1], easeEach: 'none' }, duration: 0.72, ease: 'none' }, liveAt);

  // Los datos entran por último, con su agente, cuando el sistema ya está encendido.
  const statsAt = liveAt + 0.34;
  stats.forEach((stat, i) => {
    const at2 = statsAt + i * 0.12;
    tl.fromTo(stat, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, ease: 'entrada' }, at2);
    const agent = pick('qa', 1 + i);
    const b = docRect(stat);
    kit.go(agent, b.x + b.w * 0.6, b.y + 14, at2 - 0.16, 0.16);
  });

  void traced;
  comeHome(tl, crew, [...ctx.working], statsAt + stats.length * 0.12 + 0.1);
  return tl;
}
