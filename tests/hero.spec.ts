import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const HIDE_TOOLS = '.hud, .hud-replay, canvas { display: none !important; }';

const state = (page: Page) => page.evaluate(() => document.documentElement.dataset.build ?? null);
const waitDone = (page: Page, timeout = 8000) =>
  page.waitForFunction(() => document.documentElement.dataset.build === 'done', undefined, { timeout });
const heroBuilt = (page: Page, timeout = 8000) =>
  page.waitForFunction(() => 'built' in (document.querySelector<HTMLElement>('.hero')?.dataset ?? {}), undefined, { timeout });
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
    await page.waitForLoadState('load');
    await page.waitForTimeout(500);
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
    await heroBuilt(page);
    await expect(page.locator('[data-hud-text]')).toContainText(/\d+ de \d+ secciones/);
    await expect(page.locator('.name__lit').first()).toHaveCSS('opacity', '1');
    await expect(page.locator('.lede')).toHaveCSS('opacity', '1');
  });

  test('el estado final es idéntico al HTML sin JS (píxeles)', async ({ browser, baseURL, viewport }) => {
    const size = viewport ?? { width: 1440, height: 900 };

    const built = await browser.newContext({ viewport: size });
    const a = await built.newPage();
    await a.goto(`${baseURL}/?build=1`);
    await heroBuilt(a);
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
    const t1 = await page.evaluate(() => window.__rpBuild?.timeline?.time());
    await page.waitForTimeout(400);
    const t2 = await page.evaluate(() => window.__rpBuild?.timeline?.time());
    expect(t2).toBe(t1);
    expect(await state(page)).toBe('running');
    await toggle.click();
    await heroBuilt(page);
  });

  test('cambiar el ancho a mitad del build no deja la página rota', async ({ page, viewport }) => {
    await page.goto('/?build=1');
    await engineReady(page);
    await page.setViewportSize({ width: (viewport?.width ?? 1440) - 120, height: viewport?.height ?? 900 });
    await heroBuilt(page, 1500);
    await expect(page.locator('.lede')).toHaveCSS('opacity', '1');
  });

  test('cambiar solo el alto (barra del navegador) no interrumpe', async ({ page, viewport }) => {
    await page.goto('/?build=1');
    await engineReady(page);
    await page.evaluate(() => {
      window.__rpBuild?.timeline?.pause();
    });
    await page.setViewportSize({ width: viewport?.width ?? 1440, height: (viewport?.height ?? 900) - 60 });
    await page.waitForTimeout(150);
    expect(await state(page)).toBe('running');
  });

  test('scrollear más allá del hero completa el build', async ({ page }) => {
    await page.goto('/?build=1');
    await engineReady(page);
    await page.evaluate(() => {
      window.__rpBuild?.timeline?.pause();
      window.__rpBuild?.timeline?.play();
      scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' });
    });
    await heroBuilt(page, 1500);
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
    await heroBuilt(page);

    const chunks: string[] = [];
    page.on('request', (r) => {
      if (/run\.[^/]*\.js/.test(r.url())) chunks.push(r.url());
    });
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForTimeout(500);
    expect(await state(page)).toBeNull();
    expect(chunks).toEqual([]);
    await expect(page.locator('.lede')).toBeVisible();

    await page.locator('[data-hud-replay]').click();
    await engineReady(page);
    expect(await state(page)).toBe('running');
    await heroBuilt(page);
  });
});

