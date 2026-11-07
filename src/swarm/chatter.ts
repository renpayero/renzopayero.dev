import { contrast } from '../build-engine/dom';
import { chatter, type Deck, type Facts, type Line } from '../i18n/chatter';
import { ui, type Lang } from '../i18n/ui';
import type { Agent, Bubble, Overlay } from './overlay';

const FIRST_IDLE = 4000; // ms con el cursor quieto antes de que alguien hable
const GAP: readonly [number, number] = [6500, 9000]; // ms entre un globito y el siguiente
const STEP_OUT = 150; // px: el que habla sale de la órbita hasta acá, al costado del cursor
const LET_GO = 28; // px de cursor que cortan la charla: el visitante volvió
const EDGE = 8;

const clamp = (v: number, min: number, max: number): number => Math.min(Math.max(v, min), max);

/** ¿Hay letras justo en ese punto de la pantalla? El canvas no cuenta: no recibe el puntero. */
function textAt(x: number, y: number): boolean {
  let node: Node | null = null;
  let offset = 0;
  if (typeof document.caretPositionFromPoint === 'function') {
    const caret = document.caretPositionFromPoint(x, y);
    node = caret?.offsetNode ?? null;
    offset = caret?.offset ?? 0;
  } else if (typeof document.caretRangeFromPoint === 'function') {
    // Safari viejo: todavía no tiene caretPositionFromPoint.
    const range = document.caretRangeFromPoint(x, y);
    node = range?.startContainer ?? null;
    offset = range?.startOffset ?? 0;
  }
  if (!node || node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) return false;
  // El cursor de texto cae en la letra más cercana aunque el punto esté lejos: se mira la letra.
  const range = document.createRange();
  const length = node.textContent.length;
  range.setStart(node, Math.max(0, Math.min(offset, length) - 1));
  range.setEnd(node, Math.min(length, Math.max(offset, 1)));
  return [...range.getClientRects()].some((r) => x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 4 && y <= r.bottom + 4);
}

/** Cuántos puntos de ese rectángulo caen sobre texto: el globito no tapa lo que se está leyendo. */
function covered(left: number, top: number, w: number, h: number): number {
  let hits = 0;
  for (const u of [0.12, 0.5, 0.88]) {
    for (const v of [0.25, 0.75]) if (textAt(left + w * u, top + h * v)) hits++;
  }
  return hits;
}

/** Tiempo de lectura: corto para una frase corta, nunca tanto como para tapar la página. */
const holdFor = (text: string): number => clamp(1500 + text.length * 45, 2000, 3800);

/** Baraja un mazo y lo reparte sin repetir hasta agotarlo; al rebarajar, la última no vuelve primera. */
export function dealer<T>(cards: readonly T[], random: () => number): () => T | undefined {
  let pile: T[] = [];
  let last: T | undefined;
  return () => {
    if (!pile.length) {
      pile = [...cards];
      for (let i = pile.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [pile[i], pile[j]] = [pile[j] as T, pile[i] as T];
      }
      // Se reparte desde el final: si la que saldría primero es la última dicha, va al fondo.
      if (pile.length > 1 && pile[pile.length - 1] === last) pile.unshift(pile.pop() as T);
    }
    last = pile.pop();
    return last;
  };
}

interface Talk {
  agent: Agent;
  bubble: Bubble;
  offX: number;
  offY: number;
  fromX: number;
  fromY: number;
  until: number;
}

export interface World {
  agents: Agent[];
  /** Cursor, en coordenadas de pantalla. */
  x: number;
  y: number;
  lastMove: number;
  /** La órbita se ve y nada pide quietud. */
  active: boolean;
}

/**
 * Cuando el cursor queda quieto, un agente sale de la órbita, mira al cursor y dice algo.
 * Uno por vez, y vuelve a su lugar apenas el visitante se mueve.
 */
export class Chatter {
  private talk: Talk | null = null;
  private nextAt = 0;
  private readonly decks = new Map<string, () => Line | undefined>();

  constructor(
    private readonly overlay: Overlay,
    private readonly random: () => number,
    private readonly lang: Lang,
  ) {}

