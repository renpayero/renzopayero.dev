import type { Lang } from './ui';

export const howBuilt = {
  es: {
    title: 'A este sitio lo construyeron agentes.',
    tone: 'De verdad.',
    text: 'Lo dirigí con Claude Code: agentes que investigan, escriben, prueban y corrigen, y yo decidiendo. Es mi forma de trabajar. Lo que orbita tu cursor es esa idea hecha interfaz.',
    watch: 'Ver el build completo',
    metrics: [
      { id: 'lcp', label: 'de LCP, medido ahora en tu navegador' },
      { id: 'js', label: 'de JavaScript comprimido en todo el sitio' },
      { id: 'commits', label: 'commits en este repositorio' },
      { id: 'tests', label: 'pruebas por navegador y ancho de pantalla' },
    ],
  },
  en: {
    title: 'Agents built this site.',
    tone: 'For real.',
    text: 'I directed it with Claude Code: agents that research, write, test and fix, while I make the decisions. It is how I work. What orbits your cursor is that idea turned into an interface.',
    watch: 'Watch the full build',
    metrics: [
      { id: 'lcp', label: 'of LCP, measured just now in your browser' },
      { id: 'js', label: 'of compressed JavaScript across the site' },
      { id: 'commits', label: 'commits in this repository' },
      { id: 'tests', label: 'tests per browser and screen width' },
    ],
  },
} as const satisfies Record<Lang, unknown>;
