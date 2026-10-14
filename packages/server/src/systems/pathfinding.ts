// A* em grade, 8 direções, sem cortar quina. Função pura — reutilizada pela IA de monstros (M2).
import { DIAGONAL_COST } from "@lemonquest/shared";

export interface Point { x: number; y: number }

/** O mínimo que o A* precisa de uma grade (CollisionGrid satisfaz). */
export interface WalkGrid {
  readonly width: number;
  readonly height: number;
  isWalkable(x: number, y: number): boolean;
}

export interface FindPathOptions {
  /** Máximo de nós expandidos antes de desistir. */
  maxNodes?: number;
  /** Distância máxima (Chebyshev) entre origem e destino. */
  maxDist?: number;
}

export const PATH_MAX_NODES = 2000;
export const PATH_MAX_DIST = 40;

const NEIGHBORS: readonly [number, number][] = [
  [0, -1], [1, 0], [0, 1], [-1, 0], // ortogonais primeiro: empates preferem linha reta
  [1, -1], [1, 1], [-1, 1], [-1, -1],
];

/**
 * Caminho de `from` até `to` (exclui `from`, inclui `to`). `[]` se já está lá; `null` se não há caminho
 * dentro dos limites.
 *
 * `isBlocked(x, y)` marca bloqueios dinâmicos (jogadores, monstros). Ele NÃO é aplicado ao destino
 * (permite traçar rota até um alvo ocupado — quem consome o caminho decide o que fazer no último passo).
 * Quinas: uma diagonal exige os dois ortogonais andáveis no terreno (bloqueios dinâmicos não impedem diagonal).
 */
export function findPath(
  grid: WalkGrid,
  from: Point,
  to: Point,
  isBlocked?: (x: number, y: number) => boolean,
  opts: FindPathOptions = {},
): Point[] | null {
  const maxNodes = opts.maxNodes ?? PATH_MAX_NODES;
  const maxDist = opts.maxDist ?? PATH_MAX_DIST;
  const { width: W, height: H } = grid;

  if (from.x === to.x && from.y === to.y) return [];
  if (!grid.isWalkable(to.x, to.y)) return null;
  if (Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) > maxDist) return null;
  if (from.x < 0 || from.y < 0 || from.x >= W || from.y >= H) return null;

  const start = from.y * W + from.x;
  const goal = to.y * W + to.x;
  // Buffers do tamanho do mapa reaproveitados entre chamadas: um nó só vale se stamp[i] === gen (sem fill a cada busca).
  const sc = scratchFor(W * H);
  const { g, parent, stamp, heap } = sc;
  const gen = ++sc.gen;
  const CLOSED = -gen; // stamp negativo = nó fechado nesta busca
  heap.clear();
  const seen = (i: number) => stamp[i] === gen || stamp[i] === CLOSED;

  const h = (x: number, y: number) => {
    const dx = Math.abs(x - to.x), dy = Math.abs(y - to.y);
    return Math.max(dx, dy) + (DIAGONAL_COST - 1) * Math.min(dx, dy);
  };

  g[start] = 0;
  parent[start] = -1;
  stamp[start] = gen;
  heap.push(start, h(from.x, from.y), h(from.x, from.y));
  let expanded = 0;

  while (heap.size > 0) {
    const cur = heap.pop();
    if (stamp[cur] === CLOSED) continue;
    if (cur === goal) return rebuild(parent, cur, start, W);
    stamp[cur] = CLOSED;
    if (++expanded > maxNodes) return null;

    const cx = cur % W, cy = (cur - cx) / W;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cx + dx, ny = cy + dy;
      if (!grid.isWalkable(nx, ny)) continue;
      const diag = dx !== 0 && dy !== 0;
      if (diag && (!grid.isWalkable(cx + dx, cy) || !grid.isWalkable(cx, cy + dy))) continue;
      const ni = ny * W + nx;
      if (stamp[ni] === CLOSED) continue;
      if (ni !== goal && isBlocked?.(nx, ny)) continue;
      const ng = g[cur] + (diag ? DIAGONAL_COST : 1);
      if (!seen(ni) || ng < g[ni]) {
        stamp[ni] = gen;
        g[ni] = ng;
        parent[ni] = cur;
        const hn = h(nx, ny);
        heap.push(ni, ng + hn, hn);
      }
    }
  }
  return null;
}

interface Scratch { g: Float64Array; parent: Int32Array; stamp: Int32Array; heap: MinHeap; gen: number }
let scratch: Scratch | null = null;

/** Buffers da busca para mapas de N tiles (recriados só se o tamanho mudar; gen reinicia antes de estourar). */
function scratchFor(n: number): Scratch {
  if (!scratch || scratch.g.length !== n || scratch.gen > 0x3fffffff) {
    scratch = { g: new Float64Array(n), parent: new Int32Array(n), stamp: new Int32Array(n), heap: new MinHeap(), gen: 0 };
  }
  return scratch;
}

function rebuild(parent: Int32Array, end: number, start: number, W: number): Point[] {
  const out: Point[] = [];
  for (let i = end; i !== start; i = parent[i]) out.push({ x: i % W, y: Math.floor(i / W) });
  return out.reverse();
}

/** Heap binário mínimo por (f, h) — desempate pelo menor h favorece nós mais próximos do destino. */
class MinHeap {
  private ids: number[] = [];
  private f: number[] = [];
  private h: number[] = [];
  get size() { return this.ids.length; }
  clear() { this.ids.length = 0; this.f.length = 0; this.h.length = 0; }

  push(id: number, f: number, h: number) {
    this.ids.push(id); this.f.push(f); this.h.push(h);
    let i = this.ids.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }

  pop(): number {
    const top = this.ids[0];
    const last = this.ids.length - 1;
    this.swap(0, last);
    this.ids.pop(); this.f.pop(); this.h.pop();
    let i = 0;
    const n = this.ids.length;
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < n && this.less(l, m)) m = l;
      if (r < n && this.less(r, m)) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
    return top;
  }

  private less(a: number, b: number) {
    return this.f[a] < this.f[b] - 1e-9 || (Math.abs(this.f[a] - this.f[b]) <= 1e-9 && this.h[a] < this.h[b]);
  }

  private swap(a: number, b: number) {
    const ids = this.ids, f = this.f, h = this.h;
    let t = ids[a]; ids[a] = ids[b]; ids[b] = t;
    t = f[a]; f[a] = f[b]; f[b] = t;
    t = h[a]; h[a] = h[b]; h[b] = t;
  }
}
