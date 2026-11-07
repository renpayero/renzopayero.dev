import type { APIRoute } from 'astro';
import { content } from '../i18n/content';
import { projects } from '../i18n/projects';
import { ui } from '../i18n/ui';
import { EMAIL, LINKEDIN, whatsapp } from '../lib/contact';

/**
 * Resumen para asistentes de IA (llmstxt.org): quién es Renzo, qué hizo y cómo contactarlo.
 * Sale de los mismos textos que la página, así nunca dice algo distinto de lo publicado.
 */
const FALLBACK_SITE = 'https://renzopayero.dev';

export const GET: APIRoute = ({ site }) => {
  const url = (path: string): string => new URL(path, site ?? FALLBACK_SITE).href;
  const es = content.es;
  const t = ui.es;
  const capabilities = Object.values(es.capabilities.tiles);
  const career = [...es.experience.commits].reverse();

  const lines = [
    '# Renzo Payero',
    '',
    `> ${t.meta.description}`,
    '',
    `${es.manifesto.statement} ${es.manifesto.detail}`,
    '',
    '## Proyectos',
    '',
    ...projects.es.map((p) => {
      const demo = p.demo ? ' (demo en desarrollo)' : '';
      return `- [${p.name}](${url(`/proyectos/${p.slug}/`)})${demo}: ${p.summary} ${p.role} Stack: ${p.stack.join(', ')}. Sitio: ${p.url}`;
    }),
    '',
    '## Experiencia',
    '',
    ...career.map((c) => `- ${c.when}. ${c.title}, ${c.org}.${c.text ? ` ${c.text}` : ''}`),
    '',
    '## Capacidades',
    '',
    ...capabilities.map((tile) => `- ${tile.title}: ${tile.text} (${tile.items.join(', ')})`),
    '',
    '## Contacto',
    '',
    `- [WhatsApp](${whatsapp('es').href}): el canal más rápido.`,
    `- [Email](mailto:${EMAIL})`,
    `- [LinkedIn](${LINKEDIN})`,
    `- [CV en español](${url('/cv/renzo-payero-cv-es.pdf')})`,
    `- [CV en inglés](${url('/cv/renzo-payero-cv-en.pdf')})`,
    `- ${es.contact.place}`,
    '',
    '## English',
    '',
    `- [Portfolio in English](${url('/en/')}): ${ui.en.meta.description}`,
    ...projects.en.map((p) => `- [${p.name}](${url(`/en/proyectos/${p.slug}/`)}): ${p.tagline} ${p.tone}`),
    '',
    '## Optional',
    '',
    '- [Dakodev](https://dakodev.com/): la empresa que cofundé.',
    `- ${es.contact.legal}`,
    '',
  ];

  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