  /** Una vez por cuadro, antes de la física: el que habla toma su lugar junto al cursor. */
  update(now: number, dt: number, world: World): void {
    const talk = this.talk;
    if (talk) {
      const moved = Math.hypot(world.x - talk.fromX, world.y - talk.fromY) > LET_GO;
      if (talk.agent.mode !== 'talk' || !world.active || moved || now >= talk.until) {
        this.stop(now);
      } else {
        const { agent, bubble } = talk;
        agent.pinX = world.x + talk.offX;
        agent.pinY = world.y + scrollY + talk.offY;
        agent.aimX = world.x;
        agent.aimY = world.y + scrollY;
        bubble.x = agent.x;
        bubble.y = agent.y - scrollY;
      }
    }

    const { bubbles } = this.overlay;
    for (const bubble of bubbles) {
      const target = bubble === this.talk?.bubble ? 1 : 0;
      bubble.alpha += (target - bubble.alpha) * (1 - Math.exp(-(target ? 16 : 22) * dt));
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      if (bubbles[i] !== this.talk?.bubble && (bubbles[i]?.alpha ?? 0) < 0.01) bubbles.splice(i, 1);
    }

    if (this.talk || !world.active || world.lastMove <= 0 || document.hidden) return;
    if (now - world.lastMove < FIRST_IDLE || now < this.nextAt) return;
    this.speak(now, world);
  }

  private stop(now: number): void {
    const talk = this.talk;
    if (!talk) return;
    if (talk.agent.mode === 'talk') talk.agent.mode = 'orbit';
    this.talk = null;
    this.nextAt = now + GAP[0] + this.random() * (GAP[1] - GAP[0]);
  }

  /** Mientras la terminal está abierta, hablan de la terminal; después, de lo suyo. */
  private context(): { deck: Deck; lang: Lang } {
    const root = document.documentElement;
    const gate = root.dataset.gate;
    if ((gate === 'es' || gate === 'en') && !('gateLeaving' in root.dataset)) {
      const asking = document.querySelector(`[data-screen="${gate}"] [data-step="lang"]:not([hidden])`);
      return { deck: asking ? 'lang' : 'gate', lang: gate };
    }
    return { deck: 'idle', lang: this.lang };
  }

  private facts(crew: number): Facts {
    const soft = document.querySelector('.lede__soft');
    return { crew, softContrast: soft ? contrast(soft) : null };
  }

  private speak(now: number, world: World): void {
    // Un agente en una esquina, o reportándose en la terminal: no es momento de charlar.
    if (world.agents.some((a) => a.mode === 'pin')) return;
    const { deck, lang } = this.context();
    const key = `${lang}:${deck}`;
    let draw = this.decks.get(key);
    if (!draw) {
      draw = dealer(chatter[lang][deck], this.random);
      this.decks.set(key, draw);
    }
    const facts = this.facts(world.agents.length);

    for (let tries = 0; tries < 6; tries++) {
      const line = draw();
      if (!line) break;
      const text = typeof line.text === 'string' ? line.text : line.text(facts);
      if (!text) continue;
      const free = world.agents.filter((a) => a.mode === 'orbit' && a.alpha > 0.5 && (!line.role || a.role === line.role));
      if (!free.length) continue;
      const agent = free[Math.floor(this.random() * free.length)] ?? free[0];
      if (!agent) continue;
      if (this.start(now, world, agent, ui[lang].roles[agent.role], text)) return;
      // Cerca del cursor todo es texto: la frase queda para otro momento, sin gastarla.
      this.nextAt = now + 2000;
      return;
    }
    // Nadie libre para lo que tocaba decir: se vuelve a intentar en un rato.
    this.nextAt = now + 2000;
  }

  /** Devuelve false si no hay dónde ponerlo sin tapar texto: esa vez se calla. */
  private start(now: number, world: World, agent: Agent, name: string, text: string): boolean {
    const size = this.overlay.measureBubble(name, text);
    let dx = agent.x - world.x;
    let dy = agent.y - scrollY - world.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;

    const offY = clamp(world.y + clamp(dy, -0.6, 0.6) * STEP_OUT * 0.6, 56, innerHeight - 56) - world.y;
    const step = STEP_OUT * Math.max(Math.abs(dx), 0.8);

    // De los dos costados del cursor, el que tiene lugar y menos texto debajo; a igualdad, el suyo.
    const own: 1 | -1 = dx >= 0 ? 1 : -1;
    const other: 1 | -1 = own === 1 ? -1 : 1;
    const options = [own, other].map((side) => {
      const tipX = world.x + side * step;
      const left = side === 1 ? tipX + 16 : tipX - 16 - size.w;
      const top = world.y + offY - size.h / 2 + 4;
      const fits = left >= EDGE && left + size.w <= innerWidth - EDGE;
      return { side, score: fits ? covered(left, top, size.w, size.h) : Infinity };
    });
    const best = options.reduce((a, b) => (b.score < a.score ? b : a));
    if (best.score > 1) return false;

    const { side } = best;
    const offX = side * step;
    agent.mode = 'talk';
    const bubble: Bubble = { ...size, name, color: agent.color, text, x: agent.x, y: agent.y - scrollY, side, alpha: 0 };
    this.overlay.bubbles.push(bubble);
    this.talk = { agent, bubble, offX, offY, fromX: world.x, fromY: world.y, until: now + holdFor(text) };
    return true;
  }
}
