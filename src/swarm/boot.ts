import { getSwarm } from './swarm';

// La impronta del sitio: los agentes orbitan el cursor desde el primer movimiento, en cualquier visita.
// Sin puntero o con movimiento reducido no hay enjambre; el canvas se crea recién al usarlo.
if (
  matchMedia('(prefers-reduced-motion: no-preference)').matches &&
  matchMedia('(hover: hover) and (pointer: fine)').matches
) {
  addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'touch') getSwarm().pointerAt(event.clientX, event.clientY);
    },
    { once: true, passive: true },
  );
}
