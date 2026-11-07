import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';

const gateState = (page: Page) => page.evaluate(() => document.documentElement.dataset.gate ?? null);
const dialog = (page: Page) => page.locator('.gate__screen:visible');
const option = (page: Page, value: string) => dialog(page).locator(`.gate__opt[data-value="${value}"]`);
const answered = (page: Page) => page.waitForFunction(() => document.querySelector('.gate__screen[data-fast]') !== null);
const heroBuilt = (page: Page, timeout = 12_000) =>
  page.waitForFunction(() => 'built' in (document.querySelector<HTMLElement>('.hero')?.dataset ?? {}), undefined, { timeout });
const built = (page: Page, name: string, timeout = 15_000) =>
  page.waitForFunction((n) => 'built' in (document.querySelector<HTMLElement>(`[data-section="${n}"]`)?.dataset ?? {}), name, { timeout });

async function visit(browser: Browser, baseURL: string | undefined, path: string, locale: string) {
  const context = await browser.newContext({ locale });
  const page = await context.newPage();
  await page.goto(`${baseURL}${path}`);
  return { context, page };
}

// El navegador de las pruebas habla español salvo donde se prueba justamente el idioma.
test.use({ locale: 'es-AR' });

test.describe('la terminal de inicio', () => {
  test('la primera visita pregunta antes de construir, sin mostrar versiones', async ({ page }) => {
    await page.goto('/');
    expect(await gateState(page)).toBe('es');
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).locator('.gate__agent')).toHaveText('Claude Code');
    await expect(dialog(page).locator('.gate__head')).toContainText("Renzo's IA with max effort · ultracode");
    // Nada que se desactualice: ni número de versión ni un modelo con fecha.
    expect(await dialog(page).locator('.gate__head').innerText()).not.toMatch(/\d/);

    await answered(page);
    await expect(option(page, 'present')).toHaveClass(/is-selected/);
    await expect(option(page, 'present')).toBeFocused();
    await expect(option(page, 'present')).toContainText('(recomendado)');

    // Detrás, nada arrancó: ni la construcción, ni el HUD, ni el scroll.
    expect(await page.evaluate(() => document.documentElement.dataset.build)).toBe('pending');
    expect(await page.evaluate(() => Boolean(window.__rpBuild))).toBe(false);
    await expect(page.locator('.hud')).toBeHidden();
    await expect(page.locator('[data-swarm-toggle]')).toBeHidden();
    expect(await page.locator('main').evaluate((el) => el.closest('[inert]') !== null)).toBe(true);
    await expect(page.locator('main')).toBeHidden();
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    // El watchdog del head no la libera mientras el visitante lee.
    await page.waitForTimeout(3600);
    expect(await gateState(page)).toBe('es');
    expect(await page.evaluate(() => document.documentElement.dataset.build)).toBe('pending');
  });

  test('modo presentación: construye y baja solo, después de dar tiempo a leer', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'las flechas son para teclado');
    await page.goto('/');
    await answered(page);
    await page.keyboard.press('ArrowDown');
    await expect(option(page, 'manual')).toHaveClass(/is-selected/);
    await page.keyboard.press('ArrowUp');
    await expect(option(page, 'present')).toHaveClass(/is-selected/);
    await page.keyboard.press('Enter');
    await expect(option(page, 'es')).toBeFocused();
    await expect(dialog(page).locator('[data-tab="build"]')).toHaveClass(/is-done/);
    await page.keyboard.press('Enter');
    await expect(dialog(page).locator('[data-log-title="present"]')).toBeVisible();

    await page.waitForFunction(() => document.documentElement.dataset.build === 'running', undefined, { timeout: 5000 });
    expect(await page.evaluate(() => document.documentElement.dataset.pilot)).toBe('present');
    // La terminal se funde: mientras se va todavía está, y debajo ya se construye.
    await expect(page.locator('[data-gate-root]')).toHaveClass(/is-leaving/);
    await expect.poll(() => page.locator('[data-gate-root]').evaluate((el) => getComputedStyle(el).display).catch(() => 'gone')).not.toBe('none');
    await expect(page.locator('[data-gate-root]')).toHaveCount(0);
    await expect(page.locator('.hud')).toBeVisible();
    await heroBuilt(page);
    // Termina el hero y la página ya se mueve, pero despacio: el texto se sigue leyendo.
    await page.waitForFunction(() => scrollY > 0, undefined, { timeout: 800 });
    await page.waitForTimeout(1200);
    const y = await page.evaluate(() => scrollY);
    expect(y).toBeGreaterThan(5);
    expect(y).toBeLessThan((page.viewportSize()?.height ?? 900) * 0.4);
    await page.waitForFunction(() => scrollY > 300, undefined, { timeout: 9000 });
  });

  test('manual: los agentes construyen, pero el scroll es del visitante', async ({ page }) => {
    await page.goto('/');
    await answered(page);
    await option(page, 'manual').click();
    await option(page, 'es').click();
    await heroBuilt(page);
    expect(await page.evaluate(() => 'pilot' in document.documentElement.dataset)).toBe(false);
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    await page.locator('[data-section="manifiesto"]').scrollIntoViewIfNeeded();
    await built(page, 'manifiesto');
  });

  test('la página terminada: al instante, sin motor, y no vuelve a preguntar', async ({ page }) => {
    const engine: string[] = [];
    await page.goto('/');
    await answered(page);
    await option(page, 'final').click();
    await option(page, 'es').click();
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-build'), undefined, { timeout: 2000 });
    await expect(page.locator('[data-gate-root]')).toHaveCount(0, { timeout: 2000 });
    await expect(page.locator('.lede')).toBeVisible();
    expect(await page.evaluate(() => Boolean(window.__rpBuild))).toBe(false);
    expect(await page.locator('main').evaluate((el) => el.closest('[inert]') === null)).toBe(true);

    page.on('request', (r) => {
      if (/run\.[^/]*\.js/.test(r.url())) engine.push(r.url());
    });
    await page.goto('/');
    await page.waitForLoadState('load');
    expect(await gateState(page)).toBeNull();
    await expect(page.locator('[data-gate-root]')).toHaveCount(0);
    expect(engine).toEqual([]);
  });

  test('Esc salta directo a la página terminada', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'es de teclado');
    await page.goto('/');
    await answered(page);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-build'), undefined, { timeout: 2000 });
    await expect(page.locator('.lede')).toBeVisible();
  });

  test('números y volver: 2 elige la segunda opción y la flecha izquierda vuelve a la primera pregunta', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'es de teclado');
    await page.goto('/');
    await answered(page);
    await page.keyboard.press('2');
    await expect(option(page, 'es')).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(option(page, 'present')).toBeVisible();
    await expect(option(page, 'es')).toBeHidden();
    await page.keyboard.press('2');
    await page.keyboard.press('1');
    await heroBuilt(page);
    expect(await page.evaluate(() => 'pilot' in document.documentElement.dataset)).toBe(false);
  });
});

