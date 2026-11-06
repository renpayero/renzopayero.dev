// Graba cada proyecto real, cuadro a cuadro: el scroll es determinista, así el video queda
// fluido aunque la captura tarde. Solo navega y scrollea: nunca envía un formulario ni reserva.
//   node scripts/record-projects.mjs [slug] [--phone]
import { chromium } from '@playwright/test';
import ffmpegPath from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const FPS = 30;
const DESKTOP = { width: 1280, height: 720 };
const PHONE = { width: 390, height: 844 };

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Cada proyecto es una lista de tomas: abrir, esperar, scrollear a una fracción de la página. */
const PROJECTS = {
  legacy: {
    url: 'https://legacyhairstudio.com/',
    shots: [
      { hold: 1 },
      { scrollTo: 1100, seconds: 3.4 },
      { hold: 0.6 },
      { scrollTo: 1700, seconds: 2.4 },
      { hold: 0.8 },
    ],
    poster: 0.04,
  },
  dakodev: {
    url: 'https://dakodev.com/',
    settle: 4500,
    shots: [{ hold: 0.6 }, { scrollTo: 1500, seconds: 5 }, { scrollTo: 3000, seconds: 5 }, { hold: 0.5 }],
    poster: 0.02,
  },
  betina: {
    url: 'https://www.betinadiluzio.com/',
    shots: [{ hold: 1 }, { scrollTo: 1500, seconds: 5 }, { hold: 0.5 }, { goto: 'https://www.betinadiluzio.com/tienda' }, { hold: 0.5 }, { scrollTo: 900, seconds: 3.6 }, { hold: 0.5 }],
    poster: 0.04,
  },
  quantarax: {
    url: 'https://quantarax.net/',
    shots: [{ hold: 1 }, { scrollTo: 1250, seconds: 4.6 }, { hold: 0.5 }, { scrollTo: 2300, seconds: 4 }, { hold: 0.5 }],
    poster: 0.04,
  },
  rodri: {
    url: 'https://rodri.dakodev.com/login',
    // Acceso de invitado de la propia app: solo lectura, pensado para la mesa.
    prepare: async (page) => {
      await page.getByRole('button', { name: /invitado/i }).click();
      await page.waitForLoadState('networkidle');
    },
    shots: [{ hold: 1 }, { scrollTo: 900, seconds: 4.4 }, { hold: 0.5 }, { scrollTo: 1600, seconds: 3.4 }, { hold: 0.5 }],
    poster: 0.05,
  },
};

const phoneShots = {
  legacy: {
    url: 'https://legacyhairstudio.com/',
    shots: [{ hold: 0.6 }, { scrollTo: 900, seconds: 3 }, { hold: 0.4 }, { scrollTo: 1500, seconds: 2 }, { hold: 0.4 }],
  },
};

async function record(browser, slug, spec, viewport, framesDir) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: viewport === PHONE ? 2 : 1, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  await page.goto(spec.url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(spec.settle ?? 1800);
  if (spec.prepare) await spec.prepare(page);
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important} ::-webkit-scrollbar{display:none}' });

  let frame = 0;
  const shot = () => page.screenshot({ path: join(framesDir, `f${String(frame++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 88 });

  for (const step of spec.shots) {
    if (step.goto) {
      await page.goto(step.goto, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(1500);
      await page.addStyleTag({ content: 'html{scroll-behavior:auto!important} ::-webkit-scrollbar{display:none}' });
    } else if (step.hold) {
      for (let i = 0; i < step.hold * FPS; i++) await shot();
    } else if (step.scrollTo !== undefined) {
      const from = await page.evaluate(() => scrollY);
      const total = step.seconds * FPS;
      for (let i = 1; i <= total; i++) {
        const y = from + (step.scrollTo - from) * easeInOut(i / total);
        await page.evaluate((top) => scrollTo(0, top), y);
        await shot();
      }
    }
  }
  await context.close();
  return frame;
}

function encode(framesDir, out, crf) {
  execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(framesDir, 'f%05d.jpg'), '-c:v', 'libx264', '-crf', String(crf), '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out]);
}

const args = process.argv.slice(2);
const wantPhone = args.includes('--phone');
const only = args.find((a) => !a.startsWith('--'));
mkdirSync('public/video', { recursive: true });
mkdirSync('src/assets/projects', { recursive: true });
mkdirSync('.cache/frames', { recursive: true });

const browser = await chromium.launch();
try {
  if (wantPhone) {
    for (const [slug, spec] of Object.entries(phoneShots)) {
      const dir = `.cache/frames/${slug}-phone`;
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      const n = await record(browser, slug, spec, PHONE, dir);
      console.log(`${slug} teléfono: ${n} cuadros en ${dir}`);
    }
  } else {
    for (const [slug, spec] of Object.entries(PROJECTS)) {
      if (only && only !== slug) continue;
      const dir = mkdtempSync(join(tmpdir(), `rec-${slug}-`));
      const n = await record(browser, slug, spec, DESKTOP, dir);
      encode(dir, `public/video/${slug}.mp4`, 31);
      const poster = join(dir, `f${String(Math.floor(n * spec.poster)).padStart(5, '0')}.jpg`);
      if (existsSync(poster)) await sharp(poster).webp({ quality: 82 }).toFile(`src/assets/projects/${slug}.webp`);
      rmSync(dir, { recursive: true, force: true });
      console.log(`${slug}: ${n} cuadros`);
    }
  }
} finally {
  await browser.close();
}
