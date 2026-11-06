import type { RoleId } from '../i18n/ui';
import type { Agent } from '../swarm/overlay';
import type { Swarm } from '../swarm/swarm';

/** El equipo del build: son los mismos agentes del enjambre, agrupados por oficio. */
export class Crew {
  private readonly byRole = new Map<RoleId, Agent[]>();

  constructor(readonly swarm: Swarm) {
    for (const agent of swarm.agents) {
      const group = this.byRole.get(agent.role) ?? [];
      group.push(agent);
      this.byRole.set(agent.role, group);
    }
  }

  get size(): number {
    return this.swarm.agents.length;
  }

  get colors(): string[] {
    return [...this.byRole.values()].map((group) => group[0]?.color ?? '#f5f2f4');
  }

  get all(): Agent[] {
    return this.swarm.agents;
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
}

/**
 * Sale de la órbita hacia su tarea. Arranque y frenado reales, con curvas distintas por eje
 * para que la trayectoria sea un arco y no una línea.
 */
export function travel(
  tl: gsap.core.Timeline,
  crew: Crew,
  agent: Agent,
  x: number,
  y: number,
  at: number,
  duration = 0.45,
): void {
  tl.call(() => crew.swarm.borrow(agent), undefined, at);
  tl.to(agent, { x, duration, ease: 'power2.inOut' }, at);
  tl.to(agent, { y, duration: duration * 0.9, ease: 'sine.inOut' }, at);
}

/** Terminó: vuelven a orbitar el cursor de a poco, no todos en el mismo instante. */
export function comeHome(tl: gsap.core.Timeline, crew: Crew, agents: Agent[], at: number): void {
  agents.forEach((agent, i) => {
    tl.call(() => crew.swarm.release(agent), undefined, at + (i % 5) * 0.035 + i * 0.012);
  });
}
