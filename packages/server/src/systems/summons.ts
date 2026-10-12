// Invocações: monstros aliados com dono (MonsterState.ownerId = sessionId). Seguem o dono (até 3 tiles),
// atacam o alvo do dono ou quem ataca o dono/a invocação, não dão XP, somem ao expirar ou quando o dono
// sai/morre/se afasta mais de SUMMON_LEASH tiles. 1 conjuração ativa por jogador (reconjurar substitui).
import { DIR_DELTA, Dir, dirFromDelta, mitigate, monsterDef, rollInt, type MonsterDef } from "@lemonquest/shared";
import type { PlayerState } from "../state.ts";
import { THINK_MS, computePath, followPath, greedyStep } from "./ai.ts";
import type { CombatSystem } from "./combat.ts";
import { cheb, type Monster, type MonsterManager } from "./monsters.ts";
import type { Point } from "./pathfinding.ts";

/** Dono a mais que isso → a invocação some. */
export const SUMMON_LEASH = 20;
/** Fica a até esta distância do dono quando não está lutando. */
export const SUMMON_FOLLOW_DIST = 3;
/** Só procura/persegue alvos a até esta distância do dono. */
export const SUMMON_FIGHT_DIST = 8;

const RING: Dir[] = [Dir.S, Dir.E, Dir.W, Dir.N, Dir.SE, Dir.SW, Dir.NE, Dir.NW];

export interface SummonOptions {
  monsters: MonsterManager;
  combat: Pick<CombatSystem, "damageMonster">;
  getPlayer: (id: string) => PlayerState | undefined;
  defs?: (id: string) => MonsterDef | undefined;
  rng?: () => number;
}

export class SummonSystem {
  /** dono → ids das invocações ativas. */
  private readonly byOwner = new Map<string, Set<string>>();
  private readonly until = new Map<string, number>();

  constructor(private readonly o: SummonOptions) {
    o.monsters.summonAi = (m, _w, now) => this.update(m, now);
    o.monsters.onSummonRemoved = (m) => this.forget(m);
  }

  def(id: string): MonsterDef | undefined {
    return (this.o.defs ?? monsterDef)(id);
  }

  /** Tiles livres para invocar ao redor de (x,y) (vizinhos, depois raio 2). */
  freeTilesAround(x: number, y: number, max: number): Point[] {
    const mm = this.o.monsters;
    const out: Point[] = [];
    const ok = (tx: number, ty: number) => mm.grid.isWalkable(tx, ty) && !mm.blockedForMonster(tx, ty);
    for (const d of RING) {
      const { dx, dy } = DIR_DELTA[d];
      if (out.length < max && ok(x + dx, y + dy)) out.push({ x: x + dx, y: y + dy });
    }
    for (let r = 2; r <= 2 && out.length < max; r++)
      for (let ty = y - r; ty <= y + r && out.length < max; ty++)
        for (let tx = x - r; tx <= x + r && out.length < max; tx++)
          if (cheb(tx, ty, x, y) === r && ok(tx, ty)) out.push({ x: tx, y: ty });
    return out;
  }

  /** Invoca (substitui as invocações anteriores do jogador). Retorna quantas nasceram. */
  summon(p: PlayerState, spec: { monsterId: string; count: number; durationMs: number }, now: number): number {
    const def = this.def(spec.monsterId);
    if (!def) return 0;
    this.despawnOwner(p.id);
    const tiles = this.freeTilesAround(p.x, p.y, Math.max(1, spec.count));
    const set = new Set<string>();
    for (const t of tiles) {
      const m = this.o.monsters.spawnSummon(def, t.x, t.y, p.id, now);
      set.add(m.s.id);
      this.until.set(m.s.id, now + spec.durationMs);
    }
    if (set.size) this.byOwner.set(p.id, set);
    return set.size;
  }

  /** Remove todas as invocações do jogador (saída, morte, reconjuração). */
  despawnOwner(ownerId: string): void {
    const set = this.byOwner.get(ownerId);
    if (!set) return;
    for (const id of [...set]) {
      const m = this.o.monsters.get(id);
      if (m) this.o.monsters.kill(m);
    }
    this.byOwner.delete(ownerId);
  }

  ownedBy(ownerId: string): string[] {
    return [...(this.byOwner.get(ownerId) ?? [])];
  }

