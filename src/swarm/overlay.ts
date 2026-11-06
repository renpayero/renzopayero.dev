import type { RoleId } from '../i18n/ui';

export type AgentMode = 'orbit' | 'task' | 'pin';

export const TRAIL = 10;

/** Agente en coordenadas de documento. En órbita lo mueve la física; en tarea, el timeline. */
export interface Agent {
  role: RoleId;
  name: string;
  color: string;
  mode: AgentMode;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  alpha: number;
  scale: number;
  tag: number;
  depth: number;
  radius: number;
  speed: number;
  phase: number;
  tilt: number;
  spin: number;
  stiffness: number;
  pinX: number;
  pinY: number;
  aimX: number;
  aimY: number;
  trailX: Float32Array;
  trailY: Float32Array;
  trailAt: number;
}

/** Marco de wireframe en coordenadas de documento. `grow` lo despliega desde su esquina. */
export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
  grow: number;
  alpha: number;
  chip: number;
  label: string;
}

export interface Guide {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  draw: number;
  alpha: number;
}

export interface Note {
  x: number;
  y: number;
  alpha: number;
  text: string;
}

export interface Ripple {
  x: number;
  y: number;
  age: number;
}

const LINE = '208, 139, 189'; // ciruela claro: el color de las herramientas, nunca de la página
const CHIP = '#714b67';
const INK = '#f5f2f4';
const ARROW = 'M0 0 L0 15.5 L4.2 11.8 L6.9 18 L9.9 16.7 L7.2 10.7 L12.6 10.4 Z';
const SPRITE_SIZE = 56;
const SPRITE_ORIGIN = 20;
const RIPPLE_LIFE = 0.55;

export class Overlay {
  readonly frames: Frame[] = [];
  readonly hoverFrames: Frame[] = [];
  readonly guides: Guide[] = [];
  readonly notes: Note[] = [];
  readonly ripples: Ripple[] = [];

  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly mono: string;
  private readonly sprites = new Map<string, HTMLCanvasElement>();
  private dpr = 1;
  private width = 0;
  private height = 0;

  constructor() {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d no disponible');
    this.ctx = ctx;
    this.mono = getComputedStyle(document.documentElement).getPropertyValue('--font-geist') || 'monospace';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.dataset.swarm = '';
    this.canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:40;pointer-events:none';
    document.body.append(this.canvas);
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.width = innerWidth;
    this.height = innerHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.sprites.clear();
  }

  clear(): void {
    this.frames.length = 0;
    this.guides.length = 0;
    this.notes.length = 0;
  }

  /** La flecha con su halo se dibuja una vez por color: rotarla después es solo copiar un bitmap. */
  private sprite(color: string): HTMLCanvasElement {
    const cached = this.sprites.get(color);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SPRITE_SIZE * this.dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(this.dpr, this.dpr);
      ctx.translate(SPRITE_ORIGIN, SPRITE_ORIGIN);
      const arrow = new Path2D(ARROW);
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = color;
      ctx.fill(arrow);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(11, 7, 10, 0.9)';
      ctx.lineWidth = 1;
      ctx.fill(arrow);
      ctx.stroke(arrow);
    }
    this.sprites.set(color, canvas);
    return canvas;
  }

  render(agents: Agent[]): void {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    const scroll = scrollY;
    for (const guide of this.guides) this.drawGuide(guide, scroll);
    for (const frame of this.frames) this.drawFrame(frame, scroll);
    for (const frame of this.hoverFrames) this.drawFrame(frame, scroll);
    for (const note of this.notes) this.drawNote(note, scroll);
    this.drawRipples(scroll);

    ctx.globalCompositeOperation = 'lighter';
    for (const agent of agents) this.drawTrail(agent, scroll);
    ctx.globalCompositeOperation = 'source-over';
    // Los que pasan por detrás se pintan primero: la profundidad también es orden.
    const ordered = agents.slice().sort((a, b) => a.depth - b.depth);
    for (const agent of ordered) this.drawAgent(agent, scroll);
  }

  private drawTrail(a: Agent, scroll: number): void {
    if (a.alpha <= 0.02) return;
    const { ctx } = this;
    ctx.strokeStyle = a.color;
    ctx.lineWidth = 1.1;
    ctx.lineCap = 'round';
    ctx.globalAlpha = a.alpha * (0.22 + 0.16 * a.depth);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - scroll);
    for (let i = 0; i < TRAIL; i++) {
      const x = a.trailX[i] ?? a.x;
      const y = a.trailY[i] ?? a.y;
      ctx.lineTo(x, y - scroll);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawRipples(scroll: number): void {
    const { ctx } = this;
    for (const ripple of this.ripples) {
      const t = ripple.age / RIPPLE_LIFE;
      if (t >= 1) continue;
      ctx.strokeStyle = `rgba(${LINE}, ${(1 - t) * 0.7})`;
      ctx.lineWidth = 1.5 * (1 - t) + 0.25;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y - scroll, 8 + 120 * (1 - (1 - t) ** 3), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawGuide(g: Guide, scroll: number): void {
    if (g.alpha <= 0.01 || g.draw <= 0) return;
    const { ctx } = this;
    ctx.strokeStyle = `rgba(${LINE}, ${g.alpha * 0.55})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(g.x1, g.y1 - scroll);
    ctx.lineTo(g.x1 + (g.x2 - g.x1) * g.draw, g.y1 + (g.y2 - g.y1) * g.draw - scroll);
    ctx.stroke();
  }

  private drawFrame(f: Frame, scroll: number): void {
    if (f.alpha <= 0.01 || f.grow <= 0) return;
    const { ctx } = this;
    const w = f.w * f.grow;
    const h = f.h * f.grow;
    const x = f.x;
    const y = f.y - scroll;
    ctx.fillStyle = `rgba(245, 242, 244, ${f.alpha * 0.05})`;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = `rgba(${LINE}, ${f.alpha})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);

    ctx.fillStyle = `rgba(245, 242, 244, ${f.alpha})`;
    for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]] as const) {
      ctx.fillRect(cx - 2.5, cy - 2.5, 5, 5);
    }

    if (f.chip > 0.01) this.drawChip(f.label, x + w / 2, y + h + 8, f.alpha * f.chip, CHIP, INK, true);
  }

  private drawNote(n: Note, scroll: number): void {
    if (n.alpha > 0.01) this.drawChip(n.text, n.x, n.y - scroll, n.alpha, INK, '#0b070a', false);
  }

  private drawChip(text: string, x: number, y: number, alpha: number, bg: string, fg: string, center: boolean): void {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `500 10px ${this.mono}`;
    const w = ctx.measureText(text).width + 12;
    const left = center ? x - w / 2 : x;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(left, y, w, 16, 4);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, left + 6, y + 8.5);
    ctx.restore();
  }

  private drawAgent(a: Agent, scroll: number): void {
    if (a.alpha <= 0.01) return;
    const { ctx } = this;
    const near = (a.depth + 1) / 2;
    const size = a.scale * (0.76 + 0.34 * near);
    ctx.save();
    ctx.globalAlpha = a.alpha * (0.5 + 0.5 * near);
    ctx.translate(a.x, a.y - scroll);
    ctx.rotate(a.angle);
    ctx.scale(size, size);
    ctx.drawImage(this.sprite(a.color), -SPRITE_ORIGIN, -SPRITE_ORIGIN, SPRITE_SIZE, SPRITE_SIZE);
    ctx.restore();
    if (a.tag > 0.01) this.drawChip(a.name, a.x + 12, a.y - scroll + 16, a.alpha * a.tag, a.color, '#0b070a', false);
  }
}

export { RIPPLE_LIFE };
