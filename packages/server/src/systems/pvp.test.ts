import { describe, expect, it } from "vitest";
import {
  PVP_AGGRESSION_MS, PZ_LOCK_MS, RED_SKULL_KILLS, RED_SKULL_WINDOW_MS, S2C, deathPenalty, xpForLevel, type SpellDef,
} from "@lemonquest/shared";
import { ConditionSystem } from "./conditions.ts";
import { MovementSystem } from "./movement.ts";
import { PvpSystem } from "./pvp.ts";
import { SpellSystem } from "./spells.ts";
import { SummonSystem } from "./summons.ts";
import { def, openGrid, player, world } from "./testkit.ts";
import type { PlayerState } from "../state.ts";

const F = (base: number) => ({ base, perLevel: 0, perMagic: 0, variance: 0 });
const SP: Record<string, SpellDef> = {
  bolt: { id: "bolt", name: "b", words: "exori", vocations: ["druid"], level: 1, mana: 0, cooldownMs: 0, global: false, target: "target", range: 4, damage: { ...F(20), kind: "ice" }, fx: "ice", description: "" },
  ring: { id: "ring", name: "r", words: "exevo", vocations: ["druid"], level: 1, mana: 0, cooldownMs: 0, global: false, target: "area_self", radius: 2, damage: { ...F(10), kind: "fire" }, fx: "fire", description: "" },
};

/** PZ na faixa x 0–4; o resto do mapa é aberto. */
function setup(o: { party?: [string, string] } = {}) {
  const w = world({
    grid: openGrid(40, 20), spawns: [], defs: () => def({}), spawn: { x: 1, y: 1 },
    safeZones: [{ x0: 0, y0: 0, x1: 4, y1: 19 }],
  });
  const send = (to: string, type: string, msg: unknown) => w.sent.push({ to, type, msg });
  const sameParty = (a: string, b: string) => !!o.party && o.party.includes(a) && o.party.includes(b);
  const pvp = new PvpSystem({ inPz: (x, y) => w.mm.inPz(x, y), sameParty, send, now: w.now });
  const dying: string[] = [];
  w.combat.hooks = {
    canAttackPlayer: (a, b) => pvp.canAttack(a, b),
    onPlayerHit: (a, b, now) => pvp.onHit(a, b, now),
    onDying: (p, killer, now) => { dying.push(p.id); if (killer) pvp.onKill(killer, p, now); pvp.onDeath(p, now); },
    deathXpMult: (p) => (p.skull === "red" ? 2 : 1),
  };
  const conditions = new ConditionSystem({ monsters: w.mm, combat: w.combat, getPlayer: (id) => w.players.get(id), players: () => w.players.values(), send });
  const summons = new SummonSystem({ monsters: w.mm, combat: w.combat, getPlayer: (id) => w.players.get(id) });
  const spells = new SpellSystem({
    grid: openGrid(40, 20), monsters: w.mm, combat: w.combat, conditions, summons,
    players: () => w.players.values(), getPlayer: (id) => w.players.get(id),
    teleport: (p, x, y) => { p.x = x; p.y = y; }, send, broadcast: (type, msg) => send("*", type, msg),
    now: w.now, rng: () => 0.5, spells: (id) => SP[id],
    areaHitsPlayer: (a, b) => !pvp.canAttack(a, b) && (b.id === a.targetId || pvp.justified(a, b)),
  });
  const mk = (id: string, x: number, y: number, over: Partial<PlayerState> = {}) =>
    w.add(player(id, x, y, { skull: "", level: 10, xp: xpForLevel(10) + 500, maxHp: 400, hp: 400, ...over } as Partial<PlayerState>));
  const tick = (ms: number) => w.run(ms, () => pvp.tick(w.now(), w.players.values()));
  const notices = (id: string) => w.sent.filter((s) => s.to === id && s.type === S2C.Notice).map((s) => s.msg.text as string);
  return { w, pvp, spells, mk, tick, notices, dying };
}

