import type { RoleId } from '../../i18n/ui';
import type { Crew } from '../agents';
import type { Overlay } from '../overlay';

export interface PlanContext {
  overlay: Overlay;
  crew: Crew;
  random: () => number;
  announce: (step: RoleId | 'go-live') => void;
  onCleanup: (fn: () => void) => void;
  /** Dónde descansan los agentes: el HUD, en coordenadas de documento. */
  dock: () => { x: number; y: number };
}
