// Imágenes para compartir: la marca real, renderizada con la misma fuente del sitio.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';

const inter = readFileSync('src/assets/fonts/inter-latin-opsz-normal.woff2').toString('base64');
const portrait = readFileSync('src/assets/retrato.webp').toString('base64');

const CARDS = {
  'home-es': { title: 'Renzo<br>Payero', line: 'Ingeniero en Sistemas. Odoo, software a medida y agentes de IA.', portrait: true },
  'home-en': { title: 'Renzo<br>Payero', line: 'Systems engineer. Odoo, custom software and AI agents.', portrait: true },
  legacy: { title: 'Legacy<br>Hair Studio', line: 'Reservas online donde dos turnos no se pueden pisar.' },
  dakodev: { title: 'Dakodev', line: 'ERP, CRM, software a medida e IA.' },
  betina: { title: 'Betina<br>Di Luzio', line: 'E-commerce de tejidos a mano. Demo en desarrollo.' },
  quantarax: { title: 'QuantaraX', line: 'Comprá tecnología con datos, no con urgencias.' },
  rodri: { title: 'Rodri<br>Companion', line: 'Ayuda de juego para Pathfinder 1e.' },
};

const html = ({ title, line, portrait: withPortrait }) => `<!doctype html><meta charset="utf-8" /><style>
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${inter});font-weight:100 900}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#0b070a;color:#f5f2f4;font-family:Inter;display:flex;align-items:center;justify-content:space-between;padding:64px;overflow:hidden;position:relative}
body::before{content:'';position:absolute;inset:-30% -10% -30% 30%;background:radial-gradient(closest-side,rgb(113 75 103 / .55),transparent)}
.copy{position:relative;display:flex;flex-direction:column;gap:32px}
h1{position:relative;font-size:124px;font-weight:700;line-height:.94;letter-spacing:-.035em;font-variation-settings:'opsz' 32}
h1 span{display:block}
.lit{position:relative;color:#714b67;-webkit-text-stroke:.028em #f5f2f4;paint-order:stroke fill}
.halo{position:absolute;inset:0;color:#714b67;-webkit-text-stroke:.14em #714b67;filter:blur(.2em)}
p{font-size:30px;font-weight:500;line-height:1.2;max-width:24em;color:#c9c5c8}
.tile{position:relative;width:360px;height:440px;border-radius:28px;background:#714b67;overflow:hidden;flex:none}
.tile img{width:100%;height:100%;object-fit:cover;object-position:50% 0}
</style>
<div class="copy">
  <h1><span class="halo">${title}</span><span class="lit">${title}</span></h1>
  <p>${line}</p>
</div>
${withPortrait ? `<div class="tile"><img src="data:image/webp;base64,${portrait}" /></div>` : ''}`;

mkdirSync('public/og', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const [name, card] of Object.entries(CARDS)) {
  await page.setContent(html(card), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.screenshot({ path: `public/og/${name}.png` });
  console.log(name);
}
await browser.close();
