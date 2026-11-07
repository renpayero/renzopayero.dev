// Disparo medido en Apple: la clase entra cuando el elemento llega al 70% de la pantalla
// y la transición corre por tiempo. Si la sección todavía se va a construir, espera a los agentes.
const root = document.documentElement;
const LINE = 0.7;

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

  const onCross: IntersectionObserverCallback = (entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const section = entry.target.closest<HTMLElement>('[data-section]');
      if (building() && section && !('built' in section.dataset)) continue;
      if (building() && entry.target.closest('[data-micro]')) continue;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    }
  };

  const atLine = new IntersectionObserver(onCross, { rootMargin: '0px 0px -30% 0px' });
  const atEdge = new IntersectionObserver(onCross);

  // Lo último de la página no llega nunca a esa línea porque el scroll se termina antes:
  // eso entra apenas aparece en pantalla, o quedaría invisible para siempre.
  const reachesLine = (el: Element): boolean => {
    const lastScroll = document.documentElement.scrollHeight - innerHeight;
    return el.getBoundingClientRect().top + scrollY - lastScroll < innerHeight * LINE;
  };

  const watch = (): void => {
    atLine.disconnect();
    atEdge.disconnect();
    document.querySelectorAll('.reveal:not(.is-in)').forEach((el) => (reachesLine(el) ? atLine : atEdge).observe(el));
  };

  watch();
  // Observar de nuevo fuerza una evaluación: sirve cuando una sección termina o el motor no llegó.
  addEventListener('rp:release', watch);
  // Quién llega a la línea depende de la altura de la página y de la ventana.
  void document.fonts.ready.then(watch);
  addEventListener('load', watch);
  let resizing = 0;
  addEventListener(
    'resize',
    () => {
      clearTimeout(resizing);
      resizing = window.setTimeout(watch, 150);
    },
    { passive: true },
  );
}
