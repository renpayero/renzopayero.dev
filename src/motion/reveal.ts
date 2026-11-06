// Disparo medido en Apple: la clase entra cuando el elemento llega al 70% de la pantalla
// y la transición corre por tiempo. Si la sección todavía se va a construir, espera a los agentes.
const root = document.documentElement;

// La barra sticky acompaña apenas el hero queda atrás, con o sin preferencia de movimiento.
const localNav = document.querySelector('.localnav');
const hero = document.querySelector('.hero');
if (localNav && hero) {
  new IntersectionObserver(([entry]) => {
    localNav.classList.toggle('is-on', !(entry?.isIntersecting ?? true));
  }, { rootMargin: '-10% 0px 0px 0px' }).observe(hero);
}

if (matchMedia('(prefers-reduced-motion: no-preference)').matches) {
  const building = (): boolean => root.dataset.build === 'pending' || root.dataset.build === 'running';

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const section = entry.target.closest<HTMLElement>('[data-section]');
        if (building() && section && !('built' in section.dataset)) continue;
        entry.target.classList.add('is-in');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -30% 0px' },
  );

  const watch = (): void => {
    observer.disconnect();
    document.querySelectorAll('.reveal:not(.is-in)').forEach((el) => observer.observe(el));
  };

  watch();
  // Observar de nuevo fuerza una evaluación: sirve cuando una sección termina o el motor no llegó.
  addEventListener('rp:release', watch);
}
