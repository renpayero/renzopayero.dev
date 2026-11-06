import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const commitCount = () => {
  if (process.env.BUILD_COMMITS) return Number(process.env.BUILD_COMMITS);
  try {
    return Number(execFileSync('git', ['rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim());
  } catch {
    return 0;
  }
};

const testCount = () => {
  if (process.env.BUILD_TESTS) return Number(process.env.BUILD_TESTS);
  if (!existsSync('tests')) return 0;
  return readdirSync('tests')
    .filter((file) => file.endsWith('.spec.ts'))
    .reduce((total, file) => total + (readFileSync(join('tests', file), 'utf8').match(/^\s*test\(/gm)?.length ?? 0), 0);
};

/** Datos reales del build para "Cómo se hizo": se escriben junto al sitio, no se tipean. */
export default function buildStats() {
  return {
    name: 'build-stats',
    hooks: {
      'astro:build:done': ({ dir, pages, logger }) => {
        const out = fileURLToPath(dir);
        const assets = join(out, '_astro');
        const scripts = existsSync(assets) ? readdirSync(assets).filter((file) => file.endsWith('.js')) : [];
        const bytes = scripts.reduce((total, file) => total + gzipSync(readFileSync(join(assets, file)), { level: 9 }).length, 0);
        const stats = {
          jsKb: Math.round(bytes / 1024),
          pages: pages.length,
          commits: commitCount(),
          tests: testCount(),
          builtAt: new Date().toISOString(),
        };
        writeFileSync(join(out, 'build-stats.json'), JSON.stringify(stats));
        logger.info(`JS ${stats.jsKb} KB gzip, ${stats.pages} páginas, ${stats.commits} commits, ${stats.tests} pruebas`);
      },
    },
  };
}
