import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const sitemap = site ? `\nSitemap: ${new URL('sitemap-index.xml', site).href}` : '';
  return new Response(`User-agent: *\nAllow: /${sitemap}\n`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
