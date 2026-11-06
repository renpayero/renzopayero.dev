import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g;

const htmlFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return htmlFiles(path);
    return name.endsWith('.html') ? [path] : [];
  });

/**
 * CSP con el hash exacto de cada script inline, escrita en cada página al terminar el build.
 * Vale en cualquier hosting. Los estilos permiten 'unsafe-inline' porque el sitio usa atributos
 * style con variables de layout generadas en el build; no hay contenido de usuarios.
 */
export default function cspMeta() {
  return {
    name: 'csp-meta',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const files = htmlFiles(fileURLToPath(dir));
        for (const file of files) {
          const html = readFileSync(file, 'utf8');
          const hashes = new Set();
          for (const match of html.matchAll(INLINE_SCRIPT)) {
            const body = match[1];
            if (body) hashes.add(`'sha256-${createHash('sha256').update(body).digest('base64')}'`);
          }
          const policy = [
            "default-src 'self'",
            `script-src 'self' ${[...hashes].join(' ')}`.trim(),
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data:",
            "media-src 'self'",
            "font-src 'self'",
            "connect-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; ');
          writeFileSync(file, html.replace(/<head>/, `<head><meta http-equiv="Content-Security-Policy" content="${policy}">`));
        }
        logger.info(`CSP escrita en ${files.length} páginas`);
      },
    },
  };
}
