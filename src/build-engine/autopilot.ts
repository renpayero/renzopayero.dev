import gsap from 'gsap';

export type Pace = 'full' | 'present';

interface AutopilotDeps {
  sections: HTMLElement[];
  isBuilt: (section: HTMLElement) => boolean;
  pace: Pace;
  /** En presentación la próxima sección arranca justo antes de que la página llegue a ella. */
  request: (section: HTMLElement) => void;
  /** El visitante tomó el control: la página pasa a construirse con su scroll. */
  onStop: () => void;
}

export interface Pilot {
  setPaused: (paused: boolean) => void;
  stop: () => void;
}

interface Ride {
  from: number;
  to: number;
  /** Cuánto avanza en la primera parte: despacio, para que el contenido siga a la vista. */
  drift: number;
  read: number;
  move: number;
  apply: (value: number) => void;
  onNear?: () => void;
}

/**
 * La partitura de la presentación, en segundos: cuánto tienen los agentes para construir cada
 * sección y cuánto dura la salida hacia la siguiente. Suma 54 s; con el segundo de arranque en la
 * terminal, 55 s. Para cambiar el ritmo alcanza con tocar estos números.
 */
const SCORE: Record<string, { build: number; leave: number }> = {
  hero: { build: 3.3, leave: 2.1 },
  manifiesto: { build: 2, leave: 2.4 },
  sistema: { build: 2, leave: 1.7 },
  escena: { build: 3, leave: 2.4 },
  proyectos: { build: 3, leave: 5.9 },
  galeria: { build: 2.1, leave: 6.9 },
  experiencia: { build: 2, leave: 3.6 },
  capacidades: { build: 2.8, leave: 2.3 },
  como: { build: 2.6, leave: 1.7 },
  contacto: { build: 2.2, leave: 0 },
};

/** Las filas sueltas acompañan el ritmo de las secciones. */
export const MICRO_SPEED = 1.5;
/** El giro del teléfono entra en su lugar de la partitura sin perder la animación. */
const DEVICE_RATE = 1.3;
/** Cuánto hay que apurar a los agentes para que la sección entre en su lugar. Nunca se los frena. */
export const presentSpeed = (section: HTMLElement, duration: number): number => {
  const build = SCORE[section.dataset.section ?? '']?.build;
  return build ? Math.max(1, duration / build) : 1;
};

const INTERRUPTS = ['wheel', 'touchstart', 'pointerdown'] as const;
const KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Tab']);
const OWN_CONTROLS = '[data-hud], [data-swarm-toggle]';

/** La velocidad de la deriva: se nota que la página sigue viva y el texto se lee igual. */
const DRIFT_PX_PER_S = 34;
const RAMP_S = 0.4;
const MIN_LEAVE_S = 0.7;
const MOVE_MIN_S = 0.6;
const MOVE_MAX_S = 1;
const MOVE_PX_PER_S = 1000;
const GALLERY_EXIT_S = 1.4;
const TILE_MOVE_SHARE = 0.38;
/** La próxima sección arranca un instante antes de llegar: nunca hay un cuadro sin nada en marcha. */
const BUILD_LEAD_S = 0.18;
const POLL_MS = 20;
/** Dónde queda el título al llegar: con aire para derivar sin meterse debajo del menú. */
const LEAD_TOP = { min: 96, ratio: 0.18, max: 170 };

const topOf = (el: Element): number => el.getBoundingClientRect().top + scrollY;
const scrollToY = (y: number): void => window.scrollTo({ top: y, behavior: 'instant' });

/**
 * La posición en cada instante de un recorrido: arranca suave, deriva a velocidad constante y
 * después se apura hasta frenar justo en el destino, sin cambios bruscos de velocidad.
 */
function profile({ from, to, drift, read, move }: Ride): (t: number) => number {
  const total = to - from;
  const ramp = Math.min(RAMP_S, read / 2);
  const reached = gsap.utils.clamp(0, Math.max(0, total) * 0.8, drift);
  const speed = reached / (read - ramp / 2);
  const push = Math.min(move * speed, 3 * (total - reached));
  return (t) => {
    if (t <= ramp) return from + (speed * t * t) / (2 * ramp);
    if (t <= read) return from + speed * (t - ramp / 2);
    const u = Math.min((t - read) / move, 1);
    const u2 = u * u;
    const u3 = u2 * u;
    return from + (2 * u3 - 3 * u2 + 1) * reached + (u3 - 2 * u2 + u) * push + (3 * u2 - 2 * u3) * total;
  };
}

