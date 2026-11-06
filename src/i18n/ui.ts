export const LANGS = ['es', 'en'] as const;
export type Lang = (typeof LANGS)[number];

export const ui = {
  es: {
    meta: {
      title: 'Renzo Payero. Ingeniero en Sistemas',
      description:
        'Ingeniero en Sistemas de Rosario, Argentina. Odoo de punta a punta, software a medida y agentes de IA para empresas reales.',
    },
    skip: 'Saltar al contenido',
    nav: { projects: 'Proyectos', experience: 'Experiencia', contact: 'Hablemos', label: 'Principal', sticky: 'Accesos rápidos', other: 'English' },
    hero: {
      role: 'Ingeniero en Sistemas.',
      focus: 'Odoo, software a medida y agentes de IA para empresas reales.',
      portraitAlt: 'Retrato de Renzo Payero',
      seeProjects: 'Ver proyectos',
      talk: 'Hablemos',
    },
    hud: {
      label: 'Construcción de la página',
      pause: 'Pausar',
      play: 'Seguir',
      skip: 'Saltar',
      replay: 'Volver a construir',
      agents: 'agentes',
      built: (n: number, s: string) => `Construido por ${n} agentes en ${s} s`,
      progress: (done: number, total: number) => `${done} de ${total} secciones`,
      goLive: 'Go-live',
    },
    roles: {
      relevamiento: 'Relevamiento',
      arquitectura: 'Arquitectura',
      desarrollo: 'Desarrollo',
      diseno: 'Diseño',
      qa: 'QA',
      deploy: 'Deploy',
    },
  },
  en: {
    meta: {
      title: 'Renzo Payero. Systems Engineer',
      description:
        'Systems engineer from Rosario, Argentina. End-to-end Odoo, custom software and AI agents for real businesses.',
    },
    skip: 'Skip to content',
    nav: { projects: 'Projects', experience: 'Experience', contact: "Let's talk", label: 'Main', sticky: 'Quick links', other: 'Español' },
    hero: {
      role: 'Systems engineer.',
      focus: 'Odoo, custom software and AI agents for real businesses.',
      portraitAlt: 'Portrait of Renzo Payero',
      seeProjects: 'See projects',
      talk: "Let's talk",
    },
    hud: {
      label: 'Page build',
      pause: 'Pause',
      play: 'Resume',
      skip: 'Skip',
      replay: 'Build it again',
      agents: 'agents',
      built: (n: number, s: string) => `Built by ${n} agents in ${s} s`,
      progress: (done: number, total: number) => `${done} of ${total} sections`,
      goLive: 'Go-live',
    },
    roles: {
      relevamiento: 'Discovery',
      arquitectura: 'Architecture',
      desarrollo: 'Development',
      diseno: 'Design',
      qa: 'QA',
      deploy: 'Deploy',
    },
  },
} as const;

export type RoleId = keyof (typeof ui)['es']['roles'];
