import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const HIDE_TOOLS = '.hud, .hud-replay { display: none !important; }';

const state = (page: Page) => page.evaluate(() => document.documentElement.dataset.build ?? null);
const waitDone = (page: Page, timeout = 8000) =>
  page.waitForFunction(() => document.documentElement.dataset.build === 'done', undefined, { timeout });
const engineReady = (page: Page) => page.waitForFunction(() => Boolean(window.__rpBuild), undefined, { timeout: 8000 });

async function fontsReady(page: Page) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

test.describe('sin animación', () => {
  test('sin JS se ve la página final completa', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(`${baseURL}/`);
    await expect(page.locator('h1')).toHaveAttribute('aria-label', 'Renzo Payero');
    await expect(page.locator('.lede')).toBeVisible();
    await expect(page.locator('.cta a').first()).toBeVisible();
    await expect(page.locator('.portrait img')).toBeVisible();
    await expect(page.locator('.hud')).toBeHidden();
    await expect(page.locator('.hud-replay')).toBeHidden();
    await expect(page.locator('.name__lit').first()).toHaveCSS('opacity', '1');
    await expect(page.locator('canvas')).toHaveCount(0);
    await context.close();
  });

  test('con reduced motion no corre el motor ni se mueve nada', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const chunks: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('run')) chunks.push(r.url());
    });
    await page.goto(`${baseURL}/`);
    await page.waitForLoadState('networkidle');
    expect(await state(page)).toBeNull();
    expect(chunks).toEqual([]);
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.locator('.lede')).toBeVisible();
    await expect(page.locator('.hud-replay')).toBeHidden();
    await context.close();
  });
});

test.describe('primer build', () => {
  test('el nombre es visible desde el primer pintado y el build termina', async ({ page }) => {
    await page.goto('/?build=1', { waitUntil: 'commit' });
    await expect(page.locator('.name__off').first()).toHaveCSS('opacity', '1');
    await waitDone(page);
    await expect(page.locator('[data-hud-text]')).toContainText(/Construido por \d+ agentes en \d+\.\d s/);
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.locator('.name__lit').first()).toHaveCSS('opacity', '1');
    await expect(page.locator('.lede')).toHaveCSS('opacity', '1');
  });

  test('el estado final es idéntico al HTML sin JS (píxeles)', async ({ browser, baseURL, viewport }) => {
    const size = viewport ?? { width: 1440, height: 900 };

    const built = await browser.newContext({ viewport: size });
    const a = await built.newPage();
    await a.goto(`${baseURL}/?build=1`);
    await waitDone(a);
    await a.addStyleTag({ content: HIDE_TOOLS });
    await fontsReady(a);
    await a.waitForTimeout(300);
    const shotA = PNG.sync.read(await a.screenshot());

    const plain = await browser.newContext({ viewport: size, javaScriptEnabled: false });
    const b = await plain.newPage();
    await b.goto(`${baseURL}/`);
    await b.waitForTimeout(600);
    const shotB = PNG.sync.read(await b.screenshot());

    const diff = pixelmatch(shotA.data, shotB.data, null, shotA.width, shotA.height, { threshold: 0.1 });
    const ratio = diff / (shotA.width * shotA.height);
    console.log(`diferencia final vs sin JS: ${(ratio * 100).toFixed(3)} %`);
    expect(ratio).toBeLessThan(0.001);
    await built.close();
    await plain.close();
  });
});

test.describe('interrupciones', () => {
  test('saltar termina al instante y no informa un tiempo falso', async ({ page }) => {
    await page.goto('/?build=1');
    await engineReady(page);
    await page.locator('[data-hud-skip]').click();
    await waitDone(page, 500);
    await expect(page.locator('.hud')).toBeHidden();
    await expect(page.locator('.lede')).toHaveCSS('opacity', '1');
    await expect(page.locator('[data-hud-text]')).not.toContainText('Construido');
  });

  test('Escape salta el build', async ({ page }) => {
    await page.goto('/?build=1');
    await engineReady(page);
    await page.keyboard.press('Escape');
    await waitDone(page, 500);
  });

  test('pausar congela y seguir continúa', async ({ page }) => {
    await page.goto('/?build=1');
    await engineReady(page);
    const toggle = page.locator('[data-hud-toggle]');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-label', 'Seguir');
    const t1 = await page.evaluate(() => window.__rpBuild?.timeline.time());
    await page.waitForTimeout(400);
    const t2 = await page.evaluate(() => window.__rpBuild?.timeline.time());
    expect(t2).toBe(t1);
    expect(await state(page)).toBe('running');
    await toggle.click();
    await waitDone(page);
  });

  test('cambiar el ancho a mitad del build no deja la página rota', async ({ page, viewport }) => {
    await page.goto('/?build=1');
    await engineReady(page);
    await page.setViewportSize({ width: (viewport?.width ?? 1440) - 120, height: viewport?.height ?? 900 });
    await waitDone(page, 1500);
    await expect(page.locator('.lede')).toHaveCSS('opacity', '1');
    await expect(page.locator('canvas')).toHaveCount(0);
  });

  test('cambiar solo el alto (barra del navegador) no interrumpe', async ({ page, viewport }) => {
    await page.goto('/?build=1');
    await engineReady(page);
    await page.evaluate(() => {
      window.__rpBuild?.timeline.pause();
    });
    await page.setViewportSize({ width: viewport?.width ?? 1440, height: (viewport?.height ?? 900) - 60 });
    await page.waitForTimeout(150);
    expect(await state(page)).toBe('running');
  });

  test('scrollear más allá del hero completa el build', async ({ page }) => {
    await page.goto('/?build=1');
    await engineReady(page);
    await page.evaluate(() => {
      window.__rpBuild?.timeline.pause();
      window.__rpBuild?.timeline.play();
      scrollTo(0, document.documentElement.scrollHeight);
    });
    await waitDone(page, 1500);
  });

  test('si el motor no carga, el watchdog libera la página', async ({ page }) => {
    await page.route(/run\.[^/]*\.js/, (route) => route.abort());
    await page.goto('/?build=1');
    await page.waitForFunction(() => document.documentElement.dataset.build === 'off', undefined, { timeout: 5000 });
    await expect(page.locator('.lede')).toHaveCSS('opacity', '1');
    await expect(page.locator('.name__lit').first()).toHaveCSS('opacity', '1');
  });
});

