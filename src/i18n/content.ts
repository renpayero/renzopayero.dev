import type { Lang } from './ui';

/** Todo sale del CV y de LinkedIn. Si no está ahí, no va acá. */

export interface Commit {
  when: string;
  title: string;
  org: string;
  text?: string;
}

export const content = {
  es: {
    manifesto: {
      statement: 'Trabajo donde los procesos de negocio se encuentran con el código.',
      detail:
        'Lidero el área de sistemas de un fabricante líder de muebles de baño en Argentina y trabajé en proyectos Odoo para empresas de Estados Unidos, España, Pakistán y Argentina.',
    },
    system: {
      title: 'Una empresa es un solo sistema.',
      tone: 'Yo lo armo de punta a punta.',
      lead: 'Relevamiento, configuración funcional, módulos a medida en Python y OWL, integraciones y salida a producción.',
      core: 'Odoo',
      nodes: ['Ventas', 'Compras', 'Producción', 'Stock', 'Facturación', 'Tableros'],
      links: ['Salesforce', 'Cálculo de costos', 'Shopify', 'TiendaNube', 'ARCA', 'Agentes de IA'],
      stats: [
        { value: '80', label: 'usuarios en el ERP que lidero' },
        { value: 'v13 a v20', label: 'de Odoo, en desarrollo y consultoría' },
        { value: '4 países', label: 'con clientes: EE.UU., España, Pakistán y Argentina' },
      ],
    },
    experience: {
      title: 'Mi carrera, como un repositorio.',
      tone: 'Cada rol es una rama. Tres siguen activas.',
      now: 'Hoy',
      active: 'Dakodev, Banwood y Schneider siguen en curso.',
      commits: [
        { when: '2019', title: 'Empecé a estudiar sistemas', org: 'UAI y UNNOBA' },
        {
          when: 'Ene 2024',
          title: 'Cofundador',
          org: 'Dakodev',
          text: 'Implementaciones Odoo de punta a punta, sistemas a medida, automatizaciones e IA. Clientes en EE.UU., España, Pakistán y Argentina.',
        },
        {
          when: 'Ene 2024',
          title: 'Desarrollador Odoo, Project Manager y Team Leader',
          org: 'HC Sinergia',
          text: 'Lideré un equipo de 3 desarrolladores: alcance, plazos y coordinación ágil. Odoo 17 y 18.',
        },
        { when: '2024', title: 'Analista en Sistemas', org: 'UNNOBA' },
        { when: '2025', title: 'Ingeniero en Sistemas', org: 'UAI' },
        {
          when: 'Feb 2026',
          title: 'Responsable de Odoo/ERP + IA',
          org: 'Banwood',
          text: 'ERP de punta a punta e IA aplicada a procesos. Integraciones con Shopify, TiendaNube, Anthropic y Salesforce. MCP, RAG, LangGraph y pgvector.',
        },
        {
          when: 'Feb 2026',
          title: 'Sr. Odoo Developer y AI Tooling Lead',
          org: 'Odoo Concept',
          text: 'Lideré la adopción de Claude Code y los estándares de trabajo con IA del equipo de desarrollo.',
        },
        {
          when: 'Feb 2026',
          title: 'Sr. Consultor Técnico e Implementador Odoo',
          org: 'GiGa Global Gold Partner',
          text: 'Relevamiento, diseño de soluciones, módulos a medida, integraciones y soporte de implementación.',
        },
        {
          when: 'Jun 2026',
          title: 'Jefe de Sistemas',
          org: 'Schneider SRL',
          text: 'Lidero sistemas y el ERP Odoo para 80 usuarios, con desarrollos en Python que redujeron la dependencia de proveedores. AWS, PostgreSQL, Docker y Linux.',
        },
      ] satisfies Commit[],
    },
    capabilities: {
      title: 'Lo que traigo a un equipo.',
      tiles: {
        odoo: {
          title: 'Odoo',
          text: 'De la v13 a la v20. Relevamiento, configuración, módulos a medida e implementación.',
          items: ['Python', 'OWL', 'QWeb', 'XML', 'XML-RPC', 'PostgreSQL'],
        },
        ai: {
          title: 'IA aplicada',
          text: 'Agentes conectados al ERP y automatizaciones que resuelven procesos reales.',
          items: ['Anthropic', 'OpenAI', 'MCP', 'RAG', 'LangGraph', 'pgvector'],
        },
        web: {
          title: 'Web',
          text: 'Interfaces de alto rendimiento y sistemas a medida.',
          items: ['Astro', 'Next.js', 'React', 'Tailwind CSS', 'Laravel'],
        },
        infra: {
          title: 'Infraestructura',
          text: 'Despliegues y operación de lo que construyo.',
          items: ['AWS', 'Docker', 'Linux', 'Git Flow'],
        },
        lead: {
          title: 'Liderazgo',
          text: 'Fui Project Manager y Team Leader. Hoy, Jefe de Sistemas. Inglés C1.',
          items: ['Scrum', 'Kanban'],
        },
      },
    },
    contact: {
      title: 'Hablemos.',
      text: 'Si tenés un proyecto, un equipo o un proceso que no cierra, escribime.',
      write: 'Escribime',
      cvEs: 'CV en español',
      cvEn: 'CV en inglés',
      linkedin: 'LinkedIn',
      dakodev: 'Dakodev',
      legal: 'Odoo es una marca de Odoo S.A. Este sitio no está afiliado a Odoo.',
      place: 'Rosario, Argentina',
    },
    projects: { title: 'Proyectos' },
  },
  en: {
    manifesto: {
      statement: 'I work where business processes meet code.',
      detail:
        "I lead the IT area at a leading bathroom furniture manufacturer in Argentina, and I've delivered Odoo projects for companies in the United States, Spain, Pakistan and Argentina.",
    },
    system: {
      title: 'A company is one system.',
      tone: 'I build it end to end.',
      lead: 'Requirements, functional setup, custom Python and OWL modules, integrations and go-live support.',
      core: 'Odoo',
      nodes: ['Sales', 'Purchasing', 'Manufacturing', 'Inventory', 'Invoicing', 'Dashboards'],
      links: ['Salesforce', 'Cost calculation', 'Shopify', 'TiendaNube', 'ARCA', 'AI agents'],
      stats: [
        { value: '80', label: 'users on the ERP I lead' },
        { value: 'v13 to v20', label: 'of Odoo, in development and consulting' },
        { value: '4 countries', label: 'with clients: US, Spain, Pakistan and Argentina' },
      ],
    },
    experience: {
      title: 'My career, as a repository.',
      tone: 'Every role is a branch. Three are still active.',
      now: 'Today',
      active: 'Dakodev, Banwood and Schneider are ongoing.',
      commits: [
        { when: '2019', title: 'Started studying systems', org: 'UAI and UNNOBA' },
        {
          when: 'Jan 2024',
          title: 'Co-Founder',
          org: 'Dakodev',
          text: 'End-to-end Odoo, custom software, automation and AI. Clients in the US, Spain, Pakistan and Argentina.',
        },
        {
          when: 'Jan 2024',
          title: 'Odoo Developer, Project Manager and Team Leader',
          org: 'HC Sinergia',
          text: 'Led a team of 3 developers, owning scope, timelines and agile coordination. Odoo 17 and 18.',
        },
        { when: '2024', title: 'Systems Analyst', org: 'UNNOBA' },
        { when: '2025', title: 'Systems Engineer', org: 'UAI' },
        {
          when: 'Feb 2026',
          title: 'Odoo/ERP + AI Lead',
          org: 'Banwood',
          text: 'End-to-end ERP and AI applied to business processes. Shopify, TiendaNube, Anthropic and Salesforce integrations. MCP, RAG, LangGraph and pgvector.',
        },
        {
          when: 'Feb 2026',
          title: 'Sr. Odoo Developer and AI Tooling Lead',
          org: 'Odoo Concept',
          text: 'Led Claude Code adoption and AI-assisted development standards for the dev team.',
        },
        {
          when: 'Feb 2026',
          title: 'Sr. Technical Consultant and Odoo Implementer',
          org: 'GiGa Global Gold Partner',
          text: 'Requirements gathering, solution design, custom modules, integrations and implementation support.',
        },
        {
          when: 'Jun 2026',
          title: 'Head of IT',
          org: 'Schneider SRL',
          text: 'I lead IT and the Odoo ERP for 80 users, with custom Python developments that cut vendor dependence. AWS, PostgreSQL, Docker and Linux.',
        },
      ] satisfies Commit[],
    },
    capabilities: {
      title: 'What I bring to a team.',
      tiles: {
        odoo: {
          title: 'Odoo',
          text: 'From v13 to v20. Requirements, setup, custom modules and implementation.',
          items: ['Python', 'OWL', 'QWeb', 'XML', 'XML-RPC', 'PostgreSQL'],
        },
        ai: {
          title: 'Applied AI',
          text: 'Agents connected to the ERP and automation that solves real processes.',
          items: ['Anthropic', 'OpenAI', 'MCP', 'RAG', 'LangGraph', 'pgvector'],
        },
        web: {
          title: 'Web',
          text: 'High-performance interfaces and custom systems.',
          items: ['Astro', 'Next.js', 'React', 'Tailwind CSS', 'Laravel'],
        },
        infra: {
          title: 'Infrastructure',
          text: 'Deploying and running what I build.',
          items: ['AWS', 'Docker', 'Linux', 'Git Flow'],
        },
        lead: {
          title: 'Leadership',
          text: 'Former Project Manager and Team Leader, currently Head of IT. English C1.',
          items: ['Scrum', 'Kanban'],
        },
      },
    },
    contact: {
      title: "Let's talk.",
      text: 'If you have a project, a team or a process that does not add up, write to me.',
      write: 'Write to me',
      cvEs: 'CV in Spanish',
      cvEn: 'CV in English',
      linkedin: 'LinkedIn',
      dakodev: 'Dakodev',
      legal: 'Odoo is a trademark of Odoo S.A. This site is not affiliated with Odoo.',
      place: 'Rosario, Argentina',
    },
    projects: { title: 'Projects' },
  },
} as const satisfies Record<Lang, unknown>;