test.describe('idioma de la terminal', () => {
  const matrix = [
    // La raíz no fue una elección: habla en el idioma del navegador. /en/ sí lo fue.
    { path: '/', locale: 'es-AR', screen: 'es', other: 'en', goes: /\/en\/\?build=present$/ },
    { path: '/', locale: 'en-US', screen: 'en', other: 'en', goes: /\/en\/\?build=present$/ },
    { path: '/', locale: 'pt-BR', screen: 'en', other: 'es', goes: /:\d+\/$/ },
    { path: '/en/', locale: 'es-AR', screen: 'en', other: 'es', goes: /:\d+\/\?build=present$/ },
    { path: '/en/', locale: 'en-US', screen: 'en', other: 'en', goes: /\/en\/$/ },
  ] as const;

  for (const { path, locale, screen, other, goes } of matrix) {
    test(`${path} con navegador en ${locale}: habla en ${screen} y elegir ${other} queda en ${goes}`, async ({ browser, baseURL, viewport }, info) => {
      test.skip(info.project.name !== 'chromium-1440' && viewport?.width !== 390, 'alcanza con un motor por ancho');
      const { context, page } = await visit(browser, baseURL, path, locale);
      expect(await gateState(page)).toBe(screen);
      await expect(page.locator(`[data-screen="${screen}"]`)).toBeVisible();
      await expect(page.locator('.gate__screen')).toHaveCount(path === '/en/' ? 1 : 2);
      await expect(dialog(page)).toHaveCount(1);
      await answered(page);
      await option(page, 'present').click();
      await option(page, other).click();
      await page.waitForURL(goes, { timeout: 5000 });
      await page.waitForFunction(() => document.documentElement.dataset.build === 'running', undefined, { timeout: 8000 });
      await expect.poll(() => gateState(page)).toBeNull();
      expect(await page.evaluate(() => document.documentElement.dataset.pilot)).toBe('present');
      await context.close();
    });
  }

  test('en inglés la terminal dice el modelo en inglés', async ({ page }) => {
    await page.goto('/en/');
    await expect(dialog(page).locator('.gate__head')).toContainText("Renzo's AI with max effort · ultracode");
    await expect(option(page, 'present')).toContainText('(recommended)');
  });
});

