import type { RoleId } from '../i18n/ui';

/** Colores oficiales de Odoo más los neutros del sitio. */
export const COLORS: Record<RoleId, string> = {
  relevamiento: '#d08bbd',
  arquitectura: '#f5f2f4',
  desarrollo: '#e4a900',
  diseno: '#e46e78',
  qa: '#8f8f8f',
  deploy: '#f7d4ee',
};

export const CREW: Record<'desktop' | 'mobile', Record<RoleId, number>> = {
  desktop: { relevamiento: 3, arquitectura: 2, desarrollo: 4, diseno: 2, qa: 2, deploy: 1 },
  mobile: { relevamiento: 3, arquitectura: 1, desarrollo: 3, diseno: 1, qa: 1, deploy: 1 },
};

/** Coincide con la media query de la terminal: `max-width: 767px` es móvil. */
export const crewFor = (width: number): Record<RoleId, number> => CREW[width < 768 ? 'mobile' : 'desktop'];

export const crewSize = (crew: Record<RoleId, number>): number => Object.values(crew).reduce((sum, n) => sum + n, 0);
