export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rectángulo en coordenadas de documento: el overlay resta el scroll al pintar. */
export const docRect = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
};

export const need = <T extends Element>(root: ParentNode, selector: string): T => {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`falta ${selector}`);
  return el;
};

/** Contraste WCAG real, medido sobre lo que el navegador está pintando. */
export function contrast(el: Element): number {
  const lum = (css: string): number => {
    const parts = css.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
    const [r = 0, g = 0, b = 0] = parts.map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const fg = lum(getComputedStyle(el).color);
  const bg = lum(getComputedStyle(document.documentElement).backgroundColor);
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
}
