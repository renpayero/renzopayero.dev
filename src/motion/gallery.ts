// Galería al estilo "Get the highlights": cada baldosa reproduce su video cuando está centrada,
// la píldora muestra el progreso y al terminar pasa sola a la siguiente, salvo que se pause.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

for (const gallery of document.querySelectorAll<HTMLElement>('[data-gallery]')) {
  const track = gallery.querySelector<HTMLElement>('[data-gallery-track]');
  const tiles = [...gallery.querySelectorAll<HTMLElement>('[data-tile]')];
  const dots = [...gallery.querySelectorAll<HTMLButtonElement>('[data-dot]')];
  const toggle = gallery.querySelector<HTMLButtonElement>('[data-gallery-toggle]');
  if (!track || !tiles.length) continue;

  const videoOf = (i: number) => tiles[i]?.querySelector('video') ?? null;
  let current = 0;
  let playing = !reduced;
  let inView = false;

  const paint = (): void => {
    dots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === current);
      dot.setAttribute('aria-current', String(i === current));
    });
    if (toggle) {
      toggle.setAttribute('aria-label', (playing ? toggle.dataset.pause : toggle.dataset.play) ?? '');
      toggle.querySelector('[data-icon-pause]')?.toggleAttribute('hidden', !playing);
      toggle.querySelector('[data-icon-play]')?.toggleAttribute('hidden', playing);
    }
  };

  const sync = (): void => {
    tiles.forEach((_, i) => {
      const video = videoOf(i);
      if (!video) return;
      if (i === current && playing && inView) {
        if (video.preload !== 'auto') video.preload = 'auto';
        void video.play().catch(() => {
          // Autoplay bloqueado: queda el póster, que ya es el contenido.
        });
      } else {
        video.pause();
      }
    });
    paint();
  };

  const goTo = (index: number, smooth = true): void => {
    const tile = tiles[index];
    if (!tile) return;
    track.scrollTo({ left: tile.offsetLeft - track.offsetLeft, behavior: smooth && !reduced ? 'smooth' : 'auto' });
  };

  tiles.forEach((tile, i) => {
    const video = tile.querySelector('video');
    video?.addEventListener('timeupdate', () => {
      if (i === current && video.duration) {
        dots[i]?.style.setProperty('--p', String(video.currentTime / video.duration));
      }
    });
    video?.addEventListener('ended', () => {
      if (i !== current) return;
      dots[i]?.style.setProperty('--p', '1');
      goTo((i + 1) % tiles.length);
    });
  });

  dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));
  toggle?.addEventListener('click', () => {
    playing = !playing;
    sync();
  });

  // La baldosa centrada manda, sea por swipe, teclado, botón o avance automático.
  const centered = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const index = tiles.indexOf(entry.target as HTMLElement);
        if (index === current) continue;
        const previous = videoOf(current);
        if (previous) previous.currentTime = 0;
        dots[current]?.style.setProperty('--p', '0');
        current = index;
        sync();
      }
    },
    { root: track, threshold: 0.6 },
  );
  tiles.forEach((tile) => centered.observe(tile));

  // Fuera de pantalla no se gasta nada.
  new IntersectionObserver(
    ([entry]) => {
      inView = entry?.isIntersecting ?? false;
      sync();
    },
    { threshold: 0.25 },
  ).observe(gallery);

  paint();
}
