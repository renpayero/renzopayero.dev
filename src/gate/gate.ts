import type { BuildMode } from '../i18n/gate';
import type { Lang, RoleId } from '../i18n/ui';
import { getSwarm } from '../swarm/swarm';

const BUILT_KEY = 'rp-built';
const LOG_MS = 950;
const QUICK_MS = 260;
const WATCHDOG_MS = 3500;
const INTRO_MS = 680;

const root = document.documentElement;
const pageLang: Lang = root.lang === 'en' ? 'en' : 'es';

const release = (): void => {
  dispatchEvent(new Event('rp:release'));
};

function open(gate: HTMLElement, screen: HTMLElement): void {
  const behind = [...document.body.children].filter(
    (el): el is HTMLElement => el instanceof HTMLElement && el !== gate && el.tagName !== 'SCRIPT' && el.tagName !== 'CANVAS',
  );
  for (const el of behind) el.inert = true;

  const steps = {
    build: screen.querySelector<HTMLElement>('[data-step="build"]'),
    lang: screen.querySelector<HTMLElement>('[data-step="lang"]'),
  };
  const tab = (name: 'build' | 'lang'): HTMLElement | null => screen.querySelector(`[data-tab="${name}"]`);
  let mode: BuildMode = 'present';
  let current: 'build' | 'lang' = 'build';
  let selected = 0;
  let launched = false;

  const options = (): HTMLButtonElement[] => [...(steps[current]?.querySelectorAll<HTMLButtonElement>('.gate__opt') ?? [])];

  const select = (index: number, focus = true): void => {
    const list = options();
    selected = (index + list.length) % list.length;
    list.forEach((option, i) => {
      option.classList.toggle('is-selected', i === selected);
      option.setAttribute('aria-current', String(i === selected));
    });
    const option = list[selected];
    if (focus) option?.focus({ preventScroll: true });
    option?.scrollIntoView({ block: 'nearest' });
  };

  const paintTabs = (): void => {
    tab('build')?.classList.toggle('is-now', current === 'build');
    tab('build')?.classList.toggle('is-done', current !== 'build');
    tab('lang')?.classList.toggle('is-now', current === 'lang');
  };

  const show = (step: 'build' | 'lang'): void => {
    current = step;
    if (steps.build) steps.build.hidden = step !== 'build';
    if (steps.lang) steps.lang.hidden = step !== 'lang';
    paintTabs();
    select(0);
  };

  /** La terminal se funde y la página sigue debajo, sin saltos. */
  const close = (): void => {
    for (const el of behind) el.inert = false;
    root.dataset.gateLeaving = '';
    gate.classList.add('is-leaving');
    const remove = (): void => {
      gate.remove();
      delete root.dataset.gate;
      delete root.dataset.gateLeaving;
      delete root.dataset.gateReady;
    };
    gate.addEventListener('transitionend', remove, { once: true });
    setTimeout(remove, 500);
  };

  /** Cada agente se reporta en la línea de su oficio antes de salir a construir. */
  const assemble = (): void => {
    const swarm = getSwarm();
    const count = new Map<RoleId, number>();
    swarm.assemble(
      swarm.agents.map((agent) => {
        const spot = screen.querySelector<HTMLElement>(`[data-spot="${agent.role}"]`)?.getBoundingClientRect();
        const i = count.get(agent.role) ?? 0;
        count.set(agent.role, i + 1);
        return { x: (spot?.left ?? innerWidth / 2) + 16 + i * 24, y: (spot?.top ?? innerHeight / 2) + 8 };
      }),
    );
  };

  const urlFor = (target: Lang, chosen: BuildMode): string => {
    const build = chosen === 'present' ? 'present' : chosen === 'manual' ? '1' : '0';
    return `${target === 'en' ? '/en/' : '/'}?build=${build}`;
  };

  const launch = (chosen: BuildMode, target: Lang): void => {
    if (launched) return;
    launched = true;
    removeEventListener('keydown', onKey);
    tab('build')?.classList.add('is-done');
    tab('lang')?.classList.add('is-done');

    const ask = screen.querySelector<HTMLElement>('[data-ask]');
    const log = screen.querySelector<HTMLElement>('[data-log]');
    const roster = screen.querySelector<HTMLElement>('[data-roster]');
    const title = screen.querySelector<HTMLElement>(`[data-log-title="${chosen}"]`);
    if (ask) ask.hidden = true;
    if (log) log.hidden = false;
    if (title) title.hidden = false;
    if (roster) roster.hidden = chosen === 'final';
    if (chosen !== 'final') assemble();

    if (chosen === 'final') {
      // Eligió no ver la construcción: la próxima visita tampoco pregunta.
      try {
        localStorage.setItem(BUILT_KEY, String(Date.now()));
      } catch {
        // Sin almacenamiento vuelve a preguntar, nada más.
      }
    }

    setTimeout(
      () => {
        if (target !== pageLang) {
          location.replace(urlFor(target, chosen));
          return;
        }
        window.scrollTo({ top: 0, behavior: 'instant' });
        if (chosen === 'final') {
          delete root.dataset.build;
          close();
          release();
          return;
        }
        if (chosen === 'present') root.dataset.pilot = 'present';
        close();
        getSwarm().disperse();
        dispatchEvent(new Event('rp:launch'));
        // El motor tiene que tomarla: si no llegó, la página se libera igual.
        setTimeout(() => {
          if (root.dataset.build === 'pending') {
            root.dataset.build = 'off';
            release();
          }
        }, WATCHDOG_MS);
      },
      chosen === 'final' ? QUICK_MS : LOG_MS,
    );
  };

  const choose = (index: number): void => {
    const value = options()[index]?.dataset.value;
    if (!value) return;
    if (current === 'build') {
      mode = value as BuildMode;
      show('lang');
    } else {
      launch(mode, value as Lang);
    }
  };

  // Cualquier tecla o toque durante la entrada la completa: la pregunta nunca hace esperar.
  const finishIntro = (): void => {
    if ('fast' in screen.dataset) return;
    screen.dataset.fast = '';
    select(selected);
  };

  const onKey = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const { key } = event;
    if (!('fast' in screen.dataset)) finishIntro();
    else if (key === 'ArrowDown' || key === 'j') select(selected + 1);
    else if (key === 'ArrowUp' || key === 'k') select(selected - 1);
    else if (key === 'ArrowLeft' && current === 'lang') show('build');
    else if (key === 'Enter') choose(selected);
    else if (key === 'Escape') launch('final', root.dataset.gate === 'en' ? 'en' : 'es');
    else if (/^[1-9]$/.test(key) && options()[Number(key) - 1]) choose(Number(key) - 1);
    else return;
    event.preventDefault();
  };

  for (const step of [steps.build, steps.lang]) {
    step?.querySelectorAll<HTMLButtonElement>('.gate__opt').forEach((option, i) => {
      option.addEventListener('pointermove', (event) => {
        if (event.pointerType !== 'touch' && i !== selected) select(i);
      });
      // El tabulador también mueve la selección: el foco y el puntero nunca se separan.
      option.addEventListener('focus', () => {
        if (i !== selected) select(i, false);
      });
      option.addEventListener('click', () => choose(i));
    });
  }

  // Hasta acá llega el watchdog del head: la terminal ya responde.
  root.dataset.gateReady = '';
  addEventListener('keydown', onKey);
  paintTabs();
  select(0, false);
  setTimeout(finishIntro, Math.max(0, INTRO_MS - performance.now()));
  addEventListener('pointerdown', finishIntro, { once: true, capture: true, passive: true });
}

const gate = document.querySelector<HTMLElement>('[data-gate-root]');
const screen = gate?.querySelector<HTMLElement>(`[data-screen="${root.dataset.gate}"]`);
if (gate && screen) {
  open(gate, screen);
} else {
  // Sin terminal la página nunca queda escondida.
  delete root.dataset.gate;
  gate?.remove();
  root.dataset.build = 'off';
  release();
}