test.describe('secciones', () => {
  const go = (page: Page, selector: string) =>
    page.evaluate((sel) => {
      const top = (document.querySelector(sel)?.getBoundingClientRect().top ?? 0) + scrollY;
      scrollTo({ top, behavior: 'instant' });
    }, selector);
  const allTyped = (page: Page) =>
    page.evaluate(() => [...document.querySelectorAll('[data-trace]')].every((el) => getComputedStyle(el).opacity === '1'));

  test('recorrido normal: se construye todo e informa un tiempo real', async ({ page }) => {
    await page.goto('/?build=1');
    await heroBuilt(page);
    const sections = await page.evaluate(() => [...document.querySelectorAll('[data-section]')].map((s) => `[data-section="${(s as HTMLElement).dataset.section}"]`));
    for (const selector of sections.slice(1)) {
      await go(page, selector);
      await page.waitForFunction((sel) => 'built' in (document.querySelector<HTMLElement>(sel)?.dataset ?? {}), selector, { timeout: 8000 });
    }
    await waitDone(page);
    await expect(page.locator('[data-hud-text]')).toContainText(/Construido por \d+ agentes en \d+\.\d s/);
    expect(await allTyped(page)).toBe(true);
  });

  // Regresión: limpiar con clearProps 'all' vaciaba el atributo style y mandaba los módulos del sistema a una esquina.
  // Quedan afuera lo que cambia en uso: el progreso de los puntos de la galería y los trazos del nombre, que terminan en 0.
  test('los agentes dejan el HTML como estaba: estilos y posiciones', async ({ page }) => {
    const inlineStyles = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('main [style]:not(.name__stroke, [data-dot], [style=""])')].map((el) => `${el.tagName}|${el.getAttribute('style')}`).sort(),
      );
    const stagePositions = () =>
      page.evaluate(() => {
        // offsetLeft ignora transform: sin build, las animaciones atadas al scroll escalan los nodos.
        return [...document.querySelectorAll<HTMLElement>('.system__node, .system__link')].map((el) => ({
          label: el.textContent,
          x: el.offsetLeft,
          y: el.offsetTop,
        }));
      });

    await page.goto('/?build=0');
    const styles = await inlineStyles();
    const positions = await stagePositions();
    expect(positions.length).toBeGreaterThan(6);

    await page.goto('/?build=1');
    await heroBuilt(page);
    const sections = await page.evaluate(() => [...document.querySelectorAll('[data-section]')].map((s) => `[data-section="${(s as HTMLElement).dataset.section}"]`));
    for (const selector of sections.slice(1)) {
      await go(page, selector);
      await page.waitForFunction((sel) => 'built' in (document.querySelector<HTMLElement>(sel)?.dataset ?? {}), selector, { timeout: 8000 });
    }
    await waitDone(page);

    expect(await inlineStyles()).toEqual(styles);
    const after = await stagePositions();
    for (const [i, before] of positions.entries()) {
      expect(after[i]?.label).toBe(before.label);
      expect(Math.abs((after[i]?.x ?? 1e9) - before.x), `${before.label} x`).toBeLessThanOrEqual(2);
      expect(Math.abs((after[i]?.y ?? 1e9) - before.y), `${before.label} y`).toBeLessThanOrEqual(2);
    }
  });

  test('scroll rápido al final: nada queda colgado y al volver se construye', async ({ page }) => {
    await page.goto('/?build=1');
    await heroBuilt(page);
    await go(page, '#contacto');
    await page.waitForFunction(() => 'built' in (document.querySelector<HTMLElement>('#contacto')?.dataset ?? {}), undefined, { timeout: 8000 });
    await expect(page.locator('.contact__lit')).toBeVisible();
    await go(page, '#experiencia');
    await page.waitForFunction(() => 'built' in (document.querySelector<HTMLElement>('#experiencia')?.dataset ?? {}), undefined, { timeout: 8000 });
    await expect(page.locator('#experiencia h2')).toHaveCSS('opacity', '1');
  });

  test('saltar deja toda la página final', async ({ page }) => {
    await page.goto('/?build=1');
    await engineReady(page);
    await page.locator('[data-hud-skip]').click();
    await waitDone(page, 500);
    expect(await allTyped(page)).toBe(true);
    const hidden = await page.evaluate(() => document.querySelectorAll('.reveal:not(.is-in)').length);
    expect(hidden).toBe(0);
  });

  test('sin JS y con reduced motion se lee todo sin animar', async ({ browser, baseURL }) => {
    for (const options of [{ javaScriptEnabled: false }, { reducedMotion: 'reduce' as const }]) {
      const context = await browser.newContext(options);
      const page = await context.newPage();
      await page.goto(`${baseURL}/`);
      for (const text of ['Una empresa es un solo sistema.', 'Jefe de Sistemas', 'Lo que traigo a un equipo.']) {
        await expect(page.getByText(text).first()).toBeVisible();
      }
      await expect(page.locator('.reveal').first()).toHaveCSS('opacity', '1');
      await expect(page.locator('a[href$="renzo-payero-cv-es.pdf"]')).toBeVisible();
      await context.close();
    }
  });

  test('los CV se descargan', async ({ request }) => {
    for (const lang of ['es', 'en']) {
      const res = await request.get(`/cv/renzo-payero-cv-${lang}.pdf`);
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toContain('pdf');
    }
  });
});

