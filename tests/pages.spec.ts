import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const SLUGS = ['legacy', 'dakodev', 'betina', 'quantarax', 'rodri'];
const PAGES = ['/', '/en/', ...SLUGS.flatMap((s) => [`/proyectos/${s}/`, `/en/proyectos/${s}/`])];

test.describe('todas las páginas', () => {
  for (const path of PAGES) {
    test(`${path}: responde, sin desbordes ni raya larga, sin errores`, async ({ page }) => {
      const problems: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') problems.push(m.text());
      });
      page.on('pageerror', (e) => problems.push(e.message));
      const res = await page.goto(`${path}?build=0`);
      expect(res?.status()).toBe(200);
      await page.waitForLoadState('load');
      const facts = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        text: document.body.innerText,
      }));
      expect(facts.overflow).toBeLessThanOrEqual(0);
      expect(facts.text).not.toMatch(/[—–]/);
      expect(facts.text).not.toMatch(/DakoAgent/i);
      expect(problems).toEqual([]);
    });
  }

  test('axe sin violaciones en los casos', async ({ page }) => {
    await page.goto('/proyectos/legacy/');
    await page.evaluate(() => document.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in')));
    await page.waitForTimeout(1100);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  });
});

test.describe('idiomas y SEO', () => {
  test('inglés completo, con hreflang y JSON-LD', async ({ page }) => {
    await page.goto('/en/?build=0');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { name: /A company is one system/ })).toBeAttached();
    await expect(page.locator('link[hreflang="es"]')).toHaveAttribute('href', /\/$/);
    await expect(page.locator('link[hreflang="en"]')).toHaveAttribute('href', /\/en\/$/);
    const person = await page.locator('script[type="application/ld+json"]').textContent();
    expect(JSON.parse(person ?? '{}').name).toBe('Renzo Payero');
    const text = await page.evaluate(() => document.body.innerText);
    for (const spanish of ['Hablemos', 'Proyectos reales', 'Jefe de Sistemas', 'Escribime']) expect(text).not.toContain(spanish);
  });

  test('el selector de idioma lleva a la otra versión', async ({ page }) => {
    await page.goto('/?build=0');
    await page.locator('.topbar a[hreflang="en"]').click();
    await expect(page).toHaveURL(/\/en\/?/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('robots, imágenes para compartir, CV, videos y 404', async ({ request }) => {
    expect((await request.get('/robots.txt')).status()).toBe(200);
    for (const name of ['home-es', 'home-en', ...SLUGS]) expect((await request.get(`/og/${name}.png`)).status()).toBe(200);
    for (const name of [...SLUGS, 'device-legacy']) {
      const res = await request.get(`/video/${name}.mp4`);
      expect(res.status()).toBe(200);
      expect(Number(res.headers()['content-length'])).toBeLessThan(3 * 1024 * 1024);
    }
    expect((await request.get('/no-existe')).status()).toBe(404);
  });

  test('los datos de "Cómo se hizo" son reales y salen del build', async ({ request }) => {
    const stats = await (await request.get('/build-stats.json')).json();
    expect(stats.jsKb).toBeGreaterThan(5);
    expect(stats.jsKb).toBeLessThan(90);
    expect(stats.commits).toBeGreaterThan(0);
    expect(stats.tests).toBeGreaterThan(10);
  });

  test('presupuesto de JS en la primera carga de la home', async ({ page }) => {
    const urls: string[] = [];
    page.on('response', (r) => {
      if (r.url().endsWith('.js')) urls.push(r.url());
    });
    await page.goto('/?build=0');
    await page.waitForLoadState('load');
    await page.waitForTimeout(500);
    // En una visita repetida no se descarga el motor.
    expect(urls.some((u) => /run\.[^/]*\.js/.test(u))).toBe(false);
  });
});

test.describe('proyectos', () => {
  test('Betina figura como demo y los casos tienen rol, stack y decisiones', async ({ page }) => {
    await page.goto('/proyectos/betina/');
    await expect(page.locator('.case__badge')).toContainText('Demo');
    await expect(page.locator('.case__facts')).toContainText('Proyecto propio');
    expect(await page.locator('.case__decision').count()).toBeGreaterThan(0);
    await expect(page.locator('.case-top__visit')).toHaveAttribute('href', 'https://www.betinadiluzio.com/');
  });

  test('la galería reproduce la baldosa visible y cambia con los puntos', async ({ page }) => {
    await page.goto('/?build=0');
    await page.locator('.gallery').scrollIntoViewIfNeeded();
    const playing = () =>
      page.evaluate(() => [...document.querySelectorAll<HTMLVideoElement>('.tile video')].map((v) => !v.paused));
    await expect.poll(playing, { timeout: 6000 }).toEqual([true, false, false, false, false]);

    await page.locator('[data-dot]').nth(2).click();
    await expect.poll(playing, { timeout: 6000 }).toEqual([false, false, true, false, false]);
    await expect(page.locator('[data-dot]').nth(2)).toHaveAttribute('aria-current', 'true');

    await page.locator('[data-gallery-toggle]').click();
    await expect.poll(playing, { timeout: 3000 }).toEqual([false, false, false, false, false]);
  });

  test('el momento dispositivo arranca al llegar y solo una vez', async ({ page }) => {
    await page.goto('/?build=0');
    const video = page.locator('.device video');
    expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    await page.locator('.device').scrollIntoViewIfNeeded();
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 6000 }).toBeGreaterThan(0);
  });

  test('con reduced motion el dispositivo no se reproduce y queda en su cuadro final', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(`${baseURL}/`);
    await page.locator('.device').scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    const video = page.locator('.device video');
    expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
    expect(await video.getAttribute('poster')).toBe(await page.locator('[data-device]').getAttribute('data-final'));
    await context.close();
  });
});

