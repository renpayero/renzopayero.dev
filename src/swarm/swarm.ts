import { ui, type Lang, type RoleId } from '../i18n/ui';
import { Overlay, RIPPLE_LIFE, TRAIL, type Agent, type Frame } from './overlay';

/** Colores oficiales de Odoo más los neutros del sitio. */
const COLORS: Record<RoleId, string> = {
  relevamiento: '#d08bbd',
  arquitectura: '#f5f2f4',
  desarrollo: '#e4a900',
  diseno: '#e46e78',
  qa: '#8f8f8f',
  deploy: '#f7d4ee',
};

const CREW: Record<'desktop' | 'mobile', Record<RoleId, number>> = {
  desktop: { relevamiento: 3, arquitectura: 2, desarrollo: 4, diseno: 2, qa: 2, deploy: 1 },
  mobile: { relevamiento: 3, arquitectura: 1, desarrollo: 3, diseno: 1, qa: 1, deploy: 1 },
};

/**
 * Tres capas inclinadas en 3D, como un átomo. Velocidades distintas y un sentido invertido:
 * los agentes se cruzan por delante y por detrás del cursor sin repetir nunca el mismo dibujo.
 */
const SHELLS = [
  { radius: 46, speed: 1.6, tilt: 0.86, spin: -0.5 },
  { radius: 76, speed: -1.12, tilt: 1.0, spin: 0.62 },
  { radius: 108, speed: 0.8, tilt: 1.1, spin: 1.45 },
];

const TIP_HEADING = -2.09; // la flecha apunta arriba a la izquierda
const MAX_SPEED = 2600;
const INSPECTABLE = 'a, button, [data-tile], .bento__tile, .portrait';
const seconds = (ms: number): number => ms / 1000;

const shortest = (from: number, to: number): number => {
  const delta = (to - from) % (Math.PI * 2);
  return ((2 * delta) % (Math.PI * 2)) - delta;
};

