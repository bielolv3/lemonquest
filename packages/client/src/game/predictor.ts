// Predição do próprio jogador. Lógica pura (sem Phaser) — espelha as regras do MovementSystem do servidor.
import { DIR_DELTA, TICK_MS, canStepTerrain, isNearSpawn, stepDuration, type CollisionGrid, type Dir, type GroundSpeedGrid } from "@tibinha/shared";

export interface PredictWorld {
  grid: CollisionGrid;
  spawn: { x: number; y: number } | null;
  /** Velocidade do chão — a MESMA grade (mesmo mapa) que o servidor usa, para cadência idêntica. */
  groundSpeed?: GroundSpeedGrid;
  /** Há outro jogador (posição autoritativa conhecida) neste tile? */
  isOccupied(x: number, y: number): boolean;
}

export type PredictEvent =
  | { kind: "step"; x: number; y: number; dir: Dir; ms: number }
  | { kind: "turn"; dir: Dir };

/** Resultado da reconciliação com a posição vinda do servidor. */
export type Reconcile =
  | { kind: "confirmed" }                         // bate com um passo previsto
  | { kind: "same" }                              // nada a fazer
  | { kind: "external"; ms: number }              // servidor nos moveu sem predição (clique, passo extra)
  | { kind: "diverged" };                         // previsão errada: corrigir para a posição do servidor

interface Predicted { x: number; y: number; at: number; ms: number }

/** Quanto esperar a confirmação de um passo previsto antes de desistir dele (LAN: ~100ms típicos). */
const CONFIRM_TIMEOUT_MS = 450;

export class Predictor {
  /** Posição prevista (após o último passo previsto). */
  x = 0;
  y = 0;
  dir: Dir = 4;
  level = 1;
  stepEndsAt = 0;
  held: Dir | null = null;
  pending: Dir | null = null;
  private queue: Predicted[] = [];

  constructor(private readonly world: PredictWorld) {}

  get unconfirmed(): number { return this.queue.length; }

  reset(x: number, y: number, dir: Dir) {
    this.x = x; this.y = y; this.dir = dir;
    this.queue = [];
    this.pending = null;
  }

  press(dir: Dir) { this.held = dir; this.pending = dir; }
  release() { this.held = null; }
  /** Esquece teclas (ex.: clique no mapa, que cancela a intenção no servidor). */
  clearIntent() { this.held = null; this.pending = null; }

  isFree(now: number) { return now >= this.stepEndsAt; }

  /** Chamado a cada frame. Inicia um passo local se livre e houver intenção. */
  update(now: number): PredictEvent | null {
    if (now < this.stepEndsAt) return null;
    let d: Dir | null;
    if (this.pending !== null) { d = this.pending; this.pending = null; }
    else d = this.held;
    if (d === null) return null;

    const { dx, dy } = DIR_DELTA[d];
    const tx = this.x + dx, ty = this.y + dy;
    const blocked = !canStepTerrain(this.world.grid, this.x, this.y, dx, dy)
      || (!isNearSpawn(this.world.spawn, tx, ty) && this.world.isOccupied(tx, ty));
    if (blocked) {
      if (this.dir === d) return null;
      this.dir = d;
      return { kind: "turn", dir: d };
    }
    // Chão do tile de ORIGEM, igual ao MovementSystem do servidor.
    const ms = stepDuration(this.level, d, this.world.groundSpeed?.speedAt(this.x, this.y));
    // Mesmo encadeamento do servidor: passos contínuos mantêm cadência exata.
    const startAt = now - this.stepEndsAt <= TICK_MS ? this.stepEndsAt : now;
    this.stepEndsAt = startAt + ms;
    this.x = tx; this.y = ty; this.dir = d;
    this.queue.push({ x: tx, y: ty, at: now, ms });
    return { kind: "step", x: tx, y: ty, dir: d, ms };
  }

  /** Nova posição autoritativa do próprio jogador. */
  onServerPos(sx: number, sy: number, stepMs: number, now: number): Reconcile {
    const i = this.queue.findIndex((p) => p.x === sx && p.y === sy);
    if (i >= 0) {
      this.queue.splice(0, i + 1);
      return { kind: "confirmed" };
    }
    if (this.queue.length === 0) {
      if (sx === this.x && sy === this.y) return { kind: "same" };
      const far = Math.max(Math.abs(sx - this.x), Math.abs(sy - this.y)) > 1;
      this.x = sx; this.y = sy;
      this.stepEndsAt = far ? now : now + stepMs;
      return { kind: "external", ms: stepMs };
    }
    this.diverge(sx, sy, now);
    return { kind: "diverged" };
  }

  /** Previsão mais antiga sem confirmação há tempo demais → volta para a posição do servidor. */
  checkStale(sx: number, sy: number, now: number): boolean {
    const head = this.queue[0];
    if (!head || now - head.at < CONFIRM_TIMEOUT_MS) return false;
    this.diverge(sx, sy, now);
    return true;
  }

  private diverge(sx: number, sy: number, now: number) {
    this.queue = [];
    this.pending = null;
    this.x = sx; this.y = sy;
    this.stepEndsAt = now + 100; // tempo da correção suave
  }
}
