import type { Lang } from './ui';

/**
 * Casos reales. Los datos técnicos están verificados contra cada repo; las cifras de marketing
 * de los sitios no se citan como resultados. DakoAgent no entra en la web (decisión de Renzo).
 */
export type Slug = 'legacy' | 'dakodev' | 'betina' | 'quantarax' | 'rodri';

export interface Decision {
  title: string;
  text: string;
}

export interface Project {
  slug: Slug;
  name: string;
  url: string;
  demo?: boolean;
  tagline: string;
  tone: string;
  summary: string;
  role: string;
  stack: string[];
  decisions: Decision[];
}

const LINKS: Record<Slug, string> = {
  legacy: 'https://legacyhairstudio.com/',
  dakodev: 'https://dakodev.com/',
  betina: 'https://www.betinadiluzio.com/',
  quantarax: 'https://quantarax.net/',
  rodri: 'https://rodri.dakodev.com/',
};

const STACKS: Record<Slug, string[]> = {
  legacy: ['Next.js 16', 'React 19', 'Prisma', 'PostgreSQL 18', 'Docker', 'Caddy', 'Vitest'],
  dakodev: ['Astro', 'GSAP', 'Tailwind CSS', 'Mercado Pago', 'Resend', 'Odoo', 'Docker'],
  betina: ['Astro 5', 'Node', 'Drizzle', 'PostgreSQL 16', 'Tailwind CSS', 'Vitest', 'Docker'],
  quantarax: ['Next.js 16', 'Tailwind CSS'],
  rodri: ['Astro 7', 'Preact', 'Nano Stores', 'Drizzle', 'PostgreSQL 18', 'PWA', 'Docker'],
};

