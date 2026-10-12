import { describe, expect, it } from "vitest";
import { PLAYER_ATTACK_MS, REGEN_INTERVAL_MS, S2C, baseStats, deathPenalty, xpForLevel } from "@lemonquest/shared";
import { RegenSystem } from "./regen.ts";
import { def, openGrid, player, world } from "./testkit.ts";

const types = (sent: { type: string }[]) => sent.map((s) => s.type);

function setup(over: Parameters<typeof def>[0] = {}, extra: Partial<Parameters<typeof world>[0]> = {}) {
  const w = world({
    grid: openGrid(30, 30), spawns: [{ defId: "dummy", x: 10, y: 10, count: 1, radius: 0 }],
    defs: () => def({ aggroRange: 0, ...over }), spawn: { x: 25, y: 25 }, ...extra,
  });
  w.mm.spawnAll();
  const m = [...w.mm.all()][0];
  return { ...w, m };
}

describe("player combat", () => {
  it("knight kills a monster: batched combat events, xp, multi level up, notices", () => {
    const w = setup({ hp: 20, xp: xpForLevel(6) + 5, armor: 0 });
    const p = w.add(player("k", 11, 10, { name: "Leo", hp: 100 }));
    w.combat.onAttack(p, { targetId: w.m.s.id });
    expect(p.targetId).toBe(w.m.s.id);
    w.run(PLAYER_ATTACK_MS * 6);
    expect(w.mm.size).toBe(0);
    expect(w.collection.size).toBe(0);
    expect(p.targetId).toBe("");
    // Evento de combate antes de CreatureDied; XP depois.
    const t = types(w.sent);
    expect(t.indexOf(S2C.Combat)).toBeLessThan(t.indexOf(S2C.CreatureDied));
    const xp = w.sent.find((s) => s.type === S2C.XpGain)!;
    expect(xp).toMatchObject({ to: "k", msg: { amount: xpForLevel(6) + 5, x: 10, y: 10 } });
    expect(p.level).toBe(6);
    const stats = baseStats("knight", 6);
    expect([p.maxHp, p.hp, p.maxMana, p.mana]).toEqual([stats.maxHp, stats.maxHp, stats.maxMana, stats.maxMana]);
    expect(w.sent.find((s) => s.type === S2C.LevelUp)!.msg).toEqual({ level: 6, maxHp: stats.maxHp, maxMana: stats.maxMana });
    expect(w.sent.find((s) => s.type === S2C.Notice)!.msg).toEqual({ text: "Leo chegou ao level 6!", kind: "good" });
    const ev = w.sent.filter((s) => s.type === S2C.Combat).flatMap((s) => s.msg.events);
    const mine = ev.filter((e: any) => e.sourceId === "k");
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((e: any) => e.kind === "physical" && e.ranged === undefined)).toBe(true);
  });

  it("attacks every 2s only when in range; melee does not chase", () => {
    const w = setup({ hp: 10_000 });
    const p = w.add(player("k", 13, 10));
    w.combat.onAttack(p, { targetId: w.m.s.id });
    w.run(5000);
    expect(w.sent.filter((s) => s.type === S2C.Combat).length).toBe(0);
    expect(p.x).toBe(13);
    p.x = 11;
    w.run(4000);
    const ev = w.sent.filter((s) => s.type === S2C.Combat).flatMap((s) => s.msg.events);
    expect(ev.filter((e: any) => e.sourceId === "k").length).toBe(2);
  });

  it("paladin/sorcerer/druid attack at range with ranged + kind", () => {
    for (const [voc, range, kind] of [["paladin", 6, "physical"], ["sorcerer", 4, "energy"], ["druid", 4, "ice"]] as const) {
      const w = setup({ hp: 10_000 });
      const p = w.add(player("r", 10 + range, 10, { vocation: voc }));
      w.combat.onAttack(p, { targetId: w.m.s.id });
      w.run(100);
      const ev = w.sent.filter((s) => s.type === S2C.Combat).flatMap((s) => s.msg.events);
      expect(ev[0]).toMatchObject({ sourceId: "r", kind, ranged: true });
    }
  });

  it("armor can block everything (miss with 0)", () => {
    const w = setup({ hp: 10_000, armor: 1000 });
    const p = w.add(player("k", 11, 10));
    w.combat.onAttack(p, { targetId: w.m.s.id });
    w.run(100);
    const ev = w.sent.filter((s) => s.type === S2C.Combat).flatMap((s) => s.msg.events);
    expect(ev[0]).toMatchObject({ amount: 0, miss: true });
    expect(w.m.s.hp).toBe(10_000);
  });

  it("splits xp proportionally between online damagers (min 1)", () => {
    const w = setup({ hp: 100, xp: 50 });
    const a = w.add(player("a", 11, 10));
    const b = w.add(player("b", 9, 10));
    w.m.damageBy.set("a", 60);
    w.m.damageBy.set("b", 30);
    w.m.damageBy.set("gone", 10);
    w.m.s.hp = 1;
    w.combat.onAttack(a, { targetId: w.m.s.id });
    w.run(2100);
    expect(w.mm.size).toBe(0);
    const gains = Object.fromEntries(w.sent.filter((s) => s.type === S2C.XpGain).map((s) => [s.to, s.msg.amount]));
    // a: 60+1 dano, b: 30 → 50*61/91 ≈ 34, 50*30/91 ≈ 16
    expect(gains).toEqual({ a: 34, b: 16 });
    expect(a.xp).toBe(34);
    expect(b.xp).toBe(16);
  });

  it("cannot target from or into the protection zone", () => {
    const w = setup({}, { safeZones: [{ x0: 0, y0: 0, x1: 5, y1: 29 }] });
    const p = w.add(player("k", 4, 10));
    w.combat.onAttack(p, { targetId: w.m.s.id });
    expect(p.targetId).toBe("");
    expect(w.sent.at(-1)).toMatchObject({ to: "k", type: S2C.Notice });
    w.combat.onAttack(p, { targetId: "m999" });
    expect(p.targetId).toBe("");
    p.x = 9;
    w.combat.onAttack(p, { targetId: w.m.s.id });
    expect(p.targetId).toBe(w.m.s.id);
    w.combat.onAttack(p, { targetId: null });
    expect(p.targetId).toBe("");
  });
});

