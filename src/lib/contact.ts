import type { Lang } from '../i18n/ui';

export const EMAIL = 'rpayerodev@gmail.com';
export const LINKEDIN = 'https://www.linkedin.com/in/renzopayero/';

/** Formato de wa.me: internacional, solo dígitos y con el 9 de los celulares argentinos. */
const WHATSAPP_NUMBER = '5492477610100';

const MESSAGE: Record<Lang, string> = {
  es: 'Hola Renzo, vi tu portfolio y me gustaría hablar con vos.',
  en: "Hi Renzo, I saw your portfolio and I'd like to talk.",
};

/** Para lectores de pantalla: empiezan con el texto visible del enlace y avisan a dónde lleva. */
const LABELS: Record<Lang, { talk: string; write: string }> = {
  es: { talk: 'Hablemos por WhatsApp', write: 'Escribime por WhatsApp' },
  en: { talk: "Let's talk on WhatsApp", write: 'Write to me on WhatsApp' },
};

export const whatsapp = (lang: Lang): { href: string; labels: { talk: string; write: string } } => ({
  href: `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(MESSAGE[lang])}`,
  labels: LABELS[lang],
});
