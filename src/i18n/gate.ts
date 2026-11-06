import type { Lang, RoleId } from './ui';

/** El agente y el modelo que muestra la terminal. Sin versión a propósito: así nunca queda desactualizado. */
export const AGENT = 'Claude Code';
export const MODEL: Record<Lang, string> = { es: "Renzo's IA", en: "Renzo's AI" };
export const EFFORT = 'with max effort · ultracode';
export const PATH = '~/renzo-payero/portfolio';

export type BuildMode = 'present' | 'manual' | 'final';

interface Option<T extends string> {
  value: T;
  label: string;
  note?: string;
  /** `{n}` es la cantidad real de agentes: 14 en escritorio, 10 en móvil. */
  desc: string;
}

interface GateText {
  label: string;
  effortOut: string;
  modelOut: [string, string];
  prompt: string;
  reply: string;
  tabs: { build: string; lang: string; launch: string };
  build: { question: string; options: Array<Option<BuildMode>> };
  language: { question: string; options: Array<Option<Lang>> };
  hint: string;
  hintTouch: string;
  agents: string;
  log: Record<BuildMode, string>;
  roles: Record<RoleId, { name: string; task: string }>;
}

export const gateText: Record<Lang, GateText> = {
  es: {
    label: 'Cómo querés ver este portfolio',
    effortOut: 'Effort al máximo para esta sesión · Ultracode on',
    modelOut: ['Modelo: ', ', guardado como predeterminado'],
    prompt: 'construí el portfolio de Renzo',
    reply: 'Puedo lanzar un workflow multiagente y construirlo delante tuyo. Antes, dos preguntas.',
    tabs: { build: 'Construcción', lang: 'Idioma', launch: 'Lanzar' },
    build: {
      question: '¿Lanzo el workflow multiagente?',
      options: [
        {
          value: 'present',
          label: 'Sí, en modo presentación',
          note: '(recomendado)',
          desc: 'Los {n} agentes construyen cada sección delante tuyo y la página avanza sola, en menos de un minuto. Cualquier gesto te devuelve el control.',
        },
        {
          value: 'manual',
          label: 'Sí, pero scrolleo yo',
          desc: 'Los agentes construyen cada sección cuando llegás. Vas a tu ritmo.',
        },
        {
          value: 'final',
          label: 'No, mostrame la página terminada',
          desc: 'Sin construcción: todo listo al instante.',
        },
      ],
    },
    language: {
      question: '¿En qué idioma la querés ver?',
      options: [
        { value: 'es', label: 'Español', note: '(recomendado)', desc: 'Toda la página en español.' },
        { value: 'en', label: 'English', desc: 'The whole page in English.' },
      ],
    },
    hint: 'Enter para elegir · ↑↓ para moverte · Esc para saltar',
    hintTouch: 'Tocá una opción',
    agents: 'agentes',
    log: {
      present: 'Lanzando el workflow · {n} agentes · modo presentación',
      manual: 'Lanzando el workflow · {n} agentes · modo manual',
      final: 'Listo. Te dejo la página terminada.',
    },
    roles: {
      relevamiento: { name: 'Relevamiento', task: 'mide cada caja de la página' },
      arquitectura: { name: 'Arquitectura', task: 'traza la grilla y los ejes' },
      desarrollo: { name: 'Desarrollo', task: 'calcula y dibuja los vectores' },
      diseno: { name: 'Diseño', task: 'pinta desde el cursor' },
      qa: { name: 'QA', task: 'verifica contraste y datos' },
      deploy: { name: 'Deploy', task: 'enciende el neón' },
    },
  },
  en: {
    label: 'How you want to see this portfolio',
    effortOut: 'Effort set to max for this session · Ultracode on',
    modelOut: ['Model: ', ', saved as your default'],
    prompt: "build Renzo's portfolio",
    reply: 'I can launch a multi-agent workflow and build it in front of you. Two questions first.',
    tabs: { build: 'Build', lang: 'Language', launch: 'Launch' },
    build: {
      question: 'Should I launch the multi-agent workflow?',
      options: [
        {
          value: 'present',
          label: 'Yes, in presentation mode',
          note: '(recommended)',
          desc: 'All {n} agents build each section in front of you and the page moves on by itself, in under a minute. Any gesture gives you back control.',
        },
        {
          value: 'manual',
          label: "Yes, but I'll scroll",
          desc: 'The agents build each section when you reach it. At your own pace.',
        },
        {
          value: 'final',
          label: 'No, show me the finished page',
          desc: 'No build: everything ready right away.',
        },
      ],
    },
    language: {
      question: 'Which language do you want?',
      options: [
        { value: 'en', label: 'English', note: '(recommended)', desc: 'The whole page in English.' },
        { value: 'es', label: 'Español', desc: 'Toda la página en español.' },
      ],
    },
    hint: 'Enter to choose · ↑↓ to move · Esc to skip',
    hintTouch: 'Tap an option',
    agents: 'agents',
    log: {
      present: 'Launching the workflow · {n} agents · presentation mode',
      manual: 'Launching the workflow · {n} agents · manual mode',
      final: 'Done. Here is the finished page.',
    },
    roles: {
      relevamiento: { name: 'Discovery', task: 'measures every box on the page' },
      arquitectura: { name: 'Architecture', task: 'draws the grid and the axes' },
      desarrollo: { name: 'Development', task: 'calculates and draws the vectors' },
      diseno: { name: 'Design', task: 'paints from the cursor' },
      qa: { name: 'QA', task: 'checks contrast and data' },
      deploy: { name: 'Deploy', task: 'lights the neon' },
    },
  },
};
