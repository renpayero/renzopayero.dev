// Recorta el fondo blanco de la foto y la pasa a duotono ciruela.
// La fuente queda fuera del repo; el resultado es lo único que se versiona.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = process.argv[2] ?? 'C:/Users/renzo/OneDrive/DAKODEV/Foto Linkedin.png';
const OUT = 'src/assets/retrato.webp';
const INK = [11, 7, 10]; // --bg
const PLUM = [113, 75, 103]; // #714B67
const LIGHT = [245, 242, 244]; // --text

const { data, info } = await sharp(SRC)
  .flatten({ background: '#ffffff' })
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width: w, height: h, channels: c } = info;

const lum = new Float32Array(w * h);
const isBgLike = new Uint8Array(w * h);
for (let i = 0; i < w * h; i++) {
  const r = data[i * c], g = data[i * c + 1], b = data[i * c + 2];
  lum[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  isBgLike[i] = Math.min(r, g, b) > 196 && Math.max(r, g, b) - Math.min(r, g, b) < 26 ? 1 : 0;
}

// Relleno por inundación desde los bordes: solo es fondo lo que toca el borde,
// así los brillos de la piel y el cuello blanco no se pierden.
const bg = new Uint8Array(w * h);
const stack = [];
const push = (i) => {
  if (isBgLike[i] && !bg[i]) {
    bg[i] = 1;
    stack.push(i);
  }
};
for (let x = 0; x < w; x++) {
  push(x);
  push((h - 1) * w + x);
}
for (let y = 0; y < h; y++) {
  push(y * w);
  push(y * w + w - 1);
}
while (stack.length) {
  const i = stack.pop();
  const x = i % w;
  if (x > 0) push(i - 1);
  if (x < w - 1) push(i + 1);
  if (i >= w) push(i - w);
  if (i < w * (h - 1)) push(i + w);
}

// Máscara suavizada para que el pelo no quede serruchado.
const { data: alpha, info: alphaInfo } = await sharp(Buffer.from(bg.map((v) => (v ? 0 : 255))), {
  raw: { width: w, height: h, channels: 1 },
})
  .blur(1.2)
  .raw()
  .toBuffer({ resolveWithObject: true });

const mix = (a, b, t) => a + (b - a) * t;
const ramp = (t) => {
  // sombras a tinta, medios a ciruela, altas a claro: conserva la cara legible
  const v = Math.min(1, Math.max(0, (t - 0.04) * 1.12));
  if (v < 0.34) return [0, 1, 2].map((k) => mix(INK[k], PLUM[k], v / 0.34));
  return [0, 1, 2].map((k) => mix(PLUM[k], LIGHT[k], Math.pow((v - 0.34) / 0.66, 0.92)));
};

const out = Buffer.alloc(w * h * 4);
for (let i = 0; i < w * h; i++) {
  const [r, g, b] = ramp(lum[i]);
  out[i * 4] = r;
  out[i * 4 + 1] = g;
  out[i * 4 + 2] = b;
  out[i * 4 + 3] = alpha[i * alphaInfo.channels];
}

mkdirSync('src/assets', { recursive: true });
await sharp(out, { raw: { width: w, height: h, channels: 4 } })
  .extract({ left: 0, top: 150, width: w, height: Math.min(h - 150, 1240) })
  .webp({ quality: 88, alphaQuality: 95 })
  .toFile(OUT);
console.log('retrato', w, h, '->', OUT);