test.describe('cuándo no aparece', () => {
  for (const query of ['?build=0', '?build=1', '?build=full', '?build=present', '#contacto']) {
    test(`con ${query}`, async ({ page }) => {
      await page.goto(`/${query}`);
      expect(await gateState(page)).toBeNull();
      await expect(page.locator('[data-gate-root]')).toHaveCount(0);
    });
  }

  test('sin JS y con reduced motion se ve la página, no la terminal', async ({ browser, baseURL }) => {
    for (const options of [{ javaScriptEnabled: false }, { reducedMotion: 'reduce' as const }]) {
      const context = await browser.newContext(options);
      const page = await context.newPage();
      await page.goto(`${baseURL}/`);
      await expect(page.locator('.gate__screen').first()).toBeHidden();
      await expect(page.locator('.lede')).toBeVisible();
      await context.close();
    }
  });

  test('un buscador indexa la página, no la pregunta', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' });
    const page = await context.newPage();
    await page.goto(`${baseURL}/`);
    expect(await gateState(page)).toBeNull();
    expect(await page.evaluate(() => document.documentElement.dataset.build ?? null)).toBeNull();
    await expect(page.locator('.lede')).toBeVisible();
    await context.close();
  });

  test('?build=ask la abre aunque ya se haya respondido', async ({ page }) => {
    await page.goto('/?build=0');
    await page.evaluate(() => localStorage.setItem('rp-built', String(Date.now())));
    await page.goto('/');
    expect(await gateState(page)).toBeNull();
    await page.goto('/?build=ask');
    expect(await gateState(page)).toBe('es');
    await expect(dialog(page)).toBeVisible();
  });

  test('en las páginas de proyecto no está', async ({ page }) => {
    await page.goto('/proyectos/legacy/');
    await expect(page.locator('[data-gate-root]')).toHaveCount(0);
  });

  test('si el módulo no carga, el watchdog libera la página', async ({ page }) => {
    await page.route(/\/gate\.[^/]*\.js/, (route) => route.abort());
    await page.goto('/');
    expect(await gateState(page)).not.toBeNull();
    await page.waitForFunction(() => document.documentElement.dataset.build === 'off', undefined, { timeout: 5000 });
    expect(await gateState(page)).toBeNull();
    await expect(page.locator('.gate__screen').first()).toBeHidden();
    await expect(page.locator('.lede')).toBeVisible();
  });

  test('si el motor no carga después de elegir, la página se libera igual', async ({ page }) => {
    await page.route(/\/run\.[^/]*\.js/, (route) => route.abort());
    await page.goto('/');
    await answered(page);
    await option(page, 'present').click();
    await option(page, 'es').click();
    await page.waitForFunction(() => document.documentElement.dataset.build === 'off', undefined, { timeout: 6000 });
    await expect(page.locator('.lede')).toBeVisible();
  });
});

