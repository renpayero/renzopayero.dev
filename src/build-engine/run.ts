import gsap from 'gsap';
import { ui, type Lang, type RoleId } from '../i18n/ui';
import { Crew, seeded } from './agents';
import { Overlay } from './overlay';
import { heroPlan } from './plans/hero';

declare global {
  interface Window {
    __rpBuild?: { timeline: gsap.core.Timeline; skip: () => void };
  }
}

export function start(): void {
  const root = document.documentElement;
  // El watchdog ya liberó la página: llegar tarde no puede volver a esconderla.
  if (root.dataset.build !== 'pending') return;
  const hero = document.querySelector<HTMLElement>('[data-section="hero"]');
  const hud = document.querySelector<HTMLElement>('[data-hud]');
  if (!hero || !hud) {
    root.dataset.build = 'off';
    return;
  }

  const lang: Lang = root.lang === 'en' ? 'en' : 'es';
  const t = ui[lang];
  const overlay = new Overlay();
  const crew = new Crew(overlay, t.roles, seeded(20261105));
  const cleanups: Array<() => void> = [];
  const text = hud.querySelector<HTMLElement>('[data-hud-text]');
  const fill = hud.querySelector<HTMLElement>('[data-hud-fill]');
  const toggle = hud.querySelector<HTMLButtonElement>('[data-hud-toggle]');
  const skipBtn = hud.querySelector<HTMLButtonElement>('[data-hud-skip]');
  const dots = hud.querySelector<HTMLElement>('[data-hud-dots]');

  dots?.replaceChildren(
    ...crew.colors.map((color) => {
      const dot = document.createElement('i');
      dot.style.background = color;
      return dot;
    }),
  );

  const announce = (step: RoleId | 'go-live'): void => {
    if (!text) return;
    const label = step === 'go-live' ? t.hud.goLive : t.roles[step];
    text.textContent = `${crew.size} ${t.hud.agents}: ${label}`;
  };

  root.dataset.build = 'running';
  const timeline = heroPlan(hero, {
    overlay,
    crew,
    announce,
    onCleanup: (fn) => cleanups.push(fn),
  });

  let startedAt = 0;
  let pausedFor = 0;
  let pausedAt = 0;
  let finished = false;

  const finish = (skipped = false): void => {
    if (finished) return;
    finished = true;
    removeEventListener('resize', onResize);
    removeEventListener('keydown', onKey);
    observer.disconnect();
    const seconds = ((performance.now() - startedAt - pausedFor) / 1000).toFixed(1);
    for (const fn of cleanups) fn();
    // Sacar todo estilo inline: el estado final es exactamente el HTML sin JS.
    gsap.set(hero.querySelectorAll('[data-b], .name__lit, .name__halo, [data-ambient], [data-portrait-fill], img'), { clearProps: 'all' });
    gsap.set(document.querySelectorAll('[data-b="nav"]'), { clearProps: 'all' });
    overlay.destroy();
    root.dataset.build = 'done';
    try {
      localStorage.setItem('rp-built', String(Date.now()));
    } catch {
      // Sin almacenamiento, la próxima visita vuelve a ver el build.
    }
    hud.dataset.state = 'done';
    // Saltar no es construir: solo se informa el tiempo si el build corrió entero.
    if (skipped) {
      hud.style.display = 'none';
      return;
    }
    if (text) text.textContent = t.hud.built(crew.size, seconds);
    gsap.to(hud, {
      opacity: 0,
      duration: 0.32,
      delay: 4,
      ease: 'power1.inOut',
      onComplete: () => {
        hud.style.display = 'none';
      },
    });
  };

  const skip = (): void => {
    // El onComplete del timeline no debe anunciar un tiempo que no existió.
    timeline.eventCallback('onComplete', null);
    timeline.progress(1, false);
    finish(true);
  };

  // En móvil la barra del navegador cambia el alto al scrollear: solo el ancho invalida las medidas.
  const startWidth = innerWidth;
  const onResize = (): void => {
    if (innerWidth !== startWidth) skip();
    else overlay.resize();
  };

  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') skip();
  };

  const setPaused = (paused: boolean): void => {
    timeline.paused(paused);
    if (paused) pausedAt = performance.now();
    else pausedFor += performance.now() - pausedAt;
    if (!toggle) return;
    toggle.setAttribute('aria-label', (paused ? toggle.dataset.play : toggle.dataset.pause) ?? '');
    toggle.querySelector<HTMLElement>('[data-icon-pause]')?.toggleAttribute('hidden', paused);
    toggle.querySelector<HTMLElement>('[data-icon-play]')?.toggleAttribute('hidden', !paused);
  };

  // Si el visitante ya siguió de largo, el hero no lo hace esperar.
  const observer = new IntersectionObserver(([entry]) => {
    if (entry && !entry.isIntersecting && !timeline.paused()) skip();
  });

  toggle?.addEventListener('click', () => setPaused(!timeline.paused()));
  skipBtn?.addEventListener('click', skip);
  addEventListener('resize', onResize);
  addEventListener('keydown', onKey);

  timeline.eventCallback('onUpdate', () => {
    if (fill) fill.style.transform = `scaleX(${timeline.progress()})`;
  });
  timeline.eventCallback('onComplete', () => finish());

  window.__rpBuild = { timeline, skip };

  void document.fonts.ready.then(() => {
    if (finished) return;
    observer.observe(hero);
    overlay.start();
    startedAt = performance.now();
    timeline.play();
  });
}
