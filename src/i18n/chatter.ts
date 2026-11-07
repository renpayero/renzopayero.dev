import type { Lang, RoleId } from './ui';

/** Lo que el globito puede contar sin inventar: sale del DOM en el momento de hablar. */
export interface Facts {
  crew: number;
  /** Contraste WCAG del texto más tenue del hero, o null si no se pudo medir. */
  softContrast: number | null;
}

export interface Line {
  /** Quién la dice. Sin rol la dice cualquiera. */
  role?: RoleId;
  text: string | ((facts: Facts) => string | null);
}

export type Deck = 'idle' | 'gate' | 'lang';

const ratio = (value: number, lang: Lang): string => value.toLocaleString(lang === 'en' ? 'en-US' : 'es-AR', { maximumFractionDigits: 1 });

/**
 * Frases cortas de los agentes cuando el cursor queda quieto. Cada mazo se baraja y no repite
 * hasta agotarse. Las que llevan datos los miden en el momento; si no hay dato, no se dicen.
 */
export const chatter: Record<Lang, Record<Deck, Line[]>> = {
  es: {
    idle: [
      { role: 'relevamiento', text: 'Anoto todo. Después nadie lo lee.' },
      { role: 'relevamiento', text: '¿Lo usan 80 personas? Anotado.' },
      { role: 'arquitectura', text: 'Esto en Odoo es un campo computado.' },
      { role: 'arquitectura', text: 'Primero el proceso, después el código.' },
      { role: 'desarrollo', text: '¿No era un cambio chiquito?' },
      { role: 'desarrollo', text: 'De la v13 a la v20. No me preguntes.' },
      { role: 'diseno', text: 'Le saqué un píxel. Ahora sí.' },
      { role: 'diseno', text: 'Ciruela Odoo. Ni un azul, lo juro.' },
      {
        role: 'qa',
        text: ({ softContrast }) =>
          softContrast === null ? null : `El texto más tenue da ${ratio(softContrast, 'es')}:1. ${softContrast >= 4.5 ? 'Pasa AA.' : 'A revisar.'}`,
      },
      { role: 'qa', text: 'Probé en Safari. Sobreviví.' },
      { role: 'deploy', text: 'Los viernes no se deploya.' },
      { role: 'deploy', text: 'Listo para producción. Cuando digas.' },
      { text: ({ crew }) => `Somos ${crew} y nadie trajo el mate.` },
      { text: '¿Seguís ahí?' },
      { text: 'Tranqui, leé. Nosotros esperamos.' },
    ],
    gate: [
      { text: 'La primera es la que ensayamos.' },
      { text: 'Elegí tranqui, nosotros esperamos.' },
      { text: 'Con Enter arrancamos.' },
      { role: 'relevamiento', text: 'El relevamiento está. Falta tu sí.' },
      { role: 'deploy', text: 'Yo prendo el neón al final.' },
    ],
    lang: [
      { text: '¿Español o inglés? Hablamos los dos.' },
      { role: 'diseno', text: 'En inglés también queda linda.' },
    ],
  },
  en: {
    idle: [
      { role: 'relevamiento', text: 'I write everything down. Nobody reads it.' },
      { role: 'relevamiento', text: '80 people use it? Noted.' },
      { role: 'arquitectura', text: "In Odoo, that's a computed field." },
      { role: 'arquitectura', text: 'Process first, code second.' },
      { role: 'desarrollo', text: "Wasn't this a tiny change?" },
      { role: 'desarrollo', text: "From v13 to v20. Don't ask." },
      { role: 'diseno', text: "I moved one pixel. Now it's right." },
      { role: 'diseno', text: 'Odoo plum. Not one blue, I swear.' },
      {
        role: 'qa',
        text: ({ softContrast }) =>
          softContrast === null ? null : `The faintest text is ${ratio(softContrast, 'en')}:1. ${softContrast >= 4.5 ? 'Passes AA.' : 'Needs a look.'}`,
      },
      { role: 'qa', text: 'Tested on Safari. I survived.' },
      { role: 'deploy', text: "We don't deploy on Fridays." },
      { role: 'deploy', text: 'Ready for production. Your call.' },
      { text: ({ crew }) => `${crew} agents and nobody made coffee.` },
      { text: 'Still there?' },
      { text: "Take your time. We'll wait." },
    ],
    gate: [
      { text: 'We rehearsed the first one.' },
      { text: 'No rush. Pick one.' },
      { text: 'Hit Enter and we start.' },
      { role: 'relevamiento', text: 'Discovery is done. We just need your yes.' },
      { role: 'deploy', text: 'I switch the neon on at the end.' },
    ],
    lang: [
      { text: 'Spanish or English? We speak both.' },
      { role: 'diseno', text: 'It looks good in Spanish too.' },
    ],
  },
};