test.describe('botón "Ver el build completo"', () => {
  const SECTIONS = ['manifiesto', 'sistema', 'escena', 'proyectos', 'galeria', 'experiencia', 'capacidades', 'como'];

  // Registra qué secciones construyó un timeline de verdad y cuántos agentes salieron a trabajar.
  // Se reinicia en cada carga: mide solo lo que pasa después de tocar el botón.
  const watchBuilds = (page: Page) =>
    page.addInitScript(() => {
      const w = window as unknown as {
        __rpSwarm?: { agents: Array<{ mode: string }> };
        __built: Record<string, number>;
      };
      w.__built = {};
      setInterval(() => {
        const section = window.__rpBuild?.section;
        if (!section) return;
        const working = w.__rpSwarm?.agents.filter((a) => a.mode === 'task').length ?? 0;
        w.__built[section] = Math.max(w.__built[section] ?? 0, working);
      }, 30);
    });
  const built = (page: Page) => page.evaluate(() => (window as unknown as { __built: Record<string, number> }).__built);
  const walkTo = async (page: Page, name: string) => {
    const selector = `[data-section="${name}"]`;
    await page.evaluate((sel) => {
      const top = (document.querySelector(sel)?.getBoundingClientRect().top ?? 0) + scrollY;
      scrollTo({ top, behavior: 'instant' });
    }, selector);
    await page.waitForFunction((sel) => 'built' in (document.querySelector<HTMLElement>(sel)?.dataset ?? {}), selector, { timeout: 8000 });
  };
  const clickFullBuild = async (page: Page) => {
    await page.locator('[data-autopilot]').click();
    await page.waitForFunction(() => 'pilot' in document.documentElement.dataset, undefined, { timeout: 5000 });
  };

  test('a mitad del primer recorrido vuelve a construir toda la página, con agentes', async ({ page }) => {
    test.setTimeout(180_000);
    await watchBuilds(page);
    await page.goto('/?build=1');
    await heroBuilt(page);
    // Para llegar al botón ya se construyó todo lo anterior. Contacto sigue pendiente: es el caso del bug.
    for (const name of SECTIONS) await walkTo(page, name);
    expect(await state(page)).toBe('running');

    await clickFullBuild(page);
    expect(await page.evaluate(() => document.querySelectorAll('[data-section]:not([data-section="hero"])[data-built]').length)).toBe(0);
    await waitDone(page, 140_000);

    const done = await built(page);
    for (const name of ['hero', ...SECTIONS, 'contacto']) {
      expect(done[name] ?? 0, `agentes trabajando en ${name}`).toBeGreaterThan(0);
    }
    await expect(page.locator('[data-hud-text]')).toContainText(/Construido por \d+ agentes en \d+\.\d s/);
  });

  test('con la página ya terminada vuelve a construirla', async ({ page }) => {
    test.setTimeout(120_000);
    await watchBuilds(page);
    await page.goto('/?build=1');
    await heroBuilt(page);
    for (const name of [...SECTIONS, 'contacto']) await walkTo(page, name);
    await waitDone(page);

    await clickFullBuild(page);
    await page.waitForFunction(() => 'built' in (document.querySelector<HTMLElement>('[data-section="manifiesto"]')?.dataset ?? {}), undefined, { timeout: 30_000 });
    const done = await built(page);
    expect(done.hero ?? 0).toBeGreaterThan(0);
    expect(done.manifiesto ?? 0).toBeGreaterThan(0);
  });

  test('en una visita repetida, con todo ya visible, también construye', async ({ page }) => {
    test.setTimeout(120_000);
    await watchBuilds(page);
    await page.goto('/?build=1');
    await heroBuilt(page);
    await page.goto('/');
    expect(await state(page)).toBeNull();

    await clickFullBuild(page);
    await page.waitForFunction(() => 'built' in (document.querySelector<HTMLElement>('[data-section="manifiesto"]')?.dataset ?? {}), undefined, { timeout: 30_000 });
    const done = await built(page);
    expect(done.hero ?? 0).toBeGreaterThan(0);
    expect(done.manifiesto ?? 0).toBeGreaterThan(0);
  });
});