const es: Project[] = [
  {
    slug: 'legacy',
    name: 'Legacy Hair Studio',
    url: LINKS.legacy,
    tagline: 'Reservás sin llamar.',
    tone: 'Y dos turnos no se pueden pisar.',
    summary:
      'Sistema de turnos para una barbería de Rosario: reserva online en tres pasos, sin cuenta ni seña, gestión del turno desde un enlace y un panel para que el local maneje su agenda.',
    role: 'Proyecto propio: diseño, desarrollo y despliegue.',
    stack: STACKS.legacy,
    decisions: [
      {
        title: 'La doble reserva es imposible',
        text: 'No lo chequea la aplicación: lo garantiza PostgreSQL con una restricción EXCLUDE USING gist. Un test dispara 10 reservas en paralelo contra la base real para probarlo.',
      },
      {
        title: 'Los avisos no se pierden',
        text: 'Outbox transaccional con FOR UPDATE SKIP LOCKED: el mail sale solo si el turno se guardó, y dos pasadas superpuestas no se pisan.',
      },
      {
        title: 'El calendario se mantiene al día',
        text: 'Cada turno genera su .ics con UID estable y SEQUENCE: si lo movés o lo cancelás, se actualiza en el calendario del cliente.',
      },
    ],
  },
  {
    slug: 'dakodev',
    name: 'Dakodev',
    url: LINKS.dakodev,
    tagline: 'Software que trabaja',
    tone: 'para que tu equipo trabaje menos.',
    summary:
      'La empresa que cofundé: ERP sobre Odoo, CRM, facturación electrónica con ARCA, software a medida e IA, con clientes en Estados Unidos, España, Pakistán y Argentina.',
    role: 'Cofundador.',
    stack: STACKS.dakodev,
    decisions: [
      {
        title: 'Cobros que no se pueden manipular',
        text: 'El precio se define en el servidor y el webhook de Mercado Pago valida la firma con HMAC y vuelve a consultar el pago antes de darlo por hecho.',
      },
      {
        title: 'Un CRM con WhatsApp adentro',
        text: 'Basado en Odoo, con el chat al lado del historial del cliente, IA en los flujos donde hace falta y tableros pensados para gerencia.',
      },
    ],
  },
  {
    slug: 'betina',
    name: 'Betina Di Luzio',
    url: LINKS.betina,
    demo: true,
    tagline: 'Cada punto, una historia.',
    tone: 'Una tienda para tejidos hechos a mano.',
    summary:
      'E-commerce para un taller de tejidos de Rosario, todavía en desarrollo: catálogo con filtros en la URL, carrito que cierra por WhatsApp y un panel para gestionar productos, stock y contenido. Las fotos son provisorias.',
    role: 'Proyecto propio: diseño, desarrollo y despliegue.',
    stack: STACKS.betina,
    decisions: [
      {
        title: 'Sin framework en el cliente',
        text: 'Renderizado en servidor con Astro y CSS propio: una tienda completa sin cargar una librería de UI en el navegador.',
      },
      {
        title: 'Seguridad por capas',
        text: 'Login con Argon2id, sesiones en base, cookies HttpOnly y SameSite, validación de origen propia y límites en cada subida de imágenes.',
      },
    ],
  },
  {
    slug: 'quantarax',
    name: 'QuantaraX',
    url: LINKS.quantarax,
    tagline: 'Comprá tecnología con datos,',
    tone: 'no con urgencias.',
    summary:
      'Sitio de una asesoría neutral de compras IT: servicios, planes, empresa y contacto, con un mensaje claro para decisiones que suelen tomarse apuradas.',
    role: 'Proyecto propio: diseño, desarrollo y despliegue.',
    stack: STACKS.quantarax,
    decisions: [
      {
        title: 'Rápido por construcción',
        text: 'Páginas prerenderizadas con Next.js 16: el visitante recibe HTML ya armado, servido desde caché.',
      },
    ],
  },
  {
    slug: 'rodri',
    name: 'Rodri Companion',
    url: LINKS.rodri,
    tagline: 'Una app para un solo jugador.',
    tone: 'Con la misma ingeniería que las demás.',
    summary:
      'Ayuda de juego para un clérigo de Pathfinder 1e: puntos de golpe, conjuros, recursos, buffs y dados, instalable como app. Los compañeros de mesa entran como invitados y ven todo sin poder cambiar nada.',
    role: 'Proyecto propio: diseño, desarrollo y despliegue.',
    stack: STACKS.rodri,
    decisions: [
      {
        title: 'Todo se puede deshacer',
        text: 'Cada acción es una transacción con bloqueo de fila que registra un evento: en plena partida, un error se revierte con un toque.',
      },
      {
        title: 'Las reglas son código',
        text: 'La ficha es estática y tipada, separada del estado de la partida. Las reglas son funciones puras con tests, y un script valida cada enlace a las reglas oficiales.',
      },
    ],
  },
];