test.describe('calidad de la terminal', () => {
  test('axe sin violaciones en las dos preguntas', async ({ page }) => {
    await page.goto('/');
    await answered(page);
    const first = await new AxeBuilder({ page }).include('.gate').analyze();
    expect(first.violations.map((v) => v.id)).toEqual([]);
    await option(page, 'present').click();
    await expect(option(page, 'es')).toBeVisible();
    const second = await new AxeBuilder({ page }).include('.gate').analyze();
    expect(second.violations.map((v) => v.id)).toEqual([]);
  });

  test('entra en pantalla: sin scroll horizontal y con opciones de al menos 44 px', async ({ page }) => {
    await page.goto('/');
    await answered(page);
    const overflow = await page.locator('[data-gate-root]').evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    for (const value of ['present', 'manual', 'final']) {
      const box = await option(page, value).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    const last = option(page, 'final');
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    // La barra de estado no tapa la última opción.
    const lastBox = await last.boundingBox();
    const statusBox = await dialog(page).locator('.gate__status').boundingBox();
    expect((lastBox?.y ?? 0) + (lastBox?.height ?? 0)).toBeLessThanOrEqual((statusBox?.y ?? 0) + 1);
  });

  test('la terminal llega con el HTML: el módulo solo agrega la interacción', async ({ page }) => {
    await page.route(/\/gate\.[^/]*\.js/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.continue();
    });
    await page.goto('/', { waitUntil: 'commit' });
    await expect(page.locator('[data-screen="es"] .gate__agent')).toBeVisible({ timeout: 1500 });
    expect(await page.evaluate(() => 'gateReady' in document.documentElement.dataset)).toBe(false);
    await page.waitForFunction(() => 'gateReady' in document.documentElement.dataset, undefined, { timeout: 4000 });
    await expect(option(page, 'present')).toBeFocused();
  });

  test('el tabulador y el foco mueven la misma selección', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'es de teclado');
    await page.goto('/');
    await answered(page);
    await page.keyboard.press('Tab');
    await expect(option(page, 'manual')).toHaveClass(/is-selected/);
    await expect(option(page, 'present')).not.toHaveClass(/is-selected/);
  });

  test('una tecla durante la entrada la completa, sin elegir nada a ciegas', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'es de teclado');
    await page.goto('/');
    await page.waitForFunction(() => 'gateReady' in document.documentElement.dataset);
    if (await page.evaluate(() => document.querySelector('.gate__screen[data-fast]') === null)) {
      await page.keyboard.press('Enter');
      await expect(option(page, 'present')).toBeVisible();
    }
    await expect(option(page, 'present')).toBeFocused();
  });
});