test.describe('enjambre', () => {
  interface SwarmView {
    agents: Array<{ x: number; y: number; mode: string; alpha: number }>;
  }
  const read = (page: Page) =>
    page.evaluate(() => {
      const swarm = (window as unknown as { __rpSwarm?: SwarmView }).__rpSwarm;
      return { scroll: scrollY, agents: swarm?.agents.map((a) => ({ x: a.x, y: a.y, mode: a.mode, alpha: a.alpha })) ?? [] };
    });

  test('los agentes orbitan el cursor, también en una visita repetida', async ({ page, isMobile, viewport }) => {
    test.skip(isMobile === true, 'solo con puntero');
    await page.goto('/?build=0');
    const x = (viewport?.width ?? 1440) - 4;
    const y = (viewport?.height ?? 900) / 2;
    await page.mouse.move(x - 2, y - 2);
    await page.mouse.move(x, y);
    await page.waitForTimeout(1400);
    const { agents, scroll } = await read(page);
    expect(agents.length).toBeGreaterThan(0);
    for (const agent of agents) {
      const distance = Math.hypot(agent.x - x, agent.y - scroll - y);
      expect(agent.mode).toBe('orbit');
      expect(distance).toBeLessThan(230);
      expect(agent.alpha).toBeGreaterThan(0.5);
    }
    // Se mueven de verdad: siguen orbitando sin que el cursor se mueva.
    await page.waitForTimeout(300);
    const later = await read(page);
    const moved = later.agents.filter((a, i) => Math.hypot(a.x - (agents[i]?.x ?? 0), a.y - (agents[i]?.y ?? 0)) > 4);
    expect(moved.length).toBeGreaterThan(agents.length / 2);
  });

  test('siguen al cursor cuando se mueve', async ({ page, viewport }) => {
    await page.goto('/?build=0');
    await page.mouse.move(4, 300);
    await page.mouse.move(6, 302);
    await page.waitForTimeout(800);
    const x = (viewport?.width ?? 1440) - 4;
    const y = 200;
    await page.mouse.move(x, y, { steps: 6 });
    await page.waitForTimeout(1200);
    const { agents, scroll } = await read(page);
    for (const agent of agents) expect(Math.hypot(agent.x - x, agent.y - scroll - y)).toBeLessThan(230);
  });

  test('salen a construir y después vuelven a la órbita', async ({ page }) => {
    await page.goto('/?build=1');
    await page.mouse.move(4, 300);
    await page.mouse.move(6, 302);
    await page.waitForFunction(() => {
      const swarm = (window as unknown as { __rpSwarm?: { agents: Array<{ mode: string }> } }).__rpSwarm;
      return (swarm?.agents.filter((a) => a.mode === 'task').length ?? 0) > 3;
    }, undefined, { timeout: 5000 });
    await heroBuilt(page);
    await page.waitForTimeout(1200);
    const { agents, scroll } = await read(page);
    for (const agent of agents) {
      expect(agent.mode).toBe('orbit');
      expect(Math.hypot(agent.x - 6, agent.y - scroll - 302)).toBeLessThan(230);
    }
  });

  test('al pasar sobre un botón, cuatro agentes toman sus esquinas', async ({ page }) => {
    await page.goto('/?build=0');
    await page.mouse.move(4, 300);
    await page.mouse.move(6, 302);
    await page.waitForTimeout(500);
    const box = await page.locator('.hero .cta .btn--primary').boundingBox();
    if (!box) throw new Error('sin botón');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    await page.waitForTimeout(800);
    const { agents, scroll } = await read(page);
    const pinned = agents.filter((a) => a.mode === 'pin');
    expect(pinned).toHaveLength(4);
    const corners = [[box.x, box.y], [box.x + box.width, box.y], [box.x + box.width, box.y + box.height], [box.x, box.y + box.height]];
    for (const [cx = 0, cy = 0] of corners) {
      const nearest = Math.min(...pinned.map((a) => Math.hypot(a.x - cx, a.y - scroll - cy)));
      expect(nearest).toBeLessThan(12);
    }
    await page.mouse.move(4, 300, { steps: 3 });
    await page.waitForTimeout(300);
    expect((await read(page)).agents.filter((a) => a.mode === 'pin')).toHaveLength(0);
  });
});

