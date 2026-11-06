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
  /** Cuánto avanza mientras se lee: despacio, para que el contenido siga a la vista. */
  drift: number;
  read: number;
  move: number;
  apply: (value: number) => void;
  onNear?: () => void;
}

const INTERRUPTS = ['wheel', 'touchstart', 'pointerdown'] as const;
const KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Tab']);
const OWN_CONTROLS = '[data-hud], [data-swarm-toggle]';

/** El ritmo de la presentación: da para leer, sin esperas de más. Lectura ágil: unas 330 palabras por minuto. */
const WORDS_PER_SECOND = 5.5;
const LOOK_S = 0.6;
const MIN_READ_S = 1.6;
const MAX_READ_S = 4;
const LONG_READ_MAX_S = 6.5;
const TILE_READ_S = 2.3;
const TILE_MOVE_S = 0.7;
const VIDEO_FALLBACK_S = 6.4;
/** La velocidad de la deriva: se nota que la página sigue viva y el texto se lee igual. */
const DRIFT_PX_PER_S = 34;
const RAMP_S = 0.5;
const MOVE_MIN_S = 0.9;
const MOVE_MAX_S = 2.2;
const MOVE_PX_PER_S = 900;
/** La próxima sección arranca un instante antes de llegar: nunca hay un cuadro sin nada en marcha. */
const BUILD_LEAD_S = 0.18;
const POLL_MS = 20;
/** Dónde queda el título al llegar: con aire para derivar sin meterse debajo del menú. */
const LEAD_TOP = { min: 96, ratio: 0.18, max: 170 };

const topOf = (el: Element): number => el.getBoundingClientRect().top + scrollY;
const scrollToY = (y: number): void => window.scrollTo({ top: y, behavior: 'instant' });

/** Las palabras que están en pantalla, o las que faltan: el tiempo sale del contenido real. */
function countWords(root: Element, inView: boolean): number {
  let words = 0;
  const range = document.createRange();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const text = node.nodeValue?.trim();
    if (!text || node.parentElement?.closest('[aria-hidden="true"]')) continue;
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    if (!r.width) continue;
    const on = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    if (on === inView) words += text.split(/\s+/).length;
  }
  return words;
}

/**
 * La posición en cada instante de un recorrido: arranca suave, deriva a velocidad constante mientras
 * se lee y después se apura hasta frenar justo en el destino, sin cambios bruscos de velocidad.
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
 * Recorre la página sola mientras los agentes construyen. `full` es la repetición, con el ritmo de
 * un reel. `present` es para verla por primera vez: da tiempo a leer cada sección y al video del
 * dispositivo, pero nunca se queda quieta: o construyen los agentes o la página se está moviendo.
 * Cualquier gesto devuelve el control al instante.
 */
export function runAutopilot({ sections, isBuilt, pace, request, onStop }: AutopilotDeps): Pilot {
  let stopped = false;
  let paused = false;
  let tween: gsap.core.Tween | null = null;

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

  const reading = (root: Element): number =>
    gsap.utils.clamp(MIN_READ_S, MAX_READ_S, LOOK_S + countWords(root, true) / WORDS_PER_SECOND);

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

  /** Un proyecto por vez: la galería nunca frena, cada baldosa pasa despacio y salta a la siguiente. */
  const tour = async (gallery: Element): Promise<void> => {
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
    for (const tile of tiles.slice(1)) {
      if (stopped) break;
      await ride({
        from: track.scrollLeft,
        to: centered(tile),
        drift: DRIFT_PX_PER_S * TILE_READ_S,
        read: TILE_READ_S,
        move: TILE_MOVE_S,
        apply: (x) => track.scrollTo({ left: x, behavior: 'instant' }),
      });
    }
    track.style.removeProperty('scroll-snap-type');
  };

  /** Lo que queda por leer de la sección, y a qué velocidad se puede bajar mientras tanto. */
  const leaving = (section: HTMLElement): { read: number; drift: number } => {
    const below = Math.max(0, section.getBoundingClientRect().bottom - innerHeight);
    const device = section.querySelector<HTMLElement>('[data-device]');
    if (device) {
      // El texto del costado se lee mientras gira el teléfono: el recorrido dura lo que dura el giro.
      const video = device.querySelector('video');
      const left = video?.ended ? 0 : video && video.duration > 0 ? video.duration - video.currentTime : VIDEO_FALLBACK_S;
      const r = device.getBoundingClientRect();
      const toCenter = r.top + r.height / 2 - innerHeight / 2;
      return { read: Math.max(MIN_READ_S, left + 0.3), drift: Math.min(Math.max(toCenter + 60, below), Math.max(r.bottom, 0)) };
    }
    // Lo que falta más abajo se lee mientras baja: como un teleprompter, sin sobrepasar la sección.
    const read = Math.min(LONG_READ_MAX_S, reading(section) + countWords(section, false) / WORDS_PER_SECOND);
    return { read, drift: Math.max(below, DRIFT_PX_PER_S * read) };
  };

  const leave = async (section: HTMLElement, next: HTMLElement): Promise<void> => {
    // La escena fija no cambia mientras dura: el salto al final de su recorrido no se ve, y sale despacio.
    if (section.dataset.start === 'top') scrollToY(topOf(section) + section.offsetHeight - innerHeight);
    // El video del dispositivo tiene que llegar cargado: el giro no puede arrancar tarde.
    const video = next.querySelector<HTMLVideoElement>('[data-device] video');
    if (video) video.preload = 'auto';

    const gallery = section.closest('[data-gallery]') ?? section.querySelector('[data-gallery]');
    if (gallery) await tour(gallery);
    if (stopped) return;

    const { read, drift } = gallery ? { read: TILE_READ_S, drift: DRIFT_PX_PER_S * TILE_READ_S } : leaving(section);
    const from = scrollY;
    const to = Math.min(stopFor(next), document.documentElement.scrollHeight - innerHeight);
    await ride({
      from,
      to,
      drift,
      read,
      move: gsap.utils.clamp(MOVE_MIN_S, MOVE_MAX_S, (to - from - drift) / MOVE_PX_PER_S),
      apply: scrollToY,
      onNear: () => request(next),
    });
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
      if (value) tween?.pause();
      else tween?.resume();
    },
  };
}