describe("PvP", () => {
  it("jogador ataca jogador fora da PZ; dentro da PZ ou no mesmo grupo, não", () => {
    const s = setup({ party: ["a", "c"] });
    const a = s.mk("a", 10, 10), b = s.mk("b", 11, 10), c = s.mk("c", 10, 11);
    s.w.combat.onAttack(a, { targetId: "b" });
    expect(a.targetId).toBe("b");
    s.tick(3000);
    expect(b.hp).toBeLessThan(400);

    s.w.combat.onAttack(a, { targetId: "c" });
    expect(a.targetId).toBe("");
    expect(s.notices("a").at(-1)).toMatch(/grupo/);

    b.x = 3; // dentro da PZ
    s.w.combat.onAttack(a, { targetId: "b" });
    expect(a.targetId).toBe("");
    expect(s.notices("a").at(-1)).toMatch(/zona de proteção/);
    void c;
  });

  it("sem os ganchos de PvP ninguém ataca jogadores", () => {
    const s = setup();
    s.w.combat.hooks = {};
    const a = s.mk("a", 10, 10);
    s.mk("b", 11, 10);
    s.w.combat.onAttack(a, { targetId: "b" });
    expect(a.targetId).toBe("");
  });

  it("atacar inocente dá caveira branca; o revide é justo e não dá caveira; a branca expira", () => {
    const s = setup();
    const a = s.mk("a", 10, 10), b = s.mk("b", 11, 10);
    s.w.combat.onAttack(a, { targetId: "b" });
    s.tick(2500);
    expect(a.skull).toBe("white");
    s.w.combat.onAttack(b, { targetId: "a" });
    s.tick(2500);
    expect(b.skull).toBe("");
    // Para de atacar: a caveira some depois de PVP_AGGRESSION_MS.
    a.targetId = ""; b.targetId = "";
    s.tick(PVP_AGGRESSION_MS + 1000);
    expect(a.skull).toBe("");
  });

  it("morte em PvP: perde XP normal e o matador conta morte injusta; 3 mortes = caveira vermelha (dobro de XP)", () => {
    const s = setup();
    const a = s.mk("a", 10, 10, { level: 30, xp: xpForLevel(30) + 9000, maxHp: 5000, hp: 5000 });
    for (let i = 0; i < RED_SKULL_KILLS; i++) {
      const v = s.mk(`v${i}`, 11, 10, { hp: 1, maxHp: 400 });
      const xp0 = v.xp;
      s.w.combat.onAttack(a, { targetId: v.id });
      s.tick(2500);
      expect(s.dying).toContain(v.id);
      expect(xp0 - v.xp).toBe(deathPenalty(10, xp0));
      s.w.players.delete(v.id);
      s.pvp.removePlayer(v.id);
    }
    expect(a.skull).toBe("red");
    expect(s.pvp.savedKills("a")).toHaveLength(RED_SKULL_KILLS);

    // Caveira vermelha morre: o dobro da XP.
    const k = s.mk("k", 11, 10, { level: 30, maxHp: 5000, hp: 5000 });
    a.hp = 1; a.targetId = "";
    const xp0 = a.xp;
    s.w.combat.onAttack(k, { targetId: "a" });
    s.tick(2500);
    expect(xp0 - a.xp).toBe(Math.min(xp0 - xpForLevel(30), deathPenalty(30, xp0) * 2));
    expect(k.skull).toBe(""); // matar quem tem caveira é justo
    expect(a.skull).toBe("red"); // a vermelha continua depois de morrer
  });

  it("caveira branca e bloqueio de PZ somem quando o jogador morre", () => {
    const s = setup();
    const a = s.mk("a", 10, 10, { hp: 1 }), b = s.mk("b", 11, 10, { level: 30, maxHp: 5000, hp: 5000 });
    s.w.combat.onAttack(a, { targetId: "b" });
    s.tick(2500);
    expect(a.skull).toBe("white");
    expect(s.pvp.pzLocked("a")).toBe(true);
    s.w.combat.onAttack(b, { targetId: "a" });
    s.tick(2500);
    expect(s.dying).toContain("a");
    expect(a.skull).toBe("");
    expect(s.pvp.pzLocked("a")).toBe(false);
    expect(b.skull).toBe(""); // revide justo
  });

  it("mortes injustas salvas voltam no login e expiram em 24 h", () => {
    const s = setup();
    const a = s.mk("a", 10, 10);
    const now = s.w.now();
    s.pvp.load(a, [now - 1000, now - 2000, now - 3000]);
    expect(a.skull).toBe("red");
    const b = s.mk("b", 12, 10);
    s.pvp.load(b, [now - RED_SKULL_WINDOW_MS - 1, now - 1000, now - 2000, "lixo"]);
    expect(b.skull).toBe("");
  });

  it("depois de atacar um jogador não entra na PZ por PZ_LOCK_MS", () => {
    const s = setup();
    const a = s.mk("a", 5, 10), b = s.mk("b", 6, 10);
    const mv = new MovementSystem(openGrid(40, 20), { now: s.w.now });
    mv.addPlayer(a);
    mv.setStepGuard((p, x, y) => s.pvp.blocksStep(p, x, y));
    s.w.combat.onAttack(a, { targetId: "b" });
    s.tick(2500);
    a.targetId = "";
    mv.onMove(a, { dir: 6 /* W */, seq: 1 });
    mv.tick(s.w.now(), [a]);
    expect(a.x).toBe(5);
    expect(s.notices("a").some((t) => /zona de proteção/.test(t))).toBe(true);
    s.tick(PZ_LOCK_MS);
    mv.onMove(a, { dir: 6, seq: 2 });
    mv.tick(s.w.now(), [a]);
    expect(a.x).toBe(4);
    void b;
  });

  it("magia de alvo atinge jogador; área só atinge quem é alvo justo", () => {
    const s = setup();
    const a = s.mk("a", 10, 10, { vocation: "druid" }), b = s.mk("b", 12, 10), c = s.mk("c", 10, 11);
    a.targetId = "b";
    expect(s.spells.cast(a, "bolt").ok).toBe(true);
    expect(b.hp).toBeLessThan(400);
    expect(a.skull).toBe("white");
    // Área: c é inocente e não é o alvo → não leva; b (alvo) leva.
    b.x = 11; b.hp = 400;
    expect(s.spells.cast(a, "ring").ok).toBe(true);
    expect(c.hp).toBe(400);
    expect(b.hp).toBeLessThan(400);
    // Magia de alvo em jogador na PZ falha.
    b.x = 3; b.hp = 400; a.x = 5;
    expect(s.spells.cast(a, "bolt", "b").ok).toBe(false);
    expect(b.hp).toBe(400);
  });
});
