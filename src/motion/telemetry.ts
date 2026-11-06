// Ningún número de esta sección está escrito a mano: o se mide en este navegador o sale del build.
const box = document.querySelector<HTMLElement>('[data-telemetry]');

const show = (id: string, value: string): void => {
  const row = box?.querySelector<HTMLElement>(`[data-metric="${id}"]`);
  const target = row?.querySelector<HTMLElement>('[data-value]');
  if (!row || !target) return;
  target.textContent = value;
  row.hidden = false;
};

if (box) {
  try {
    new PerformanceObserver((list) => {
      const last = list.getEntries().at(-1);
      if (last) show('lcp', `${Math.round(last.startTime)} ms`);
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    // Safari y Firefox viejos no miden LCP: esa fila queda oculta en lugar de inventarla.
  }

  void fetch('/build-stats.json')
    .then((res) => (res.ok ? res.json() : null))
    .then((stats: { jsKb?: number; commits?: number; tests?: number } | null) => {
      if (!stats) return;
      if (stats.jsKb) show('js', `${stats.jsKb} KB`);
      if (stats.commits) show('commits', String(stats.commits));
      if (stats.tests) show('tests', String(stats.tests));
    })
    .catch(() => {
      // En desarrollo no existe: las filas quedan ocultas.
    });
}