test.describe('modo presentación', () => {
  const launch = async (page: Page) => {
    await page.goto('/?build=present');
    await page.waitForFunction(() => Boolean(window.__rpBuild));
  };

  test('entre el hero y la sección siguiente hay un momento para verlo', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/?build=present');
    await heroBuilt(page);
    const start = Date.now();
    await page.waitForFunction(() => window.__rpBuild?.section === 'manifiesto', undefined, { timeout: 20_000, polling: 30 });
    const gap = Date.now() - start;
    console.log(`del hero a la sección siguiente: ${gap} ms`);
    expect(gap).toBeGreaterThanOrEqual(1500);
  });

  test('cada sección arranca al llegar: lo que falta de recorrido es casi nada', async ({ page }) => {
    test.setTimeout(60_000);
    await launch(page);
    await heroBuilt(page);
    await page.waitForFunction(() => window.__rpBuild?.section === 'manifiesto', undefined, { timeout: 20_000, polling: 30 });
    const y1 = await page.evaluate(() => scrollY);
    await page.waitForTimeout(600);
    const y2 = await page.evaluate(() => scrollY);
    expect(Math.abs(y2 - y1)).toBeLessThan(160);
    // Y mientras construyen, la página espera.
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => scrollY)).toBe(y2);
    const frameOnText = await page.evaluate(() => document.querySelector('.manifesto__text')!.getBoundingClientRect().top);
    expect(frameOnText).toBeGreaterThan(0);
  });

  test('el teléfono gira completo antes de seguir', async ({ page }) => {
    test.setTimeout(150_000);
    await launch(page);
    await built(page, 'proyectos', 90_000);
    // Se centra en el dispositivo y lo deja terminar.
    const video = page.locator('.device video');
    await page.waitForFunction(() => window.__rpBuild?.section === 'galeria', undefined, { timeout: 40_000 });
    const state = await video.evaluate((v: HTMLVideoElement) => ({ ended: v.ended, time: v.currentTime, duration: v.duration, poster: v.poster }));
    console.log('dispositivo al pasar a la galería', JSON.stringify(state));
    expect(state.ended || state.time >= state.duration - 0.2).toBe(true);
  });

  test('pausar congela el recorrido y seguir lo retoma', async ({ page }) => {
    test.setTimeout(60_000);
    await launch(page);
    await heroBuilt(page);
    await page.waitForFunction(() => scrollY > 2, undefined, { timeout: 2000 });
    await page.locator('[data-hud-toggle]').click();
    await page.waitForTimeout(150);
    const frozen = await page.evaluate(() => scrollY);
    await page.waitForTimeout(6000);
    expect(await page.evaluate(() => scrollY)).toBe(frozen);
    await page.locator('[data-hud-toggle]').click();
    await page.waitForFunction((y) => scrollY > y + 20, frozen, { timeout: 10_000 });
  });

  // Regresión: el <html> compartía atributo con el botón del build y cualquier clic reiniciaba la página.
  for (const mode of ['present', 'full']) {
    test(`en ${mode}, un clic en la página no la reinicia`, async ({ page }) => {
      await page.goto(`/?build=${mode}`);
      await heroBuilt(page);
      await page.evaluate(() => {
        (window as unknown as { __same: boolean }).__same = true;
      });
      await page.locator('[data-hud-toggle]').click();
      await page.locator('[data-hud-toggle]').click();
      await page.waitForTimeout(300);
      expect(page.url()).toContain(`build=${mode}`);
      expect(await page.evaluate(() => (window as unknown as { __same?: boolean }).__same)).toBe(true);
    });
  }

  test('saltar deja la página final y corta el recorrido', async ({ page }) => {
    await launch(page);
    await heroBuilt(page);
    await page.locator('[data-hud-skip]').click();
    await page.waitForFunction(() => document.documentElement.dataset.build === 'done', undefined, { timeout: 1000 });
    const y = await page.evaluate(() => scrollY);
    await page.waitForTimeout(3000);
    expect(await page.evaluate(() => scrollY)).toBe(y);
  });

  test('un gesto devuelve el control y lo que queda se construye con el scroll', async ({ page, isMobile }) => {
    test.skip(isMobile === true, 'el gesto de rueda es de escritorio');
    test.setTimeout(60_000);
    await launch(page);
    await heroBuilt(page);
    await page.mouse.move(100, 300);
    await page.mouse.wheel(0, 1);
    await page.waitForTimeout(300);
    const y = await page.evaluate(() => scrollY);
    await page.waitForTimeout(5000);
    expect(Math.abs((await page.evaluate(() => scrollY)) - y), 'la página siguió sola').toBeLessThan(3);
    await page.locator('[data-section="manifiesto"]').scrollIntoViewIfNeeded();
    await built(page, 'manifiesto');
  });

  test('el recorrido entero termina, dura lo que promete y queda todo construido', async ({ page }, info) => {
    test.skip(!['chromium-1440', 'chromium-390'].includes(info.project.name), 'una pasada larga por ancho');
    test.setTimeout(320_000);
    const started = Date.now();
    await launch(page);
    // Encuadre: cuando arranca cada sección, la página ya llegó y lo principal se ve entero.
    // De paso se cronometra cada una: lo que tardan los agentes y el total hasta la próxima.
    await page.evaluate(() => {
      // Quieta es que no construya nadie, no se mueva la página y la galería no avance.
      const still = { longest: 0, at: '' };
      (window as unknown as { __still: typeof still }).__still = still;
      const track = document.querySelector<HTMLElement>('[data-gallery-track]');
      let lastY = scrollY;
      let lastX = track?.scrollLeft ?? 0;
      let lastActive = performance.now();
      const watch = (now: number): void => {
        const x = track?.scrollLeft ?? 0;
        if (window.__rpBuild?.section || scrollY !== lastY || x !== lastX) lastActive = now;
        else if (now - lastActive > still.longest) {
          still.longest = Math.round(now - lastActive);
          still.at = `y ${Math.round(scrollY)}, x ${Math.round(x)}`;
        }
        lastY = scrollY;
        lastX = x;
        if (document.documentElement.dataset.build !== 'done') requestAnimationFrame(watch);
      };
      requestAnimationFrame(watch);

      const seen: Record<string, { top: number; vh: number; start: number; end: number }> = {};
      (window as unknown as { __framing: typeof seen }).__framing = seen;
      setInterval(() => {
        const name = window.__rpBuild?.section;
        if (!name) return;
        const entry = seen[name];
        if (entry) {
          entry.end = performance.now();
          return;
        }
        const lead = document.querySelector(`[data-section="${name}"] :is(h1, h2, [data-tile], .system__stage)`);
        seen[name] = { top: Math.round(lead?.getBoundingClientRect().top ?? 0), vh: innerHeight, start: performance.now(), end: performance.now() };
      }, 40);
    });
    await page.waitForFunction(() => document.documentElement.dataset.build === 'done', undefined, { timeout: 300_000, polling: 200 });
    const seconds = (Date.now() - started) / 1000;
    const framing = await page.evaluate(() => (window as unknown as { __framing: Record<string, { top: number; vh: number; start: number; end: number }> }).__framing);
    const rows = Object.entries(framing).map(([name, f], i, all) => {
      const next = all[i + 1]?.[1];
      return `${name}: construye ${((f.end - f.start) / 1000).toFixed(1)} s, total ${(((next?.start ?? f.end) - f.start) / 1000).toFixed(1)} s`;
    });
    const still = await page.evaluate(() => (window as unknown as { __still: { longest: number; at: string } }).__still);
    console.log(`presentación completa en ${info.project.name}: ${seconds.toFixed(0)} s, lo más quieta ${still.longest} ms (${still.at})\n  ${rows.join('\n  ')}`);
    expect(still.longest, `quieta en ${still.at}`).toBeLessThan(250);
    for (const [name, { top, vh }] of Object.entries(framing)) {
      if (name === 'hero') continue;
      expect(top, `${name} arriba`).toBeGreaterThanOrEqual(0);
      expect(top, `${name} abajo`).toBeLessThan(vh * 0.8);
    }
    expect(await page.locator('[data-section]:not([data-built])').count()).toBe(0);
    await expect.poll(() => page.locator('.reveal:not(.is-in):not([data-gallery] .tile)').count(), { timeout: 3000 }).toBe(0);
    await expect(page.locator('.contact__links a').first()).toBeVisible();
    await expect(page.locator('[data-hud-text]')).toContainText(/Construido por \d+ agentes en \d+\.\d s/);
    // La partitura suma 54 s: el margen cubre la carga de la página y el arranque de las fuentes.
    expect(seconds).toBeGreaterThan(50);
    expect(seconds).toBeLessThan(57);
  });
});