describe("player death", () => {
  it("monster kills player: penalty (no level loss), teleport to spawn, full hp, Died + notice, targets cleared", () => {
    const w = setup({ aggroRange: 5, damage: [40, 40], name: "Lobo" });
    const level = 5, xp = xpForLevel(5) + 100;
    const p = w.add(player("v", 11, 10, { name: "Ana", level, xp, hp: 70, maxHp: 210, targetId: "" }));
    w.combat.onAttack(p, { targetId: w.m.s.id });
    w.run(1200);
    const lost = deathPenalty(level, xp);
    expect(lost).toBeGreaterThan(0);
    expect(p.xp).toBe(xp - lost);
    expect(p.level).toBe(5);
    expect([p.x, p.y]).toEqual([25, 25]);
    expect(p.hp).toBe(210);
    expect(p.targetId).toBe("");
    expect(w.sent.find((s) => s.type === S2C.Died)).toMatchObject({ to: "v", msg: { lostXp: lost, killerName: "Lobo" } });
    expect(w.sent.find((s) => s.type === S2C.Notice && s.to === "*")!.msg.text).toBe("Ana foi derrotado por Lobo");
    expect(w.m.s.targetId).toBe("");
  });

  it("removePlayer clears monster targets", () => {
    const w = setup({ aggroRange: 5 });
    w.add(player("v", 12, 10));
    w.run(300);
    expect(w.m.s.targetId).toBe("v");
    w.players.delete("v");
    w.combat.removePlayer("v");
    expect(w.m.s.targetId).toBe("");
  });
});

describe("regen", () => {
  it("regens out of combat every 2s, faster in PZ, not in combat", () => {
    let combat = true;
    const pz = { on: false };
    const r = new RegenSystem({ inCombat: () => combat, inPz: () => pz.on });
    const p = player("p", 0, 0, { hp: 50, mana: 10 });
    let t = 0;
    r.tick(t, [p]);
    t += REGEN_INTERVAL_MS; r.tick(t, [p]);
    expect(p.hp).toBe(50);
    combat = false;
    t += REGEN_INTERVAL_MS; r.tick(t, [p]);
    expect(p.hp).toBe(52);
    t += 100; r.tick(t, [p]);
    expect(p.hp).toBe(52);
    pz.on = true;
    t += REGEN_INTERVAL_MS; r.tick(t, [p]);
    expect(p.hp).toBe(58);
    expect(p.mana).toBeGreaterThan(10);
    for (let i = 0; i < 100; i++) { t += REGEN_INTERVAL_MS; r.tick(t, [p]); }
    expect(p.hp).toBe(150);
    expect(p.mana).toBe(50);
  });

  it("combat marks both sides as in combat for 6s", () => {
    const w = setup({ aggroRange: 5, damage: [1, 1], hp: 10_000 });
    w.add(player("v", 11, 10));
    w.run(1000);
    expect(w.combat.inCombat("v", w.now())).toBe(true);
    expect(w.combat.inCombat("other", w.now())).toBe(false);
  });
});
