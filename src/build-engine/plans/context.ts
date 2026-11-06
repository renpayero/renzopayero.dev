import type { RoleId } from '../../i18n/ui';
import type { Crew } from '../agents';
import type { Overlay } from '../../swarm/overlay';

export interface PlanContext {
  overlay: Overlay;
  crew: Crew;
  announce: (step: RoleId | 'go-live') => void;
  onCleanup: (fn: () => void) => void;
}
