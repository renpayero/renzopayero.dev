// Atlas con los contornos reales de Inter: lo usan los agentes para trazar cualquier titular
// sobre la página. Se descarga solo en la primera visita, en su propio archivo.
import { readFileSync, writeFileSync } from 'node:fs';
import * as fontkit from 'fontkit';
import wawoff2 from 'wawoff2';

const FONT = 'src/assets/fonts/inter-latin-opsz-normal.woff2';
const OUT = 'src/generated/glyphs.json';

const LATIN = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('') + 'áéíóúüñÁÉÍÓÚÜÑ¿¡’';
// El peso 700 solo aparece en "Hablemos." y en el centro del sistema.
const BOLD = "Hablemos.Let'stk Odoo";

const ttf = Buffer.from(await wawoff2.decompress(readFileSync(FONT)));
const base = fontkit.create(ttf);

function toD(path) {
  return path.commands
    .map(({ command, args }) => {
      const a = args.map((v, i) => Math.round(i % 2 === 0 ? v : -v));
      if (command === 'moveTo') return `M${a.join(' ')}`;
      if (command === 'lineTo') return `L${a.join(' ')}`;
      if (command === 'quadraticCurveTo') return `Q${a.join(' ')}`;
      if (command === 'bezierCurveTo') return `C${a.join(' ')}`;
      return 'Z';
    })
    .join('');
}

function sheet(chars, wght) {
  const font = base.getVariation({ wght, opsz: 32 });
  const out = {};
  for (const ch of new Set(chars)) {
    if (ch === ' ') continue;
    const d = toD(font.glyphForCodePoint(ch.codePointAt(0)).path);
    if (d) out[ch] = d;
  }
  return out;
}

const font = base.getVariation({ wght: 600, opsz: 32 });
const atlas = {
  upm: font.unitsPerEm,
  ascent: font.hhea.ascent,
  descent: font.hhea.descent,
  w600: sheet(LATIN, 600),
  w700: sheet(BOLD, 700),
};
const json = JSON.stringify(atlas);
writeFileSync(OUT, `${json}\n`);
console.log(`${Object.keys(atlas.w600).length}+${Object.keys(atlas.w700).length} glifos, ${Math.round(json.length / 1024)} KB`);
