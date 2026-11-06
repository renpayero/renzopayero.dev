interface Atlas {
  upm: number;
  ascent: number;
  descent: number;
  w600: Record<string, string>;
  w700: Record<string, string>;
}

export interface Glyph {
  path: Path2D;
  length: number;
  /** Primer contorno: es el que recorre el agente. */
  outline: SVGPathElement;
  outlineLength: number;
  /** Puntos de control, en unidades de la fuente: lo que los agentes "calculan". */
  points: Float32Array;
  vectors: number;
}

let atlas: Atlas | null = null;
const cache = new Map<string, Glyph>();

/** En su propio archivo: nada de esto se descarga en una visita repetida. */
export function loadAtlas(): Promise<void> {
  return import('../generated/glyphs.json').then((module) => {
    atlas = module.default as Atlas;
  });
}

export const metrics = (): { upm: number; ascent: number; descent: number } | null => atlas;

const makePath = (d: string): SVGPathElement => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  el.setAttribute('d', d);
  return el;
};

export function glyph(char: string, weight: number): Glyph | null {
  if (!atlas) return null;
  const bold = weight >= 650 && char in atlas.w700;
  const key = `${bold ? 7 : 6}${char}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const d = (bold ? atlas.w700 : atlas.w600)[char];
  if (!d) return null;
  const numbers = (d.match(/-?\d+/g) ?? []).map(Number);
  const whole = makePath(d);
  const outline = makePath(d.split(/(?=M)/)[0] ?? d);
  const made: Glyph = {
    path: new Path2D(d),
    length: whole.getTotalLength(),
    outline,
    outlineLength: outline.getTotalLength(),
    points: Float32Array.from(numbers),
    vectors: (d.match(/[MLQC]/g) ?? []).length,
  };
  cache.set(key, made);
  return made;
}