/** PRNG con semilla: el enjambre arranca igual en cada visita y se puede capturar cuadro a cuadro. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Inspection {
  el: Element;
  frame: Frame;
  pinned: Agent[];
}

export class Swarm {
  readonly agents: Agent[] = [];
  readonly overlay = new Overlay();
  readonly random = seeded(20261105);
  private readonly hasPointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  private pointerX = innerWidth / 2;
  private pointerY = innerHeight / 2;
  private lastPointerX = this.pointerX;
  private lastPointerY = this.pointerY;
  private lastScroll = scrollY;
  private lastFrame = 0;
  private lastMove = 0;
  private energy = 0;
  private aura = 0;
  private time = 0;
  private running = false;
  private busy = 0;
  private inspection: Inspection | null = null;
  private leaving: Frame[] = [];

  constructor() {
    const lang: Lang = document.documentElement.lang === 'en' ? 'en' : 'es';
    const crew = CREW[innerWidth < 768 ? 'mobile' : 'desktop'];
    const roles = Object.keys(crew) as RoleId[];
    let index = 0;
    for (const role of roles) {
      for (let i = 0; i < crew[role]; i++) {
        const shell = SHELLS[index % SHELLS.length] ?? { radius: 66, speed: 1, tilt: 1, spin: 0 };
        const x = this.pointerX + (this.random() - 0.5) * 40;
        const y = this.pointerY + scrollY + (this.random() - 0.5) * 40;
        this.agents.push({
          role,
          name: ui[lang].roles[role],
          color: COLORS[role],
          mode: 'orbit',
          x,
          y,
          vx: 0,
          vy: 0,
          angle: 0,
          alpha: 0,
          scale: 1,
          tag: 0,
          depth: 0,
          radius: shell.radius * (0.9 + this.random() * 0.2),
          speed: shell.speed * (0.92 + this.random() * 0.16),
          phase: this.random() * Math.PI * 2,
          tilt: shell.tilt,
          spin: shell.spin,
          stiffness: 70 + this.random() * 70,
          pinX: 0,
          pinY: 0,
          aimX: 0,
          aimY: 0,
          trailX: new Float32Array(TRAIL).fill(x),
          trailY: new Float32Array(TRAIL).fill(y),
          trailAt: 0,
        });
        index++;
      }
    }
    addEventListener('resize', () => this.overlay.resize());
    if (this.hasPointer) this.listen();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    requestAnimationFrame(this.tick);
  }

  pointerAt(x: number, y: number): void {
    this.pointerX = x;
    this.pointerY = y;
    this.lastMove = performance.now();
  }

  /** El motor pide un agente: se despega de la órbita y el timeline pasa a moverlo. */
  borrow(agent: Agent): void {
    if (agent.mode === 'pin') this.endInspection();
    if (agent.mode !== 'task') this.overlay.tethers.push({ agent, age: 0 });
    agent.mode = 'task';
  }

  /** Terminó su tarea: la física lo trae de vuelta a su órbita, con la velocidad que traía. */
  release(agent: Agent): void {
    agent.mode = 'orbit';
    agent.tag = 0;
    agent.scale = 1;
  }

  /** Mientras construyen, nadie se distrae inspeccionando lo que toca el cursor. */
  setBusy(busy: boolean): void {
    this.busy = busy ? 1 : 0;
    if (busy) this.endInspection();
  }

  private listen(): void {
    addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerType === 'touch') return;
        this.pointerAt(event.clientX, event.clientY);
      },
      { passive: true },
    );
    addEventListener(
      'pointerdown',
      (event) => {
        if (event.pointerType === 'touch') return;
        this.burst(event.clientX, event.clientY + scrollY);
      },
      { passive: true },
    );
    document.addEventListener(
      'pointerover',
      (event) => {
        if (event.pointerType === 'touch' || this.busy) return;
        const el = event.target instanceof Element ? event.target.closest(INSPECTABLE) : null;
        if (el !== (this.inspection?.el ?? null)) this.inspect(el);
      },
      { passive: true },
    );
    document.documentElement.addEventListener('pointerleave', () => this.endInspection(), { passive: true });
  }

  /** Clic: onda de presión. El enjambre se abre y vuelve a su lugar por el resorte. */
  private burst(x: number, y: number): void {
    this.overlay.ripples.push({ x, y, age: 0 });
    for (const agent of this.agents) {
      if (agent.mode !== 'orbit') continue;
      const dx = agent.x - x;
      const dy = agent.y - y;
      const d = Math.hypot(dx, dy) || 1;
      agent.vx += (dx / d) * 1300;
      agent.vy += (dy / d) * 1300;
    }
  }

  /** Cuatro agentes toman las esquinas de lo que señala el cursor y muestran sus medidas reales. */
  private inspect(el: Element | null): void {
    this.endInspection();
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 12 || rect.height < 12) return;
    const free = this.agents.filter((a) => a.mode === 'orbit');
    if (free.length < 4) return;
    const corners = [
      [rect.left, rect.top],
      [rect.right, rect.top],
      [rect.right, rect.bottom],
      [rect.left, rect.bottom],
    ] as const;
    const pinned: Agent[] = [];
    for (const [cx, cy] of corners) {
      let best: Agent | null = null;
      let bestD = Infinity;
      for (const agent of free) {
        if (pinned.includes(agent)) continue;
        const d = Math.hypot(agent.x - cx, agent.y - scrollY - cy);
        if (d < bestD) {
          bestD = d;
          best = agent;
        }
      }
      if (best) {
        best.mode = 'pin';
        pinned.push(best);
      }
    }
    const frame: Frame = {
      x: rect.left + scrollX,
      y: rect.top + scrollY,
      w: rect.width,
      h: rect.height,
      grow: 1,
      alpha: 0,
      chip: 1,
      label: `${Math.round(rect.width)} × ${Math.round(rect.height)}`,
    };
    this.overlay.hoverFrames.push(frame);
    this.inspection = { el, frame, pinned };
  }

  private endInspection(): void {
    const current = this.inspection;
    if (!current) return;
    for (const agent of current.pinned) {
      if (agent.mode === 'pin') agent.mode = 'orbit';
    }
    this.leaving.push(current.frame);
    this.inspection = null;
  }

  private updateInspection(dt: number): void {
    const current = this.inspection;
    if (current) {
      const rect = current.el.getBoundingClientRect();
      const { frame, pinned } = current;
      frame.x = rect.left + scrollX;
      frame.y = rect.top + scrollY;
      frame.w = rect.width;
      frame.h = rect.height;
      frame.alpha += (0.85 - frame.alpha) * (1 - Math.exp(-14 * dt));
      const cx = frame.x + frame.w / 2;
      const cy = frame.y + frame.h / 2;
      const spots = [
        [frame.x, frame.y],
        [frame.x + frame.w, frame.y],
        [frame.x + frame.w, frame.y + frame.h],
        [frame.x, frame.y + frame.h],
      ] as const;
      pinned.forEach((agent, i) => {
        const spot = spots[i];
        if (!spot) return;
        agent.pinX = spot[0];
        agent.pinY = spot[1];
        agent.aimX = cx;
        agent.aimY = cy;
      });
    }
    for (const frame of this.leaving) frame.alpha += (0 - frame.alpha) * (1 - Math.exp(-16 * dt));
    if (this.leaving.some((f) => f.alpha < 0.02)) {
      const gone = this.leaving.filter((f) => f.alpha < 0.02);
      this.leaving = this.leaving.filter((f) => f.alpha >= 0.02);
      for (const frame of gone) {
        const i = this.overlay.hoverFrames.indexOf(frame);
        if (i >= 0) this.overlay.hoverFrames.splice(i, 1);
      }
    }
  }

  private readonly tick = (now: number): void => {
    const dt = Math.min(seconds(now - this.lastFrame), 1 / 30);
    this.lastFrame = now;
    this.time += dt;
    this.update(dt, now);
    this.aura += ((this.hasPointer && this.lastMove > 0 ? 1 : 0) - this.aura) * (1 - Math.exp(-4 * dt));
    this.overlay.render(this.agents, this.pointerX, this.pointerY, this.aura * (0.8 + this.energy * 0.4), dt);
    requestAnimationFrame(this.tick);
  };

  private update(dt: number, now: number): void {
    // La velocidad del cursor le da energía a la órbita: se abre al moverse y respira al frenar.
    const speed = Math.hypot(this.pointerX - this.lastPointerX, this.pointerY - this.lastPointerY) / Math.max(dt, 1 / 240);
    this.lastPointerX = this.pointerX;
    this.lastPointerY = this.pointerY;
    this.energy += (Math.min(speed / 1500, 1) - this.energy) * (1 - Math.exp(-(speed / 1500 > this.energy ? 12 : 2.4) * dt));
    const idle = Math.min(Math.max(seconds(now - this.lastMove) - 3, 0) / 4, 1);
    const swell = 1 + this.energy * 0.55 + idle * 0.16 + Math.sin(this.time * 0.9) * 0.03;
    const pace = (1 - idle * 0.4) * (1 + this.energy * 0.5);

    // Pegado a la pantalla: si la página scrollea, la órbita no se queda atrás.
    const scrolled = scrollY - this.lastScroll;
    this.lastScroll = scrollY;
    const anchorX = this.pointerX;
    const anchorY = this.pointerY + scrollY;
    const rest = this.hasPointer ? 1 : 0;

    for (const agent of this.agents) {
      const px = agent.x;
      const py = agent.y;
      if (agent.mode === 'task') {
        agent.alpha += (1 - agent.alpha) * (1 - Math.exp(-16 * dt));
        agent.vx = (agent.x - px) / dt;
        agent.vy = (agent.y - py) / dt;
      } else {
        if (agent.mode === 'orbit' && scrolled !== 0) {
          agent.y += scrolled;
          for (let i = 0; i < TRAIL; i++) agent.trailY[i] = (agent.trailY[i] ?? 0) + scrolled;
        }
        agent.phase += agent.speed * pace * dt;
        let targetX: number;
        let targetY: number;
        let depth = 0;
        if (agent.mode === 'pin') {
          targetX = agent.pinX;
          targetY = agent.pinY;
        } else {
          const r = agent.radius * swell;
          const ox = r * Math.cos(agent.phase);
          const oy = r * Math.sin(agent.phase) * Math.cos(agent.tilt);
          depth = Math.sin(agent.phase);
          targetX = anchorX + ox * Math.cos(agent.spin) - oy * Math.sin(agent.spin);
          targetY = anchorY + ox * Math.sin(agent.spin) + oy * Math.cos(agent.spin);
        }
        agent.depth += (depth - agent.depth) * (1 - Math.exp(-10 * dt));
        const k = agent.mode === 'pin' ? 170 : agent.stiffness;
        const c = 2 * Math.sqrt(k) * 0.74;
        agent.vx += (k * (targetX - agent.x) - c * agent.vx) * dt;
        agent.vy += (k * (targetY - agent.y) - c * agent.vy) * dt;
        const v = Math.hypot(agent.vx, agent.vy);
        if (v > MAX_SPEED) {
          agent.vx *= MAX_SPEED / v;
          agent.vy *= MAX_SPEED / v;
        }
        agent.x += agent.vx * dt;
        agent.y += agent.vy * dt;
        agent.alpha += (rest - agent.alpha) * (1 - Math.exp(-8 * dt));
      }

      // La flecha mira hacia donde va; cuando trabaja vuelve a ser un cursor; en una esquina apunta al objeto.
      let heading = 0;
      const moving = Math.hypot(agent.vx, agent.vy);
      if (agent.mode === 'pin') heading = Math.atan2(agent.aimY - agent.y, agent.aimX - agent.x) - TIP_HEADING;
      else if (moving > 60) heading = Math.atan2(agent.vy, agent.vx) - TIP_HEADING;
      agent.angle += shortest(agent.angle, heading) * (1 - Math.exp(-14 * dt));

      agent.trailAt += dt;
      if (agent.trailAt >= 0.016) {
        agent.trailAt = 0;
        agent.trailX.copyWithin(1, 0, TRAIL - 1);
        agent.trailY.copyWithin(1, 0, TRAIL - 1);
        agent.trailX[0] = agent.x;
        agent.trailY[0] = agent.y;
      }
    }

    this.updateInspection(dt);
    const { ripples } = this.overlay;
    for (const ripple of ripples) ripple.age += dt;
    while (ripples[0] && ripples[0].age >= RIPPLE_LIFE) ripples.shift();
  }
}

let instance: Swarm | null = null;

/** Un solo enjambre por página: lo comparten el arranque liviano y el motor de build. */
export function getSwarm(): Swarm {
  instance ??= new Swarm();
  instance.start();
  (window as unknown as { __rpSwarm?: Swarm }).__rpSwarm = instance;
  return instance;
}
