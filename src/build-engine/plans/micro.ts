import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { comeHome } from '../agents';
import { docRect } from '../dom';
import { Kit } from '../kit';
import type { Agent } from '../../swarm/overlay';
import type { PlanContext } from './context';

/**
 * Una fila que entra en pantalla: dos agentes se despegan de la órbita, marcan el commit, escriben
 * el título y vuelven. Corre aparte de la sección, porque las filas llegan al ritmo del scroll.
 */
export function microPlan(row: HTMLElement, ctx: PlanContext, agents: Agent[]): gsap.core.Timeline {
  const tl = gsap.timeline({ paused: true });
  const kit = new Kit(tl, ctx);
  const body = row.querySelector<HTMLElement>('.reveal');
  const dot = row.querySelector<HTMLElement>('.git__dot');
  const title = row.querySelector<HTMLElement>('h3, .git__now');
  const [marker, writer] = agents;
  if (!marker || !body) {
    tl.call(() => body?.classList.add('is-in'), undefined, 0);
    return tl;
  }

  // El commit: el agente baja por el carril y lo marca.
  const graph = docRect(row);
  const d = dot ? docRect(dot) : { x: graph.x + 12, y: graph.y + 34, w: 0, h: 0 };
  const arrive = kit.go(marker, d.x + d.w / 2, graph.y, 0, 0.14);
  kit.sweep(marker, d.x + d.w / 2, d.y + d.h / 2, arrive, 0.14);
  kit.ripple(d.x + d.w / 2, d.y + d.h / 2, arrive + 0.14);

  // El marco del bloque y su medida real.
  const typist = writer ?? marker;
  const { frame, end } = kit.frame(body, 0.14, typist, Boolean(writer));
  kit.dismiss(frame, end + 0.22);

  tl.call(() => body.classList.add('is-in'), undefined, end - 0.1);
  if (title) {
    // El título se escribe a toda velocidad, con el agente como cursor.
    const split = SplitText.create(title, { type: 'chars', aria: 'none' });
    ctx.onCleanup(() => split.revert());
    gsap.set(split.chars, { opacity: 0 });
    const span = gsap.utils.clamp(0.16, 0.36, split.chars.length * 0.009);
    const start = end - 0.08;
    split.chars.forEach((char, i) => {
      const at = start + span * (i / split.chars.length);
      const r = docRect(char);
      tl.set(char, { opacity: 1 }, at);
      tl.set(typist, { x: r.x + r.w, y: r.y + r.h }, at);
    });
    comeHome(tl, ctx.crew, agents, start + span + 0.1);
  } else {
    comeHome(tl, ctx.crew, agents, end + 0.1);
  }
  return tl;
}
