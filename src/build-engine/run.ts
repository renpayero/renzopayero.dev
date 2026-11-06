import gsap from 'gsap';
import { ui, type Lang, type RoleId } from '../i18n/ui';
import { getSwarm } from '../swarm/swarm';
import { Crew } from './agents';
import { runAutopilot } from './autopilot';
import type { PlanContext } from './plans/context';
import { heroPlan } from './plans/hero';
import { sectionPlan } from './plans/section';

declare global {
  interface Window {
    __rpBuild?: {
      readonly timeline: gsap.core.Timeline | null;
      readonly section: string | null;
      skip: () => void;
      skipAll: () => void;
    };
  }
}

const BUILT_KEY = 'rp-built';

interface ActiveBuild {
  section: HTMLElement;
  timeline: gsap.core.Timeline;
  cleanups: Array<() => void>;
  startedAt: number;
  pausedAt: number;
  pausedFor: number;
}

/** Dirige la construcción de la página, sección por sección, a medida que el visitante llega. */
class Director {
  private readonly root = document.documentElement;
  private readonly lang: Lang = this.root.lang === 'en' ? 'en' : 'es';
  private readonly t = ui[this.lang];
  private readonly swarm = getSwarm();
  private readonly crew = new Crew(this.swarm);
  private readonly sections = [...document.querySelectorAll<HTMLElement>('[data-section]')];
  private readonly queue: HTMLElement[] = [];
  private readonly segments: HTMLElement[] = [];
  private readonly text: HTMLElement | null;
  private readonly toggle: HTMLButtonElement | null;
  private readonly startWidth = innerWidth;

  private active: ActiveBuild | null = null;
  private builtSeconds = 0;
  private closed = false;
  private idleTimer = 0;

