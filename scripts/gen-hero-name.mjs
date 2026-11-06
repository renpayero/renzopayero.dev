// Genera los contornos del nombre con las mismas métricas que usa el navegador,
// para que el trazado de los agentes coincida con el texto real a cualquier ancho.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import * as fontkit from 'fontkit';
import wawoff2 from 'wawoff2';

const FONT = 'src/assets/fonts/inter-latin-opsz-normal.woff2';
const OUT = 'src/generated/hero-name.json';
const WORDS = ['Renzo', 'Payero'];
const AXES = { wght: 700, opsz: 32 };
const TRACKING_EM = -0.035;
const LINE_HEIGHT = 0.92;

const ttf = Buffer.from(await wawoff2.decompress(readFileSync(FONT)));
const base = fontkit.create(ttf);
const font = base.getVariation(AXES);
const upm = font.unitsPerEm;
const round = (n) => Math.round(n * 10) / 10;

// Convierte comandos de fontkit a data SVG en coordenadas de pantalla (y hacia abajo).
function toD(path, dx) {
  return path.commands
    .map(({ command, args }) => {
      const a = args.map((v, i) => round(i % 2 === 0 ? v + dx : -v));
      if (command === 'moveTo') return `M${a.join(' ')}`;
      if (command === 'lineTo') return `L${a.join(' ')}`;
      if (command === 'quadraticCurveTo') return `Q${a.join(' ')}`;
      if (command === 'bezierCurveTo') return `C${a.join(' ')}`;
      return 'Z';
    })
    .join('');
}

const contentArea = font.hhea.ascent - font.hhea.descent + font.hhea.lineGap;
const lineBox = LINE_HEIGHT * upm;
const baseline = (lineBox - (font.hhea.ascent - font.hhea.descent)) / 2 + font.hhea.ascent;

const words = WORDS.map((text) => {
  const run = font.layout(text, ['kern', 'calt']);
  let x = 0;
  const glyphs = run.glyphs.map((glyph, i) => {
    const d = toD(glyph.path, x + run.positions[i].xOffset);
    x += run.positions[i].xAdvance + TRACKING_EM * upm;
    // Cada contorno por separado: los agentes los trazan en orden.
    return { d, contours: d.split(/(?=M)/) };
  });
  return { text, advance: round(x), glyphs };
});

mkdirSync('src/generated', { recursive: true });
writeFileSync(
  OUT,
  `${JSON.stringify({ upm, baseline: round(baseline), lineBox: round(lineBox), trackingEm: TRACKING_EM, lineHeight: LINE_HEIGHT, axes: AXES, words }, null, 1)}\n`,
);
console.log(
  'ejes:', Object.keys(base.variationAxes).join(','),
  '| upm', upm, '| hhea', font.hhea.ascent, font.hhea.descent, font.hhea.lineGap,
  '| contentArea', contentArea,
  '|', words.map((w) => `${w.text}=${w.advance}`).join(' '),
);