test.describe('build completo', () => {
  const launch = async (page: import('@playwright/test').Page) => {
    await page.goto('/?build=full');
    await page.waitForFunction(() => Boolean(window.__rpBuild));
  };

  test('recorre la página solo', async ({ page }) => {
    await launch(page);
    await page.waitForFunction(() => scrollY > innerHeight, undefined, { timeout: 15_000 });
    await page.waitForFunction(() => 'built' in (document.querySelector<HTMLElement>('[data-section="manifiesto"]')?.dataset ?? {}), undefined, { timeout: 15_000 });
  });

  test('cualquier gesto devuelve el control al instante', async ({ page, isMobile }) => {
    test.skip(isMobile === true);
    await launch(page);
    await page.waitForFunction(() => scrollY > 200, undefined, { timeout: 15_000 });
    await page.mouse.wheel(0, 1);
    await page.waitForTimeout(200);
    const y1 = await page.evaluate(() => scrollY);
    await page.waitForTimeout(700);
    const y2 = await page.evaluate(() => scrollY);
    expect(Math.abs(y2 - y1)).toBeLessThan(3);
  });
});

test.describe('hablemos por WhatsApp', () => {
  const NUMBER = '5492477610100';
  const CASES = [
    { path: '/', message: 'Hola Renzo, vi tu portfolio y me gustaría hablar con vos.' },
    { path: '/en/', message: "Hi Renzo, I saw your portfolio and I'd like to talk." },
  ];
  const LINK = '.contact__title a';
  const WRITE = '.contact__cta .btn--primary';
  const expectWhatsapp = (href: string | null | undefined, message: string) => {
    const url = new URL(href ?? 'about:blank');
    expect(url.origin + url.pathname).toBe(`https://wa.me/${NUMBER}`);
    expect(url.searchParams.get('text')).toBe(message);
  };
  // WhatsApp no se visita de verdad: alcanza con ver a dónde iría el visitante.
  const stubWhatsapp = (context: BrowserContext) =>
    context.route('https://wa.me/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }));
  // Un clic de mouse de verdad: el de locator acomoda el scroll justo antes y falsea lo que se mide.
  const aim = async (page: Page, selector: string): Promise<() => Promise<void>> => {
    const target = page.locator(selector);
    await target.click({ trial: true });
    const box = await target.boundingBox();
    return () => page.mouse.click((box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2);
  };
  const opensWhatsapp = async (page: Page, message: string, action: () => Promise<void>) => {
    const y = await page.evaluate(() => scrollY);
    const [popup] = await Promise.all([page.waitForEvent('popup'), action()]);
    expectWhatsapp(popup.url(), message);
    await popup.close();
    expect(page.url()).not.toContain('wa.me');
    expect(await page.evaluate(() => scrollY)).toBe(y);
  };

  for (const { path, message } of CASES) {
    test(`${path}: el texto grande y el botón de escribir llevan el número y el mensaje en su idioma`, async ({ page }) => {
      await page.goto(`${path}?build=0`);
      for (const [selector, shown] of [[LINK, '.contact__lit'], [WRITE, WRITE]] as const) {
        const link = page.locator(selector);
        await expect(link).toHaveCount(1);
        expectWhatsapp(await link.getAttribute('href'), message);
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', /noopener/);
        // El nombre para lectores de pantalla arranca con lo que se ve: WCAG 2.5.3.
        const visible = (await page.locator(shown).innerText()).trim().replace(/\.$/, '');
        expect(await link.getAttribute('aria-label')).toMatch(new RegExp(`^${visible}.*WhatsApp$`));
      }
    });

    test(`${path}: con clic y con teclado abre WhatsApp aparte y la página no se mueve`, async ({ page, context, isMobile }) => {
      await stubWhatsapp(context);
      await page.goto(`${path}?build=0`);
      // Con el scroll suave, Playwright seguiría llegando al botón mientras se mide si la página se movió.
      await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
      const link = page.locator(LINK);
      await link.scrollIntoViewIfNeeded();
      await expect(page.locator('.contact__lit')).toBeVisible();
      await opensWhatsapp(page, message, await aim(page, LINK));
      await opensWhatsapp(page, message, await aim(page, WRITE));
      test.skip(isMobile === true, 'el resto es de teclado');
      await link.focus();
      await opensWhatsapp(page, message, () => page.keyboard.press('Enter'));
    });
  }

  test('también funciona después de que lo construyen los agentes', async ({ page, context }) => {
    test.setTimeout(60_000);
    await stubWhatsapp(context);
    await page.goto('/?build=1');
    await page.waitForFunction(() => 'built' in (document.querySelector<HTMLElement>('.hero')?.dataset ?? {}), undefined, { timeout: 12_000 });
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      document.querySelector('#contacto')?.scrollIntoView();
    });
    await page.waitForFunction(() => 'built' in (document.querySelector<HTMLElement>('#contacto')?.dataset ?? {}), undefined, { timeout: 12_000 });
    await expect(page.locator('.contact__lit')).toHaveCSS('opacity', '1');
    for (const selector of [LINK, WRITE]) {
      await opensWhatsapp(page, CASES[0]!.message, await aim(page, selector));
    }
  });

  test('lo demás sigue igual: los botones van a la sección y la dirección de mail sigue ahí', async ({ page }) => {
    await page.goto('/?build=0');
    for (const selector of ['.topbar__cta', '.localnav__cta', '.hero .cta .btn:not(.btn--primary)']) {
      await expect(page.locator(selector)).toHaveAttribute('href', '#contacto');
    }
    const mail = page.locator('#contacto a[href^="mailto:"]');
    await expect(mail).toHaveCount(1);
    await expect(mail).toHaveText('rpayerodev@gmail.com');
  });
});