  private readonly trigger = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const section = entry.target as HTMLElement;
        if (entry.isIntersecting) {
          this.request(section);
        } else if (this.active?.section === section && entry.boundingClientRect.bottom < 0) {
          // El visitante ya siguió de largo: esa sección no lo hace esperar.
          this.complete();
        }
      }
    },
    { rootMargin: '0px 0px -30% 0px' },
  );

  constructor(private readonly hud: HTMLElement) {
    this.text = hud.querySelector('[data-hud-text]');
    this.toggle = hud.querySelector('[data-hud-toggle]');

    hud.querySelector('[data-hud-dots]')?.replaceChildren(
      ...this.crew.colors.map((color) => {
        const dot = document.createElement('i');
        dot.style.background = color;
        return dot;
      }),
    );
    const segs = hud.querySelector('[data-hud-segs]');
    for (let i = 0; i < this.sections.length; i++) {
      const seg = document.createElement('i');
      seg.append(document.createElement('b'));
      this.segments.push(seg);
      segs?.append(seg);
    }

    this.toggle?.addEventListener('click', () => this.setPaused(!this.active?.timeline.paused()));
    hud.querySelector('[data-hud-skip]')?.addEventListener('click', () => this.skipAll());
    addEventListener('keydown', this.onKey);
    addEventListener('resize', this.onResize);
  }

  begin(hero: HTMLElement): void {
    this.root.dataset.build = 'running';
    const getActive = (): ActiveBuild | null => this.active;
    window.__rpBuild = {
      get timeline() {
        return getActive()?.timeline ?? null;
      },
      get section() {
        return getActive()?.section.dataset.section ?? null;
      },
      skip: () => this.complete(),
      skipAll: () => this.skipAll(),
    };
    void document.fonts.ready.then(() => {
      if (this.closed) return;
      this.run(hero);
      for (const section of this.sections) this.trigger.observe(section);
      addEventListener('rp:autopilot', () => this.startAutopilot());
      if ('autopilot' in this.root.dataset) this.startAutopilot();
    });
  }

  private autopilotOn = false;

  private startAutopilot(): void {
    if (this.autopilotOn || this.closed) return;
    this.autopilotOn = true;
    void runAutopilot({
      sections: this.sections,
      isBuilt: (section) => 'built' in section.dataset,
      onEnd: () => {
        this.autopilotOn = false;
      },
    });
  }

  private context(cleanups: Array<() => void>): PlanContext {
    return {
      overlay: this.swarm.overlay,
      crew: this.crew,
      announce: (step) => this.announce(step),
      onCleanup: (fn) => cleanups.push(fn),
    };
  }

  private request(section: HTMLElement): void {
    if ('built' in section.dataset || this.closed) return;
    if (this.active?.section === section || this.queue.includes(section)) return;
    if (!this.active) {
      this.run(section);
      return;
    }
    this.queue.push(section);
    // Scroll rápido: nunca más de una sección esperando.
    if (this.queue.length > 1) this.complete();
  }

  private run(section: HTMLElement): void {
    const cleanups: Array<() => void> = [];
    const ctx = this.context(cleanups);
    const timeline = section.dataset.section === 'hero' ? heroPlan(section, ctx) : sectionPlan(section, ctx);
    this.active = { section, timeline, cleanups, startedAt: performance.now(), pausedAt: 0, pausedFor: 0 };
    window.clearTimeout(this.idleTimer);
    this.hud.dataset.idle = 'false';
    const index = this.sections.indexOf(section);
    this.segments[index]?.classList.add('is-active');
    timeline.eventCallback('onUpdate', () => {
      this.segments[index]?.style.setProperty('--p', String(timeline.progress()));
    });
    timeline.eventCallback('onComplete', () => this.settle(true));
    this.swarm.setBusy(true);
    timeline.play();
  }

  /** Termina ya la sección activa: el estado final es el mismo, solo sin la espera. */
  private complete(): void {
    const active = this.active;
    if (!active) return;
    active.timeline.eventCallback('onComplete', null);
    active.timeline.progress(1, false);
    this.settle(false);
  }

  private settle(ranFull: boolean): void {
    const active = this.active;
    if (!active) return;
    this.active = null;
    const { section, timeline, cleanups, startedAt, pausedFor } = active;
    timeline.eventCallback('onUpdate', null);
    if (ranFull) this.builtSeconds += (performance.now() - startedAt - pausedFor) / 1000;
    this.ranAll &&= ranFull;
    for (const fn of cleanups) fn();
    section.dataset.built = '';
    // Sacar todo estilo inline: el estado final es exactamente el HTML sin JS.
    section.querySelectorAll('[data-b], [data-ambient], [data-portrait-fill], .name__lit, .name__halo, img').forEach((el) => {
      gsap.set(el, { clearProps: 'all' });
    });
    if (section.dataset.section === 'hero') {
      gsap.set(document.querySelectorAll('[data-b="nav"]'), { clearProps: 'all' });
      this.remember();
    }
    this.swarm.overlay.clear();
    for (const agent of this.swarm.agents) this.swarm.release(agent);
    this.swarm.setBusy(false);
    const index = this.sections.indexOf(section);
    this.segments[index]?.classList.remove('is-active');
    this.segments[index]?.classList.add('is-done');
    dispatchEvent(new Event('rp:release'));

    const next = this.queue.shift();
    if (next) {
      this.run(next);
    } else if (this.sections.every((s) => 'built' in s.dataset)) {
      this.close(this.ranAll);
    } else {
      this.goIdle();
    }
  }

  private ranAll = true;

  private goIdle(): void {
    const done = this.sections.filter((s) => 'built' in s.dataset).length;
    if (this.text) this.text.textContent = this.t.hud.progress(done, this.sections.length);
    this.idleTimer = window.setTimeout(() => {
      this.hud.dataset.idle = 'true';
    }, 700);
  }

  private announce(step: RoleId | 'go-live'): void {
    if (!this.text) return;
    const label = step === 'go-live' ? this.t.hud.goLive : this.t.roles[step];
    this.text.textContent = `${this.crew.size} ${this.t.hud.agents}: ${label}`;
  }

  private setPaused(paused: boolean): void {
    const active = this.active;
    if (!active || !this.toggle) return;
    active.timeline.paused(paused);
    if (paused) active.pausedAt = performance.now();
    else active.pausedFor += performance.now() - active.pausedAt;
    this.toggle.setAttribute('aria-label', (paused ? this.toggle.dataset.play : this.toggle.dataset.pause) ?? '');
    this.toggle.querySelector('[data-icon-pause]')?.toggleAttribute('hidden', paused);
    this.toggle.querySelector('[data-icon-play]')?.toggleAttribute('hidden', !paused);
  }

  /** Saltar: toda la página queda en su estado final, sin informar un tiempo que no existió. */
  private skipAll(): void {
    this.queue.length = 0;
    this.closed = true;
    const active = this.active;
    if (active) {
      active.timeline.eventCallback('onComplete', null);
      active.timeline.progress(1, false);
      this.settle(false);
    }
    this.closed = false;
    for (const section of this.sections) {
      section.dataset.built = '';
      section.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-in'));
    }
    this.remember();
    this.close(false);
  }

  private close(ranFull: boolean): void {
    if (this.closed) return;
    this.closed = true;
    window.clearTimeout(this.idleTimer);
    this.trigger.disconnect();
    removeEventListener('keydown', this.onKey);
    removeEventListener('resize', this.onResize);
    this.root.dataset.build = 'done';
    dispatchEvent(new Event('rp:release'));
    if (!ranFull) {
      this.hud.style.display = 'none';
      return;
    }
    this.swarm.celebrate();
    this.hud.dataset.state = 'done';
    this.hud.dataset.idle = 'false';
    if (this.text) this.text.textContent = this.t.hud.built(this.crew.size, this.builtSeconds.toFixed(1));
    gsap.to(this.hud, {
      opacity: 0,
      duration: 0.32,
      delay: 5,
      ease: 'power1.inOut',
      onComplete: () => {
        this.hud.style.display = 'none';
      },
    });
  }

  private remember(): void {
    try {
      localStorage.setItem(BUILT_KEY, String(Date.now()));
    } catch {
      // Sin almacenamiento, la próxima visita vuelve a ver el build.
    }
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.skipAll();
  };

  // En móvil la barra del navegador cambia el alto al scrollear: solo el ancho invalida las medidas.
  private readonly onResize = (): void => {
    if (innerWidth !== this.startWidth) this.complete();
  };
}

export function start(): void {
  const root = document.documentElement;
  // El watchdog ya liberó la página: llegar tarde no puede volver a esconderla.
  if (root.dataset.build !== 'pending') return;
  const hero = document.querySelector<HTMLElement>('[data-section="hero"]');
  const hud = document.querySelector<HTMLElement>('[data-hud]');
  if (!hero || !hud) {
    root.dataset.build = 'off';
    dispatchEvent(new Event('rp:release'));
    return;
  }
  new Director(hud).begin(hero);
}