test.describe('visita repetida', () => {
  test('no espera ni descarga el motor, y puede reconstruir', async ({ page }) => {
    await page.goto('/?build=1');
    await waitDone(page);

    const chunks: string[] = [];
    page.on('request', (r) => {
      if (/run\.[^/]*\.js/.test(r.url())) chunks.push(r.url());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(await state(page)).toBeNull();
    expect(chunks).toEqual([]);
    await expect(page.locator('.lede')).toBeVisible();

    await page.locator('[data-hud-replay]').click();
    await engineReady(page);
    expect(await state(page)).toBe('running');
    await waitDone(page);
  });
});

test.describe('calidad', () => {
  test('sin scroll lateral', async ({ page }) => {
    await page.goto('/?build=0');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('el texto visible no usa raya larga', async ({ page }) => {
    await page.goto('/?build=0');
    const text = await page.evaluate(() => document.body.innerText);
    expect(text).not.toMatch(/[—–]/);
  });

  test('axe sin violaciones al final del build', async ({ page }) => {
    await page.goto('/?build=1');
    await waitDone(page);
    // axe no evalúa -webkit-text-stroke. WCAG toma el contorno como borde de la letra:
    // el del nombre (#F5F2F4 sobre #0B070A) da 18:1. Solo se excluye ese elemento.
    const results = await new AxeBuilder({ page }).exclude('.name__lit').analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  });

  test('axe sin violaciones durante el build', async ({ page }) => {
    await page.goto('/?build=1');
    await engineReady(page);
    await page.evaluate(() => {
      window.__rpBuild?.timeline.pause();
    });
    // Durante el build el texto entra de a poco: el contraste se valida al final.
    const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  });
});

test.describe('rendimiento', () => {
  test('LCP y CLS, también con CPU x4 y red lenta', async ({ browser, baseURL, browserName, viewport }) => {
    test.skip(browserName !== 'chromium', 'LCP/CLS y la limitación por CDP solo existen en Chromium');
    for (const slow of [false, true]) {
      const context = await browser.newContext({ viewport: viewport ?? { width: 1440, height: 900 } });
      const page = await context.newPage();
      if (slow) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions', {
          offline: false,
          latency: 150,
          downloadThroughput: (1.6 * 1024 * 1024) / 8,
          uploadThroughput: (750 * 1024) / 8,
        });
      }
      await page.addInitScript(() => {
        const w = window as unknown as { __lcp: number; __lcpEl: string; __cls: number };
        w.__lcp = 0;
        w.__lcpEl = '';
        w.__cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as Array<PerformanceEntry & { element?: Element }>) {
            w.__lcp = e.startTime;
            w.__lcpEl = e.element?.className?.toString() ?? '';
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
            if (!e.hadRecentInput) w.__cls += e.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto(`${baseURL}/?build=1`);
      await waitDone(page, 20_000);
      const m = await page.evaluate(() => {
        const w = window as unknown as { __lcp: number; __lcpEl: string; __cls: number };
        return { lcp: Math.round(w.__lcp), el: w.__lcpEl, cls: Number(w.__cls.toFixed(4)) };
      });
      console.log(`${slow ? 'lento' : 'rápido'}: LCP ${m.lcp} ms (${m.el}), CLS ${m.cls}`);
      expect(m.lcp).toBeLessThan(2500);
      expect(m.cls).toBeLessThan(0.02);
      await context.close();
    }
  });
});