const en: Project[] = [
  {
    slug: 'legacy',
    name: 'Legacy Hair Studio',
    url: LINKS.legacy,
    tagline: 'Book without calling.',
    tone: 'And two bookings can never overlap.',
    summary:
      'Booking system for a barbershop in Rosario: three-step online booking with no account or deposit, booking management from a link, and a panel for the shop to run its schedule.',
    role: 'My own project: design, development and deployment.',
    stack: STACKS.legacy,
    decisions: [
      {
        title: 'Double booking is impossible',
        text: 'The application does not check it: PostgreSQL guarantees it with an EXCLUDE USING gist constraint. A test fires 10 parallel bookings against the real database to prove it.',
      },
      {
        title: 'Notifications are not lost',
        text: 'Transactional outbox with FOR UPDATE SKIP LOCKED: the email only goes out if the booking was saved, and overlapping runs do not collide.',
      },
      {
        title: 'The calendar stays up to date',
        text: 'Each booking generates an .ics with a stable UID and SEQUENCE: move or cancel it and the customer calendar updates.',
      },
    ],
  },
  {
    slug: 'dakodev',
    name: 'Dakodev',
    url: LINKS.dakodev,
    tagline: 'Software that works',
    tone: 'so your team works less.',
    summary:
      'The company I co-founded: ERP on Odoo, CRM, electronic invoicing with ARCA, custom software and AI, with clients in the United States, Spain, Pakistan and Argentina.',
    role: 'Co-founder.',
    stack: STACKS.dakodev,
    decisions: [
      {
        title: 'Payments that cannot be tampered with',
        text: 'The price is set on the server, and the Mercado Pago webhook validates its HMAC signature and fetches the payment again before accepting it.',
      },
      {
        title: 'A CRM with WhatsApp inside',
        text: 'Built on Odoo, with the chat next to the customer history, AI in the flows where it helps and dashboards designed for management.',
      },
    ],
  },
  {
    slug: 'betina',
    name: 'Betina Di Luzio',
    url: LINKS.betina,
    demo: true,
    tagline: 'Every stitch, a story.',
    tone: 'A store for hand-knit pieces.',
    summary:
      'E-commerce for a knitwear workshop in Rosario, still in development: catalog with filters in the URL, a cart that closes on WhatsApp and a panel to manage products, stock and content. The photos are placeholders.',
    role: 'My own project: design, development and deployment.',
    stack: STACKS.betina,
    decisions: [
      {
        title: 'No framework on the client',
        text: 'Server rendering with Astro and hand-written CSS: a full store without shipping a UI library to the browser.',
      },
      {
        title: 'Security in layers',
        text: 'Argon2id login, database sessions, HttpOnly and SameSite cookies, custom origin validation and limits on every image upload.',
      },
    ],
  },
  {
    slug: 'quantarax',
    name: 'QuantaraX',
    url: LINKS.quantarax,
    tagline: 'Buy technology with data,',
    tone: 'not with urgency.',
    summary:
      'Website for a neutral IT procurement advisory: services, plans, company and contact, with a clear message for decisions that are usually rushed.',
    role: 'My own project: design, development and deployment.',
    stack: STACKS.quantarax,
    decisions: [
      {
        title: 'Fast by construction',
        text: 'Pages prerendered with Next.js 16: visitors get ready-made HTML, served from cache.',
      },
    ],
  },
  {
    slug: 'rodri',
    name: 'Rodri Companion',
    url: LINKS.rodri,
    tagline: 'An app for a single player.',
    tone: 'With the same engineering as the others.',
    summary:
      'Game companion for a Pathfinder 1e cleric: hit points, spells, resources, buffs and dice, installable as an app. Tablemates join as guests and see everything without being able to change it.',
    role: 'My own project: design, development and deployment.',
    stack: STACKS.rodri,
    decisions: [
      {
        title: 'Everything can be undone',
        text: 'Each action is a transaction with a row lock that records an event: mid-game, a mistake is reverted with one tap.',
      },
      {
        title: 'The rules are code',
        text: 'The sheet is static and typed, separate from the game state. Rules are pure functions with tests, and a script validates every link to the official rules.',
      },
    ],
  },
];

export const projects: Record<Lang, Project[]> = { es, en };

export const projectUi = {
  es: {
    title: 'Proyectos reales.',
    tone: 'Con usuarios, datos y decisiones difíciles.',
    open: 'Ver caso',
    demo: 'Demo en desarrollo',
    pause: 'Pausar',
    play: 'Reproducir',
    goTo: (name: string) => `Ir a ${name}`,
    role: 'Mi rol',
    stack: 'Stack',
    decisions: 'Decisiones que importan',
    visit: 'Abrir el sitio',
    next: 'Siguiente proyecto',
    back: 'Todos los proyectos',
    gallery: 'Galería de proyectos',
  },
  en: {
    title: 'Real projects.',
    tone: 'With users, data and hard decisions.',
    open: 'See case',
    demo: 'Demo in development',
    pause: 'Pause',
    play: 'Play',
    goTo: (name: string) => `Go to ${name}`,
    role: 'My role',
    stack: 'Stack',
    decisions: 'Decisions that matter',
    visit: 'Open the site',
    next: 'Next project',
    back: 'All projects',
    gallery: 'Project gallery',
  },
} as const;
