import { getSwarm } from './swarm';

const OFF_KEY = 'rp-orbit-off';

const readOff = (): boolean => {
  try {
    return localStorage.getItem(OFF_KEY) === '1';
  } catch {
    return false;
  }
};

// La impronta del sitio: los agentes orbitan el cursor desde el primer movimiento, en cualquier visita.
// Sin puntero o con movimiento reducido no hay enjambre; el canvas se crea recién al usarlo.
if (
  matchMedia('(prefers-reduced-motion: no-preference)').matches &&
  matchMedia('(hover: hover) and (pointer: fine)').matches
) {
  let off = readOff();

  const paint = (): void => {
    const button = document.querySelector<HTMLElement>('[data-swarm-toggle]');
    button?.setAttribute('aria-pressed', String(!off));
    button?.querySelector('[data-swarm-on]')?.toggleAttribute('hidden', off);
    button?.querySelector('[data-swarm-off]')?.toggleAttribute('hidden', !off);
  };
  paint();

  document.querySelector('[data-swarm-toggle]')?.addEventListener('click', () => {
    off = !off;
    try {
      localStorage.setItem(OFF_KEY, off ? '1' : '0');
    } catch {
      // Sin almacenamiento vale solo para esta página.
    }
    getSwarm().setOrbitVisible(!off);
    paint();
  });

  addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'touch') return;
      const swarm = getSwarm();
      swarm.setOrbitVisible(!off);
      swarm.pointerAt(event.clientX, event.clientY);
    },
    { once: true, passive: true },
  );
}
