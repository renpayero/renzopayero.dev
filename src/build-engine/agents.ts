import type { RoleId } from '../i18n/ui';
import type { Agent, Overlay } from './overlay';

/** Colores oficiales de Odoo más los neutros del sitio. Solo existen durante el build. */
const COLORS: Record<RoleId, string> = {
  relevamiento: '#d08bbd',
  arquitectura: '#f5f2f4',
  desarrollo: '#e4a900',
  diseno: '#e46e78',
  qa: '#8f8f8f',
  deploy: '#f7d4ee',
};

const CREW: Record<'desktop' | 'mobile', Record<RoleId, number>> = {
  desktop: { relevamiento: 3, arquitectura: 2, desarrollo: 4, diseno: 2, qa: 2, deploy: 1 },
  mobile: { relevamiento: 3, arquitectura: 1, desarrollo: 3, diseno: 1, qa: 1, deploy: 1 },
};

/** PRNG con semilla: el build se ve igual en cada corrida y se puede capturar cuadro a cuadro. */
export function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Crew {
  private readonly byRole = new Map<RoleId, Agent[]>();

  constructor(overlay: Overlay, labels: Record<RoleId, string>, random: () => number) {
    const crew = CREW[innerWidth < 768 ? 'mobile' : 'desktop'];
    for (const role of Object.keys(crew) as RoleId[]) {
      const group: Agent[] = [];
      for (let i = 0; i < crew[role]; i++) {
        const fromLeft = random() > 0.5;
        const agent: Agent = {
          x: fromLeft ? -24 : innerWidth + 24,
          y: scrollY + innerHeight * random(),
          alpha: 0,
          scale: 1,
          tag: 0,
          color: COLORS[role],
          name: labels[role],
        };
        group.push(agent);
        overlay.agents.push(agent);
      }
      this.byRole.set(role, group);
    }
  }

  get size(): number {
    let total = 0;
    for (const group of this.byRole.values()) total += group.length;
    return total;
  }

  get colors(): string[] {
    return Object.values(COLORS);
  }

  count(role: RoleId): number {
    return this.byRole.get(role)?.length ?? 0;
  }

  /** Reparte el trabajo entre los agentes del rol: en móvil hay menos y cada uno hace más. */
  pick(role: RoleId, index = 0): Agent {
    const group = this.byRole.get(role);
    const agent = group?.[index % group.length];
    if (!agent) throw new Error(`rol sin agentes: ${role}`);
    return agent;
  }

  get all(): Agent[] {
    return [...this.byRole.values()].flat();
  }
}

/** Arranque y frenado reales: ejes con curvas distintas para que la trayectoria sea un arco. */
export function travel(tl: gsap.core.Timeline, agent: Agent, x: number, y: number, at: number, duration = 0.45): void {
  tl.to(agent, { x, duration, ease: 'power2.inOut' }, at);
  tl.to(agent, { y, duration: duration * 0.9, ease: 'sine.inOut' }, at);
}