  private forget(m: Monster) {
    this.until.delete(m.s.id);
    const set = this.byOwner.get(m.s.ownerId);
    if (set) { set.delete(m.s.id); if (set.size === 0) this.byOwner.delete(m.s.ownerId); }
  }

  /** IA da invocação (chamada pelo MonsterManager a cada tick). */
  update(m: Monster, now: number): void {
    const w = this.o.monsters;
    const owner = this.o.getPlayer(m.s.ownerId);
    if (!owner || owner.hp <= 0 || now >= (this.until.get(m.s.id) ?? 0) || cheb(owner.x, owner.y, m.s.x, m.s.y) > SUMMON_LEASH) {
      w.kill(m, now);
      return;
    }
    if (now >= m.nextThinkAt) {
      m.nextThinkAt = now + THINK_MS;
      this.think(m, owner, now);
    }
    this.act(m, owner, now);
  }

  private pickTarget(m: Monster, owner: PlayerState): Monster | undefined {
    const w = this.o.monsters;
    const near = (t: Monster) => cheb(owner.x, owner.y, t.s.x, t.s.y) <= SUMMON_FIGHT_DIST;
    const ot = w.wild(owner.targetId);
    if (ot && !ot.def.invulnerable && near(ot)) return ot; // invocações ignoram bonecos de treino
    const cur = w.wild(m.s.targetId);
    if (cur && near(cur) && (cur.s.targetId === owner.id || cur.s.targetId === m.s.id)) return cur;
    let best: Monster | undefined, bestD = Infinity;
    for (const t of w.all()) {
      if (t.s.ownerId || (t.s.targetId !== owner.id && t.s.targetId !== m.s.id) || !near(t)) continue;
      const d = cheb(m.s.x, m.s.y, t.s.x, t.s.y);
      if (d < bestD) { best = t; bestD = d; }
    }
    return best;
  }

  private think(m: Monster, owner: PlayerState, now: number) {
    const t = this.pickTarget(m, owner);
    m.s.targetId = t?.s.id ?? "";
    const goal = this.goal(m, owner, t);
    if (!goal) { m.path = null; return; }
    const moved = cheb(goal.x, goal.y, m.pathGoal.x, m.pathGoal.y);
    if (!m.path || m.path.length === 0 || moved >= 1) computePath(m, this.o.monsters, goal, now, true);
  }

  /** Para onde andar (null = já está bem posicionada). */
  private goal(m: Monster, owner: PlayerState, t: Monster | undefined): Point | null {
    const s = m.s;
    if (t) {
      const range = Math.max(1, m.def.attackRange);
      const inRange = cheb(s.x, s.y, t.s.x, t.s.y) <= range;
      // Distância sem linha de visão: aproxima-se até enxergar.
      return inRange && (range <= 1 || this.o.monsters.los(s.x, s.y, t.s.x, t.s.y)) ? null : { x: t.s.x, y: t.s.y };
    }
    return cheb(s.x, s.y, owner.x, owner.y) < SUMMON_FOLLOW_DIST ? null : { x: owner.x, y: owner.y };
  }

  private act(m: Monster, owner: PlayerState, now: number) {
    const w = this.o.monsters;
    const s = m.s;
    const t = w.wild(s.targetId);
    if (t) {
      const d = cheb(s.x, s.y, t.s.x, t.s.y);
      const range = Math.max(1, m.def.attackRange);
      if (d >= 1 && d <= range && now >= m.nextAttackAt && (range <= 1 || w.los(s.x, s.y, t.s.x, t.s.y))) {
        const face = dirFromDelta(Math.sign(t.s.x - s.x), Math.sign(t.s.y - s.y));
        if (face !== null && now >= m.stepEndsAt) s.dir = face;
        m.nextAttackAt = now + m.def.attackMs;
        const raw = rollInt(m.def.damage[0], m.def.damage[1], this.o.rng ?? w.rng);
        // Dano da invocação conta para o dono (XP), como no Tibia.
        this.o.combat.damageMonster(t, s.id, mitigate(raw, t.def.armor), m.def.damageKind, now, { creditId: owner.id, ranged: range > 1 });
        if (!w.get(s.id)) return;
      }
    }
    if (now < m.stepEndsAt) return;
    const goal = this.goal(m, owner, w.wild(s.targetId));
    if (!goal) return;
    if (!followPath(m, w, now, goal)) greedyStep(m, w, goal, now, false);
  }
}
