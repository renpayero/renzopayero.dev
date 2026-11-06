import gsap from 'gsap';

interface AutopilotDeps {
  sections: HTMLElement[];
  isBuilt: (section: HTMLElement) => boolean;
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * El build completo, como en el reel: recorre la página sola mientras los agentes construyen.
 * Cualquier gesto del visitante le devuelve el control al instante: el scroll nunca se pelea.
 */
export async function runAutopilot({ sections, isBuilt }: AutopilotDeps): Promise<void> {
  let stopped = false;
  let tween: gsap.core.Tween | null = null;
  const INTERRUPTS = ['wheel', 'touchstart', 'pointerdown'] as const;
  const KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Tab']);

  const stop = (): void => {
    stopped = true;
    tween?.kill();
  };
  const onKey = (event: KeyboardEvent): void => {
    if (KEYS.has(event.key)) stop();
  };
  for (const type of INTERRUPTS) addEventListener(type, stop, { passive: true, once: true });
  addEventListener('keydown', onKey);

  const scrollTo_ = (top: number, seconds: number, ease: string): Promise<void> =>
    new Promise((resolve) => {
      const state = { y: scrollY };
      tween = gsap.to(state, {
        y: top,
        duration: seconds,
        ease,
        onUpdate: () => window.scrollTo({ top: state.y, behavior: 'instant' }),
        onComplete: () => resolve(),
        onInterrupt: () => resolve(),
      });
    });

  const topOf = (el: Element): number => el.getBoundingClientRect().top + scrollY;

  try {
    for (const section of sections) {
      if (stopped) break;
      const top = topOf(section);
      const distance = Math.abs(top - scrollY);
      if (distance > 4) await scrollTo_(top, gsap.utils.clamp(0.9, 2.6, distance / 900), 'power2.inOut');
      while (!stopped && !isBuilt(section)) await wait(60);
      if (stopped) break;
      await wait(500);
      const extra = section.offsetHeight - innerHeight;
      // Las secciones largas se recorren enteras: ahí viven las escenas atadas al scroll.
      if (!stopped && extra > 40) {
        await scrollTo_(top + extra, gsap.utils.clamp(1.4, 7, extra / 720), 'none');
        await wait(600);
      }
    }
  } finally {
    for (const type of INTERRUPTS) removeEventListener(type, stop);
    removeEventListener('keydown', onKey);
  }
}
