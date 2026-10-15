// Modos de batalha (estilo Tibia): postura (ofensivo/equilibrado/defensivo → multiplicadores de dano causado/recebido)
// e perseguição (com alvo fora do alcance, anda até ele um passo por vez pelo MovementSystem).
import { STANCE_DEALT, STANCE_TAKEN, dirFromDelta, type FightModeMsg, type FightStance } from "@lemonquest/shared";
import type { PlayerState } from "../state.ts";
import type { MovementSystem } from "./movement.ts";
import { cheb, type MonsterManager } from "./monsters.ts";
import type { Point } from "./pathfinding.ts";

/** Recalcula o caminho de perseguição no máximo a cada isto (ms) — ou antes, se o alvo mudar de tile. */
export const CHASE_REPATH_MS = 300;
/** Movimento manual (Move/WalkTo) pausa a perseguição por isto (ms). */
export const CHASE_PAUSE_MS = 1500;

const STANCES: FightStance[] = ["offensive", "balanced", "defensive"];

export const stanceDealt = (p: Pick<PlayerState, "stance">): number => STANCE_DEALT[p.stance] ?? 1;
export const stanceTaken = (p: Pick<PlayerState, "stance">): number => STANCE_TAKEN[p.stance] ?? 1;

export interface FightModeOptions {
  movement: Pick<MovementSystem, "isIdle" | "pathFor" | "follow">;
  monsters: Pick<MonsterManager, "wild"> & Partial<Pick<MonsterManager, "los">>;
  /** Alcance do ataque automático atual do jogador (arma/vocação). */
  attackRange: (p: PlayerState) => number;
  now?: () => number;
}

interface ChaseState {
  path: Point[] | null;
  at: number;
  targetId: string;
  goal: Point;
  pausedUntil: number;
}

export class FightModeSystem {
  private readonly st = new Map<string, ChaseState>();
  private readonly now: () => number;

  constructor(private readonly o: FightModeOptions) {
    this.now = o.now ?? Date.now;
  }

  /** Carrega postura/perseguição salvas. */
  load(p: PlayerState, stance?: unknown, chase?: unknown): void {
    p.stance = STANCES.includes(stance as FightStance) ? (stance as FightStance) : "balanced";
    // Personagem novo (nunca salvou o modo): cavaleiro começa seguindo o alvo — corpo a corpo parado não alcança o rato
    // que foge com pouca vida, e o novato não conhece o F8 (robô: 2 ratos em 10 min). Quem já escolheu fica como está.
    p.chase = chase === undefined ? p.vocation === "knight" : chase === true;
  }

  /** C2S.FightMode */
  onFightMode(p: PlayerState, msg: FightModeMsg): void {
    if (!msg || typeof msg !== "object") return;
    if (STANCES.includes(msg.stance)) p.stance = msg.stance;
    if (typeof msg.chase === "boolean") {
      p.chase = msg.chase;
      if (!msg.chase) this.st.delete(p.id);
    }
  }

  /** Movimento manual: pausa a perseguição por CHASE_PAUSE_MS. */
  pause(id: string, now = this.now()): void {
    const s = this.state(id);
    s.pausedUntil = now + CHASE_PAUSE_MS;
    s.path = null;
  }

  removePlayer(id: string): void {
    this.st.delete(id);
  }

  private state(id: string): ChaseState {
    let s = this.st.get(id);
    if (!s) { s = { path: null, at: 0, targetId: "", goal: { x: -1, y: -1 }, pausedUntil: 0 }; this.st.set(id, s); }
    return s;
  }

  /** Chamar a cada tick ANTES de MovementSystem.tick. */
  tick(now: number, players: Iterable<PlayerState>): void {
    for (const p of players) {
      if (!p.chase || !p.targetId || p.hp <= 0) { const s = this.st.get(p.id); if (s) s.path = null; continue; }
      const m = this.o.monsters.wild(p.targetId);
      if (!m) continue;
      const s = this.state(p.id);
      if (now < s.pausedUntil) continue;
      const d = cheb(p.x, p.y, m.s.x, m.s.y);
      const range = Math.max(1, this.o.attackRange(p));
      // No alcance: para — exceto à distância sem linha de visão (anda em direção ao alvo até enxergá-lo).
      const sight = range <= 1 || !this.o.monsters.los || this.o.monsters.los(p.x, p.y, m.s.x, m.s.y);
      if (d <= range && sight) { s.path = null; continue; }
      if (!this.o.movement.isIdle(p, now)) continue;
      const moved = s.goal.x !== m.s.x || s.goal.y !== m.s.y;
      const stale = now - s.at >= CHASE_REPATH_MS;
      if (s.targetId !== p.targetId || (stale && (!s.path?.length || moved))) {
        s.path = this.o.movement.pathFor(p, { x: m.s.x, y: m.s.y });
        s.at = now;
        s.targetId = p.targetId;
        s.goal = { x: m.s.x, y: m.s.y };
      }
      const next = s.path?.[0];
      if (!next) continue;
      const dir = dirFromDelta(next.x - p.x, next.y - p.y);
      if (dir === null) { s.path = null; continue; }
      const r = this.o.movement.follow(p, dir, now);
      if (r === "ok") s.path!.shift();
      else if (r !== "busy") s.path = null; // bloqueado: recalcula no próximo tick permitido
    }
  }
}
