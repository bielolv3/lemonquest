// Utilitários de teste (monstros/combate). Não é importado pelo servidor.
import { CollisionGrid, Dir, TICK_MS, type MonsterDef } from "@lemonquest/shared";
import type { MonsterState, PlayerState } from "../state.ts";
import { MonsterManager, type MonsterManagerOptions, type SpawnPoint } from "./monsters.ts";
import { CombatSystem } from "./combat.ts";

export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function grid(rows: string[]): CollisionGrid {
  const h = rows.length, w = rows[0].length;
  const b = new Uint8Array(w * h);
  rows.forEach((r, y) => [...r].forEach((c, x) => { b[y * w + x] = c === "#" ? 1 : 0; }));
  return new CollisionGrid(w, h, b);
}

export const openGrid = (w: number, h: number) => grid(Array.from({ length: h }, () => ".".repeat(w)));

export function def(over: Partial<MonsterDef> = {}): MonsterDef {
  return {
    id: "dummy", name: "Boneco", level: 1, hp: 30, xp: 10, damage: [5, 5], damageKind: "physical", armor: 0,
    attackMs: 1000, attackRange: 1, stepMs: 200, aggroRange: 5, fleeAtHpPct: 0, respawnMs: 10_000,
    sprite: { url: "", frameWidth: 16, frameHeight: 16, layout: "grid4" },
    ...over,
  };
}

export function player(id: string, x: number, y: number, over: Partial<PlayerState> = {}): PlayerState {
  return {
    id, name: id, vocation: "knight", level: 1, x, y, dir: Dir.S, stepMs: 0, seq: 0,
    hp: 150, maxHp: 150, mana: 50, maxMana: 50, xp: 0, targetId: "", ...over,
  } as unknown as PlayerState;
}

export interface WorldOpts extends Partial<MonsterManagerOptions> {
  defs?: (id: string) => MonsterDef | undefined;
  spawn?: { x: number; y: number };
  seed?: number;
}

/** Mundo de teste: MonsterManager + CombatSystem com relógio injetado e RNG semeado. */
export function world(o: WorldOpts & { grid: CollisionGrid; spawns: SpawnPoint[] }) {
  let clock = 10_000;
  const players = new Map<string, PlayerState>();
  const collection = new Map<string, MonsterState>();
  const sent: { to: string; type: string; msg: any }[] = [];
  const rng = seeded(o.seed ?? 42);
  const log: string[] = [];
  const mm = new MonsterManager({
    collection, rng, now: () => clock,
    players: () => players.values(), getPlayer: (id) => players.get(id),
    log: (m) => log.push(m),
    ...o,
  });
  const combat = new CombatSystem({
    monsters: mm, players: () => players.values(), getPlayer: (id) => players.get(id),
    teleport: (p, x, y) => { p.x = x; p.y = y; },
    spawn: o.spawn ?? { x: 0, y: 0 },
    send: (to, type, msg) => sent.push({ to, type, msg }),
    broadcast: (type, msg) => sent.push({ to: "*", type, msg }),
    rng, now: () => clock,
  });
  const add = (p: PlayerState) => { players.set(p.id, p); return p; };
  /** Avança `ms` em ticks (IA + combate + flush). */
  const run = (ms: number, each?: () => void) => {
    const end = clock + ms;
    while (clock < end) {
      clock += TICK_MS;
      mm.tick(clock);
      combat.tick(clock);
      combat.flush();
      each?.();
    }
  };
  return { mm, combat, players, collection, sent, log, add, run, now: () => clock, setClock: (t: number) => { clock = t; } };
}
