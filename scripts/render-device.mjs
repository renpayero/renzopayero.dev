// Prerenderiza el momento dispositivo: un teléfono genérico que primero es una línea de luz
// y al girar muestra un proyecto real. Como en Apple, es video: cero costo de GPU para el visitante.
//   node scripts/record-projects.mjs --phone && node scripts/render-device.mjs [--preview]
import { chromium } from '@playwright/test';
import ffmpegPath from 'ffmpeg-static';
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import sharp from 'sharp';

const preview = process.argv.includes('--preview');
const WIDTH = 1080;
const HEIGHT = 1080;
const FPS = 30;
const OUT_DIR = '.cache/device';
const FRAMES_DIR = '.cache/frames/legacy-phone';

const screens = readdirSync(FRAMES_DIR).filter((f) => f.endsWith('.jpg')).sort();
if (!screens.length) throw new Error('faltan cuadros: corré record-projects.mjs --phone');

const MIME = { '.js': 'text/javascript', '.jpg': 'image/jpeg', '.html': 'text/html' };
const roots = { '/three/': 'node_modules/three/', '/screens/': `${FRAMES_DIR}/` };

const SCENE = `<!doctype html>
<meta charset="utf-8" />
<style>html,body{margin:0;background:#0b070a}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const W = ${WIDTH}, H = ${HEIGHT};
const PLUM = 0x714b67, BG = 0x0b070a;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
scene.environmentIntensity = 0.95;

const camera = new THREE.PerspectiveCamera(26, W / H, 0.1, 100);

const PHONE_W = 3.9, PHONE_H = 8.44, RADIUS = 0.62, DEPTH = 0.1, BEVEL = 0.06;
const outline = (w, h, r) => {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  return s;
};

const phone = new THREE.Group();
scene.add(phone);

// Cuerpo: aluminio ciruela, el color exacto de Odoo.
const bodyGeo = new THREE.ExtrudeGeometry(outline(PHONE_W, PHONE_H, RADIUS), {
  depth: DEPTH, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 10, curveSegments: 48,
});
bodyGeo.center();
const body = new THREE.Mesh(bodyGeo, new THREE.MeshPhysicalMaterial({
  color: PLUM, metalness: 1, roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.25,
}));
phone.add(body);

// Frente de vidrio negro con margen fino.
const FRONT = DEPTH / 2 + BEVEL + 0.002;
const glass = new THREE.Mesh(
  new THREE.ShapeGeometry(outline(PHONE_W - 0.04, PHONE_H - 0.04, RADIUS - 0.02), 48),
  new THREE.MeshPhysicalMaterial({ color: 0x050305, roughness: 0.08, metalness: 0, clearcoat: 1 }),
);
glass.position.z = FRONT;
phone.add(glass);

// Pantalla: la grabación real del proyecto.
const SW = PHONE_W - 0.22, SH = PHONE_H - 0.22;
const screenGeo = new THREE.ShapeGeometry(outline(SW, SH, RADIUS - 0.1), 48);
const uv = screenGeo.attributes.uv, pos = screenGeo.attributes.position;
for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / SW + 0.5, pos.getY(i) / SH + 0.5);
const loader = new THREE.TextureLoader();
const screenMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
const screen = new THREE.Mesh(screenGeo, screenMat);
screen.position.z = FRONT + 0.002;
phone.add(screen);

// Cámara frontal genérica: un punto, no el diseño de ningún fabricante.
const lens = new THREE.Mesh(new THREE.CircleGeometry(0.075, 32), new THREE.MeshBasicMaterial({ color: 0x020102 }));
lens.position.set(0, SH / 2 - 0.2, FRONT + 0.004);
phone.add(lens);

// Tubo de neón sobre el canto: es la línea de luz que se ve de perfil.
const edge = outline(PHONE_W + 2 * BEVEL + 0.036, PHONE_H + 2 * BEVEL + 0.036, RADIUS + BEVEL + 0.018);
const tube = new THREE.Mesh(
  new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge.getPoints(96).map((p) => new THREE.Vector3(p.x, p.y, 0)), true), 512, 0.016, 10, true),
  new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.9, 2.1), toneMapped: false }),
);
phone.add(tube);

// Luz de estudio: dos bandas frías en los costados para que el metal tenga forma.
for (const [x, y, z, i] of [[-9, 4, 6, 60], [9, -3, 5, 40], [0, 9, -6, 30]]) {
  const light = new THREE.SpotLight(0xf3d9ec, i, 40, 0.8, 1, 1.4);
  light.position.set(x, y, z);
  scene.add(light);
}

// Antialiasing real sobre el buffer HDR: sin esto el tubo fino se ve punteado.
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { samples: 8, type: THREE.HalfFloatType }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.4, 0.55, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const smooth = (t) => t * t * t * (t * (6 * t - 15) + 10);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

window.renderFrame = async (i, total, screenUrl) => {
  const seconds = i / ${FPS};
  const turn = smooth(clamp01((seconds - 0.5) / 2.9));
  // De perfil a frente, con un resto de giro para que nunca quede de postal.
  phone.rotation.y = THREE.MathUtils.lerp(Math.PI / 2 - 0.004, -0.2, turn);
  phone.rotation.x = THREE.MathUtils.lerp(0.02, 0.05, turn);
  phone.rotation.z = THREE.MathUtils.lerp(-0.26, 0, smooth(clamp01((seconds - 0.2) / 3.2)));
  camera.position.set(0, 0, THREE.MathUtils.lerp(23.5, 21.5, turn));
  camera.lookAt(0, 0, 0);
  tube.material.color.setRGB(...[2.2, 1.9, 2.1].map((c) => c * THREE.MathUtils.lerp(1.0, 0.62, turn)));
  bloom.strength = THREE.MathUtils.lerp(0.5, 0.26, turn);
  const texture = await loader.loadAsync(screenUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  screenMat.map?.dispose();
  screenMat.map = texture;
  screenMat.needsUpdate = true;
  composer.render();
  return renderer.domElement.toDataURL('image/jpeg', 0.95);
};
window.ready = true;
</script>`;

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (url === '/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(SCENE);
    return;
  }
  for (const [prefix, dir] of Object.entries(roots)) {
    if (url.startsWith(prefix)) {
      const base = resolve(dir);
      const file = resolve(base, normalize(url.slice(prefix.length)));
      if (file.startsWith(base) && existsSync(file) && statSync(file).isFile()) {
        res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
        createReadStream(file).pipe(res);
        return;
      }
    }
  }
  res.writeHead(404);
  res.end();
});
await new Promise((ok) => server.listen(4399, '127.0.0.1', ok));

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
  page.on('pageerror', (e) => console.error('scene error:', e.message));
  await page.goto('http://127.0.0.1:4399/');
  await page.waitForFunction(() => window.ready, undefined, { timeout: 60_000 });
  const gpu = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'desconocido';
  });
  console.log('GPU:', gpu);

  const total = screens.length;
  const picks = preview ? [0, 25, 50, 75, 100, 130, total - 1] : [...Array(total).keys()];
  const started = Date.now();
  for (const i of picks) {
    const data = await page.evaluate(([n, t, url]) => window.renderFrame(n, t, url), [i, total, `/screens/${screens[i]}`]);
    const name = preview ? `p${String(i).padStart(3, '0')}.jpg` : `f${String(i).padStart(5, '0')}.jpg`;
    await sharp(Buffer.from(data.split(',')[1], 'base64')).toFile(join(OUT_DIR, name));
  }
  console.log(`${picks.length} cuadros en ${((Date.now() - started) / 1000).toFixed(0)} s`);
} finally {
  await browser.close();
  server.close();
}

if (!preview) {
  const out = 'public/video/device-legacy.mp4';
  execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(OUT_DIR, 'f%05d.jpg'), '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '27', '-preset', 'veryslow', '-movflags', '+faststart', '-an', out]);
  const last = screens.length - 1;
  await sharp(join(OUT_DIR, `f${String(last).padStart(5, '0')}.jpg`)).webp({ quality: 84 }).toFile('src/assets/projects/device-final.webp');
  await sharp(join(OUT_DIR, 'f00000.jpg')).webp({ quality: 84 }).toFile('src/assets/projects/device-start.webp');
  console.log('video:', out, Math.round(statSync(out).size / 1024), 'KB');
}
