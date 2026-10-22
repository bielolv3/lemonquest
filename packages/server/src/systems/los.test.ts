// Linha de visão no servidor: monstros à distância, ataque automático do jogador, perseguição e magias.
import { describe, expect, it } from "vitest";
import { S2C, type SpellDef } from "@lemonquest/shared";
import { ConditionSystem } from "./conditions.ts";
import { FightModeSystem } from "./fightmode.ts";
import { SkillSystem } from "./skills.ts";
import { SpellSystem } from "./spells.ts";
import { SummonSystem } from "./summons.ts";
import { cheb } from "./monsters.ts";
import { def, grid, player, world } from "./testkit.ts";

// Parede vertical em x=8, y=2..8 (o resto é aberto).
const WALL = grid(Array.from({ length: 14 }, (_, y) =>
  Array.from({ length: 20 }, (_, x) => (x === 8 && y >= 2 && y <= 8 ? "#" : ".")).join("")));
const sp = (x: number, y: number) => ({ defId: "m", x, y, count: 1, radius: 0 });
const events = (w: { sent: { type: string; msg: any }[] }) =>
  w.sent.filter((s) => s.type === S2C.Combat).flatMap((s) => s.msg.events);

describe("LOS: ranged monsters", () => {
  it("never shoots through a wall; repositions (pathfinding) to a tile with sight and then attacks", () => {
    const w = world({ grid: WALL, spawns: [sp(11, 5)], defs: () => def({ id: "m", aggroRange: 8, attackRange: 4, damage: [2, 2], attackMs: 500 }) });
    w.mm.spawnAll();
    const m = [...w.mm.all()][0];
    const p = w.add(player("p", 6, 5, { hp: 10_000, maxHp: 10_000 }));
    expect(w.mm.los(m.s.x, m.s.y, p.x, p.y)).toBe(false);
    const hook = w.mm.attackHook;
    const shots: boolean[] = [];
    w.mm.attackHook = (mm, t, now) => { shots.push(w.mm.los(mm.s.x, mm.s.y, t.x, t.y)); hook(mm, t, now); };
    w.run(8000);
    expect(shots.length).toBeGreaterThan(0);
    expect(shots.every(Boolean)).toBe(true);
    expect(p.hp).toBeLessThan(10_000);
    expect(cheb(m.s.x, m.s.y, p.x, p.y)).toBeLessThanOrEqual(4);
  });

  it("rooted behind a wall: no attack at all", () => {
    const w = world({ grid: WALL, spawns: [sp(10, 5)], defs: () => def({ id: "m", aggroRange: 8, attackRange: 4, damage: [2, 2] }) });
    w.mm.spawnAll();
    const m = [...w.mm.all()][0];
    m.speedPct = 0;
    const p = w.add(player("p", 7, 5, { hp: 500, maxHp: 500 }));
    w.run(5000);
    expect(p.hp).toBe(500);
    expect(m.s.targetId).toBe("p");
  });

  it("melee is unaffected (adjacent through an open corner)", () => {
    const g = grid(["#....", ".....", "....."]);
    const w = world({ grid: g, spawns: [sp(1, 0)], defs: () => def({ id: "m", aggroRange: 5, attackRange: 1, damage: [2, 2] }) });
    w.mm.spawnAll();
    const m = [...w.mm.all()][0];
    m.speedPct = 0;
    const p = w.add(player("p", 0, 1, { hp: 500, maxHp: 500 }));
    w.run(3000);
    expect(p.hp).toBeLessThan(500);
  });
});

describe("LOS: player ranged auto-attack", () => {
  const ranged = () => ({ range: 6, kind: "physical" as const, ranged: true, damage: [5, 5] as [number, number], critPct: 0 });

  it("no attack through a wall; attacks once the line is clear", () => {
    const w = world({ grid: WALL, spawns: [sp(10, 5)], defs: () => def({ id: "m", aggroRange: 0, hp: 10_000 }) });
    w.mm.spawnAll();
    const m = [...w.mm.all()][0];
    m.speedPct = 0;
    w.combat.hooks.attack = ranged;
    const p = w.add(player("r", 6, 5, { vocation: "paladin" }));
    w.combat.onAttack(p, { targetId: m.s.id });
    w.run(3000);
    expect(events(w).filter((e: any) => e.sourceId === "r")).toHaveLength(0);
    expect(p.targetId).toBe(m.s.id); // mantém o alvo
    p.x = 10; p.y = 11; // abaixo do alvo, longe da parede
    expect(w.mm.los(p.x, p.y, m.s.x, m.s.y)).toBe(true);
    w.run(2100);
    expect(events(w).filter((e: any) => e.sourceId === "r").length).toBeGreaterThan(0);
  });

  it("chase mode steps toward the target when in range but without sight", () => {
    const w = world({ grid: WALL, spawns: [sp(10, 5)], defs: () => def({ id: "m", aggroRange: 0 }) });
    w.mm.spawnAll();
    const m = [...w.mm.all()][0];
    const p = w.add(player("r", 6, 5, { vocation: "paladin", chase: true, targetId: m.s.id } as never));
    const calls: unknown[] = [];
    const fight = new FightModeSystem({
      movement: { isIdle: () => true, pathFor: (_p, goal) => { calls.push(goal); return [{ x: 6, y: 6 }]; }, follow: () => "ok" },
      monsters: w.mm, attackRange: () => 6,
    });
    fight.tick(w.now(), [p]);
    expect(calls).toHaveLength(1);
    // Com visão, mas longe: continua indo (perseguir gruda no alvo).
    p.x = 10; p.y = 8;
    calls.length = 0;
    fight.tick(w.now() + 1000, [p]);
    expect(calls).toHaveLength(1);
    // Ao lado: para.
    p.x = 10; p.y = 6;
    calls.length = 0;
    fight.tick(w.now() + 2000, [p]);
    expect(calls).toHaveLength(0);
  });
});

