import type { RoleId } from '../../i18n/ui';
import type { Crew } from '../agents';
import type { Agent, Overlay } from '../../swarm/overlay';

export interface PlanContext {
  overlay: Overlay;
  crew: Crew;
  /** Quiénes salen de la órbita en este plan: al terminar, vuelven. */
  working: Set<Agent>;
  announce: (step: RoleId | 'go-live') => void;
  vectorsLabel: (n: number) => string;
  onCleanup: (fn: () => void) => void;
}