/**
 * Recorre la página sola mientras los agentes construyen. `full` es la repetición, a su ritmo.
 * `present` es la presentación: entra en menos de un minuto, para poder grabarla, y nunca se queda
 * quieta: o construyen los agentes o la página se está moviendo. Cualquier gesto devuelve el control.
 */
export function runAutopilot({ sections, isBuilt, pace, request, onStop }: AutopilotDeps): Pilot {
  let stopped = false;
  let paused = false;
  let tween: gsap.core.Tween | null = null;

  // El reloj de la partitura se detiene con la pausa y con la pestaña oculta.
  const startedAt = performance.now();
  let frozenAt = 0;
  let frozenFor = 0;
  const syncClock = (): void => {
    const now = performance.now();
    if ((paused || document.hidden) && !frozenAt) frozenAt = now;
    else if (!paused && !document.hidden && frozenAt) {
      frozenFor += now - frozenAt;
      frozenAt = 0;
    }
  };
  const clock = (): number => ((frozenAt || performance.now()) - startedAt - frozenFor) / 1000;

  const onGesture = (event: Event): void => {
    if (event.type !== 'wheel' && event.target instanceof Element && event.target.closest(OWN_CONTROLS)) return;
    stop();
  };
  const onKey = (event: KeyboardEvent): void => {
    if (!KEYS.has(event.key)) return;
    if (event.target instanceof Element && event.target.closest(OWN_CONTROLS)) return;
    stop();
  };
  const unlisten = (): void => {
    for (const type of INTERRUPTS) removeEventListener(type, onGesture);
    removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', syncClock);
  };
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    tween?.kill();
    unlisten();
    onStop();
  };
  for (const type of INTERRUPTS) addEventListener(type, onGesture, { passive: true });
  addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', syncClock);

  /** Una espera real: la pausa la congela, con la pestaña oculta no corre y un gesto la corta. */
  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      let left = ms;
      let last = performance.now();
      const tick = (): void => {
        const now = performance.now();
        if (!paused && !document.hidden) left -= now - last;
        last = now;
        if (stopped || left <= 0) {
          resolve();
          return;
        }
        setTimeout(tick, Math.min(left, 100));
      };
      tick();
    });

  const glide = (top: number, seconds: number, ease: string): Promise<void> =>
    new Promise((resolve) => {
      const state = { y: scrollY };
      tween = gsap.to(state, {
        y: top,
        duration: seconds,
        ease,
        paused,
        onUpdate: () => scrollToY(state.y),
        onComplete: () => resolve(),
        onInterrupt: () => resolve(),
      });
    });

  const ride = (trip: Ride): Promise<void> =>
    new Promise((resolve) => {
      const at = profile(trip);
      const total = trip.read + trip.move;
      const state = { t: 0 };
      let near = false;
      tween = gsap.to(state, {
        t: total,
        duration: total,
        ease: 'none',
        paused,
        onUpdate: () => {
          trip.apply(at(state.t));
          if (!near && total - state.t <= BUILD_LEAD_S) {
            near = true;
            trip.onNear?.();
          }
        },
        onComplete: () => resolve(),
        onInterrupt: () => resolve(),
      });
    });

  const builtOf = async (section: HTMLElement): Promise<void> => {
    while (!stopped && !isBuilt(section)) await sleep(POLL_MS);
  };

  const replay = async (): Promise<void> => {
    for (const section of sections) {
      if (stopped) return;
      const top = topOf(section);
      const distance = Math.abs(top - scrollY);
      if (distance > 4) await glide(top, gsap.utils.clamp(0.9, 2.6, distance / 900), 'power2.inOut');
      await builtOf(section);
      if (stopped) return;
      await sleep(500);
      const extra = section.offsetHeight - innerHeight;
      // Las secciones largas se recorren enteras: ahí viven las escenas atadas al scroll.
      if (!stopped && extra > 40) {
        await glide(top + extra, gsap.utils.clamp(1.4, 7, extra / 720), 'none');
        await sleep(600);
      }
    }
  };

  /** A qué segundo de la partitura tiene que estar llegando a la sección siguiente. */
  const deadlines = new Map<HTMLElement, number>();
  let sum = 0;
  for (const section of sections) {
    const part = SCORE[section.dataset.section ?? ''];
    sum += (part?.build ?? 2) + (part?.leave ?? 2);
    deadlines.set(section, sum);
  }

  /** Dónde tiene que quedar la página para que la sección se vea entera, con aire para seguir bajando. */
  const stopFor = (section: HTMLElement): number => {
    const top = topOf(section);
    if (section.dataset.start === 'top') return top;
    const height = section.offsetHeight;
    if (height < innerHeight) return Math.max(0, top - (innerHeight - height) / 2);
    const lead = section.querySelector('h1, h2, [data-tile]');
    const room = gsap.utils.clamp(LEAD_TOP.min, LEAD_TOP.max, innerHeight * LEAD_TOP.ratio);
    return Math.max(0, Math.min(top, (lead ? topOf(lead) : top) - room));
  };

  /** Un proyecto por vez hasta el segundo indicado: la galería nunca frena y cada baldosa pasa despacio. */
  const tour = async (gallery: Element, until: number): Promise<void> => {
    const track = gallery.querySelector<HTMLElement>('[data-gallery-track]');
    const tiles = [...gallery.querySelectorAll<HTMLElement>('[data-tile]')];
    if (!track || tiles.length < 2) return;
    // El encastre pelea con un movimiento continuo: vuelve apenas termina el recorrido.
    track.style.scrollSnapType = 'none';
    const centered = (tile: HTMLElement): number => {
      const t = tile.getBoundingClientRect();
      const r = track.getBoundingClientRect();
      return track.scrollLeft + t.left - r.left - (r.width - t.width) / 2;
    };
    const rest = tiles.slice(1);
    for (const [i, tile] of rest.entries()) {
      if (stopped) break;
      const total = Math.max(MIN_LEAVE_S, (until - clock()) / (rest.length - i));
      const move = total * TILE_MOVE_SHARE;
      const read = total - move;
      await ride({
        from: track.scrollLeft,
        to: centered(tile),
        drift: DRIFT_PX_PER_S * read,
        read,
        move,
        apply: (x) => track.scrollTo({ left: x, behavior: 'instant' }),
      });
    }
    track.style.removeProperty('scroll-snap-type');
  };

  /** Cuánto avanza la página antes de apurarse: lo que queda de la sección, o una deriva lenta. */
  const driftOf = (section: HTMLElement, read: number): number => {
    const below = Math.max(0, section.getBoundingClientRect().bottom - innerHeight);
    const device = section.querySelector('[data-device]');
    if (device) {
      // El teléfono pasa por el centro mientras gira, y no se va de pantalla antes de terminar.
      const r = device.getBoundingClientRect();
      return Math.min(Math.max(r.top + r.height / 2 - innerHeight / 2 + 60, below), Math.max(r.bottom, 0));
    }
    return Math.max(below, DRIFT_PX_PER_S * read);
  };

  const leave = async (section: HTMLElement, next: HTMLElement): Promise<void> => {
    // La escena fija no cambia mientras dura: el salto al final de su recorrido no se ve.
    if (section.dataset.start === 'top') scrollToY(topOf(section) + section.offsetHeight - innerHeight);
    // El video del dispositivo tiene que llegar cargado: el giro no puede arrancar tarde.
    const video = next.querySelector<HTMLVideoElement>('[data-device] video');
    if (video) {
      video.preload = 'auto';
      video.defaultPlaybackRate = DEVICE_RATE;
      video.playbackRate = DEVICE_RATE;
    }

    const deadline = deadlines.get(section) ?? clock();
    const gallery = section.closest('[data-gallery]') ?? section.querySelector('[data-gallery]');
    if (gallery) await tour(gallery, deadline - GALLERY_EXIT_S);
    if (stopped) return;

    const total = Math.max(MIN_LEAVE_S, deadline - clock());
    const from = scrollY;
    const to = Math.min(stopFor(next), document.documentElement.scrollHeight - innerHeight);
    const move = gsap.utils.clamp(Math.min(MOVE_MIN_S, total * 0.6), Math.min(MOVE_MAX_S, total * 0.6), (to - from) / MOVE_PX_PER_S);
    const read = total - move;
    await ride({ from, to, drift: driftOf(section, read), read, move, apply: scrollToY, onNear: () => request(next) });
  };

  const present = async (): Promise<void> => {
    for (const [i, section] of sections.entries()) {
      if (stopped) return;
      request(section);
      await builtOf(section);
      const next = sections[i + 1];
      if (stopped || !next) return;
      await leave(section, next);
    }
  };

  void (pace === 'present' ? present() : replay()).finally(unlisten);

  return {
    stop,
    setPaused: (value) => {
      paused = value;
      syncClock();
      if (value) tween?.pause();
      else tween?.resume();
    },
  };
}