describe("LOS: spells", () => {
  const F = (base: number) => ({ base, perLevel: 0, perMagic: 0, variance: 0 });
  const SP: Record<string, SpellDef> = {
    bolt: { id: "bolt", name: "b", words: "exori", vocations: ["druid"], level: 1, mana: 10, cooldownMs: 0, global: false, target: "target", range: 7, damage: { ...F(20), kind: "ice" }, fx: "ice", description: "" },
    ball: { id: "ball", name: "gfb", words: "adori", vocations: ["druid"], level: 1, mana: 0, cooldownMs: 0, global: false, target: "area_target", range: 7, radius: 2, damage: { ...F(10), kind: "fire" }, fx: "fire", description: "" },
    ring: { id: "ring", name: "r", words: "exevo", vocations: ["druid"], level: 1, mana: 0, cooldownMs: 0, global: false, target: "area_self", radius: 2, damage: { ...F(10), kind: "fire" }, fx: "fire", description: "" },
  };
  function setup(mons: { x: number; y: number }[]) {
    const w = world({ grid: WALL, spawns: mons.map((m, i) => ({ defId: `d${i}`, x: m.x, y: m.y, count: 1, radius: 0 })),
      defs: (id) => def({ id, aggroRange: 0, hp: 1000 }) });
    w.mm.spawnAll();
    const send = (to: string, type: string, msg: unknown) => w.sent.push({ to, type, msg });
    const conditions = new ConditionSystem({ monsters: w.mm, combat: w.combat, getPlayer: (id) => w.players.get(id), players: () => w.players.values(), send });
    const summons = new SummonSystem({ monsters: w.mm, combat: w.combat, getPlayer: (id) => w.players.get(id) });
    const spells = new SpellSystem({
      grid: WALL, monsters: w.mm, combat: w.combat, conditions, summons, skills: new SkillSystem(send),
      players: () => w.players.values(), getPlayer: (id) => w.players.get(id),
      teleport: (p, x, y) => { p.x = x; p.y = y; }, send, broadcast: (type, msg) => send("*", type, msg),
      now: w.now, rng: () => 0.5, spells: (id) => SP[id],
    });
    const addP = (x: number, y: number) => {
      const p = w.add(player("p", x, y, { vocation: "druid", mana: 500, maxMana: 500, magicLevel: 0 }));
      w.mm.playerList = [...w.players.values()];
      return p;
    };
    // Monstros na ordem dos spawns (ids m1, m2, ...).
    const ms = [...w.mm.all()].sort((a, b) => Number(a.s.id.slice(1)) - Number(b.s.id.slice(1)));
    return { ...w, spells, addP, ms };
  }

  it("target spell through a wall fails with no_los (no mana spent); works with sight", () => {
    const w = setup([{ x: 10, y: 5 }]);
    const p = w.addP(6, 5);
    expect(w.spells.cast(p, "bolt", w.ms[0].s.id)).toEqual({ spellId: "bolt", ok: false, reason: "no_los" });
    expect(w.ms[0].s.hp).toBe(1000);
    expect(p.mana).toBe(500);
    p.x = 10; p.y = 11;
    expect(w.spells.cast(p, "bolt", w.ms[0].s.id)).toMatchObject({ ok: true });
    expect(w.ms[0].s.hp).toBe(980);
  });

  it("area_target needs sight to the center", () => {
    const w = setup([{ x: 10, y: 5 }]);
    const p = w.addP(6, 5);
    expect(w.spells.cast(p, "ball", w.ms[0].s.id)).toMatchObject({ ok: false, reason: "no_los" });
  });

  it("area effects skip tiles behind walls relative to the center", () => {
    // Centro em (9,5), colado na parede: (7,5) fica do outro lado da parede.
    const w = setup([{ x: 9, y: 5 }, { x: 7, y: 5 }, { x: 10, y: 6 }]);
    const p = w.addP(13, 5);
    expect(w.spells.cast(p, "ball", w.ms[0].s.id)).toMatchObject({ ok: true });
    expect(w.ms[0].s.hp).toBe(990);
    expect(w.ms[1].s.hp).toBe(1000); // atrás da parede
    expect(w.ms[2].s.hp).toBe(990);
    const sc = w.sent.filter((s) => s.type === S2C.SpellCast).at(-1)!.msg;
    const tiles: number[] = sc.tiles;
    for (let i = 0; i < tiles.length; i += 2) expect(tiles[i]).toBeGreaterThan(8);

    // area_self: o mesmo vale a partir do conjurador.
    const v = setup([{ x: 7, y: 5 }, { x: 10, y: 4 }]);
    const q = v.addP(9, 5);
    expect(v.spells.cast(q, "ring")).toMatchObject({ ok: true });
    expect(v.ms[0].s.hp).toBe(1000);
    expect(v.ms[1].s.hp).toBe(990);
  });

  it("creatures don't block sight", () => {
    const w = setup([{ x: 12, y: 11 }, { x: 10, y: 11 }]);
    const p = w.addP(6, 11);
    expect(w.spells.cast(p, "bolt", w.ms[0].s.id)).toMatchObject({ ok: true });
  });
});