test.describe('navegación', () => {
  test('la barra sticky aparece recién al dejar el hero, también en táctil', async ({ page }) => {
    await page.goto('/?build=0');
    await expect(page.locator('.localnav')).toBeHidden();
    await page.evaluate(() => scrollTo({ top: innerHeight * 1.3, behavior: 'instant' }));
    await expect(page.locator('.localnav')).toBeVisible();
    await expect(page.locator('.localnav__cta')).toHaveAttribute('href', '#contacto');
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await expect(page.locator('.localnav')).toBeHidden();
  });
});

test.describe('control del enjambre', () => {
  test('se puede ocultar, y la preferencia se recuerda', async ({ page }) => {
    await page.goto('/?build=0');
    await page.mouse.move(4, 300);
    await page.mouse.move(6, 302);
    await page.waitForTimeout(500);
    const visible = () =>
      page.evaluate(() => {
        const swarm = (window as unknown as { __rpSwarm?: { agents: Array<{ alpha: number }> } }).__rpSwarm;
        return Math.max(...(swarm?.agents.map((a) => a.alpha) ?? [0]));
      });
    expect(await visible()).toBeGreaterThan(0.5);
    const toggle = page.locator('[data-swarm-toggle]');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await page.mouse.move(4, 300);
    await page.waitForTimeout(800);
    expect(await visible()).toBeLessThan(0.05);

    await page.reload();
    await page.mouse.move(4, 300);
    await page.mouse.move(6, 302);
    await page.waitForTimeout(500);
    expect(await visible()).toBeLessThan(0.05);
    await expect(page.locator('[data-swarm-toggle]')).toHaveAttribute('aria-pressed', 'false');
  });

  test('sin puntero (táctil) el enjambre no orbita ni consume cuadros en reposo', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.goto(`${baseURL}/?build=0`);
    await page.waitForTimeout(600);
    await expect(page.locator('canvas[data-swarm]')).toHaveCount(0);
    await expect(page.locator('[data-swarm-toggle]')).toBeHidden();
    await context.close();
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
    await heroBuilt(page);
    // axe no evalúa -webkit-text-stroke. WCAG toma el contorno como borde de la letra:
    // el del neón (#F5F2F4 sobre #0B070A) da 18:1. Solo se excluyen esos elementos.
    const results = await new AxeBuilder({ page }).exclude('.name__lit').exclude('.contact__lit').analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  });

  test('axe sin violaciones durante el build', async ({ page }) => {
    await page.goto('/?build=1');
    await engineReady(page);
    await page.evaluate(() => {
      window.__rpBuild?.timeline?.pause();
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
      await heroBuilt(page, 20_000);
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
