import { expect, test, type Page } from '@playwright/test';

// La CSP va por hashes: un script que cambia sin su hash nuevo deja de correr y nadie se entera.
// Cada bloqueo del navegador, en cualquier modo de la página, hace fallar estas pruebas.

const SLUGS = ['legacy', 'dakodev', 'betina', 'quantarax', 'rodri'];
const PAGES = ['/', '/en/', ...SLUGS.flatMap((s) => [`/proyectos/${s}/`, `/en/proyectos/${s}/`]), '/no-existe'];

const watch = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = seen;
    document.addEventListener(
      'securitypolicyviolation',
      (e) => seen.push(`${e.effectiveDirective} ${e.blockedURI || 'inline'} ${e.sourceFile}:${e.lineNumber}`),
      true,
    );
  });
};

const blocked = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? ['sin detector']);

const walk = (page: Page): Promise<void> =>
  page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto';
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) {
      scrollTo(0, y);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
  });

test.use({ locale: 'es-AR' });

test.describe('la CSP no bloquea nada', () => {
  test('el detector ve un bloqueo cuando lo hay', async ({ page }) => {
    await watch(page);
    await page.goto('/?build=0');
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'window.__inyectado = true';
      document.head.append(script);
    });
    await expect.poll(() => blocked(page)).not.toEqual([]);
    expect(await page.evaluate(() => 'inyectado' in window)).toBe(false);
  });

  for (const path of PAGES) {
    test(`${path}: sin build, recorrida entera`, async ({ page }) => {
      await watch(page);
      await page.goto(`${path}?build=0`);
      await walk(page);
      expect(await blocked(page)).toEqual([]);
    });
  }

  test('la terminal y la presentación', async ({ page }) => {
    test.setTimeout(45_000);
    await watch(page);
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('.gate__screen[data-fast]') !== null);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.documentElement.dataset.build === 'running', undefined, { timeout: 8000 });
    await page.waitForFunction(() => 'built' in (document.querySelector<HTMLElement>('[data-section="manifiesto"]')?.dataset ?? {}), undefined, {
      timeout: 25_000,
    });
    expect(await blocked(page)).toEqual([]);
  });

  test('el build a mano, sección por sección', async ({ page }) => {
    test.setTimeout(60_000);
    await watch(page);
    await page.goto('/en/?build=1');
    await page.waitForFunction(() => 'built' in (document.querySelector<HTMLElement>('.hero')?.dataset ?? {}), undefined, { timeout: 12_000 });
    await walk(page);
    await page.waitForFunction(() => document.documentElement.dataset.build === 'done', undefined, { timeout: 40_000 });
    expect(await blocked(page)).toEqual([]);
  });
});
