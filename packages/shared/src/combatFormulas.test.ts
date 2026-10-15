import { describe, expect, it } from "vitest";
import {
  VOCATIONS, baseStats, deathPenalty, levelForXp, mitigate, playerAttackDamage, playerDamageRange, regenAmount, rollInt, splitXp,
  xpForLevel,
} from "./index.ts";

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("combat formulas", () => {
  it("damage range scales with vocation and level (knight > paladin > mages)", () => {
    expect(playerDamageRange("knight", 1)).toEqual([5, 9]);
    const at = (lvl: number) => VOCATIONS.map((v) => playerDamageRange(v, lvl)[1]);
    const [k, p, s, d] = at(20);
    expect(k).toBeGreaterThan(p);
    expect(p).toBeGreaterThan(s);
    expect(s).toBe(d);
    expect(playerDamageRange("knight", 20)[1]).toBeGreaterThan(playerDamageRange("knight", 5)[1]);
  });

  it("rolls stay inside [min, max*1.5], with ~5% misses and crits only for knight/paladin", () => {
    const rng = seeded(1);
    for (const v of VOCATIONS) {
      const [min, max] = playerDamageRange(v, 10);
      let miss = 0, crit = 0;
      const bad: string[] = [];
      const N = 20_000;
      // Conta as violações e confere uma vez no fim: 160 mil expect() no laço passavam do tempo limite com a CPU ocupada.
      for (let i = 0; i < N; i++) {
        const r = playerAttackDamage(v, 10, rng);
        if (r.miss) { miss++; if (r.amount !== 0) bad.push(`errou com ${r.amount}`); continue; }
        if (r.crit) crit++;
        const hi = r.crit ? Math.round(max * 1.5) : max;
        if (r.amount < min || r.amount > hi) bad.push(`${r.amount} fora de [${min}, ${hi}]`);
      }
      expect(bad.slice(0, 5), v).toEqual([]);
      expect(miss / N).toBeGreaterThan(0.035);
      expect(miss / N).toBeLessThan(0.065);
      if (v === "knight" || v === "paladin") expect(crit / N).toBeGreaterThan(0.05);
      else expect(crit).toBe(0);
    }
  });

  it("rollInt is inclusive and never exceeds max even with rng≈1", () => {
    expect(rollInt(3, 7, () => 0)).toBe(3);
    expect(rollInt(3, 7, () => 0.999999999)).toBe(7);
  });

  it("armor mitigation never goes negative", () => {
    expect(mitigate(10, 3)).toBe(7);
    expect(mitigate(2, 5)).toBe(0);
    expect(mitigate(5, -2)).toBe(5);
  });

  it("death penalty is 10% of the level span and never drops a level", () => {
    const span = xpForLevel(6) - xpForLevel(5);
    expect(deathPenalty(5, xpForLevel(5) + span - 1)).toBe(Math.round(span * 0.1));
    expect(deathPenalty(5, xpForLevel(5) + 3)).toBe(3);
    expect(deathPenalty(5, xpForLevel(5))).toBe(0);
    for (let lvl = 1; lvl < 60; lvl++) {
      for (const xp of [xpForLevel(lvl), xpForLevel(lvl) + 1, xpForLevel(lvl + 1) - 1]) {
        expect(levelForXp(xp - deathPenalty(lvl, xp))).toBe(lvl);
      }
    }
  });

  it("levelForXp inverts xpForLevel (multi-level jumps)", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(xpForLevel(2) - 1)).toBe(1);
    expect(levelForXp(xpForLevel(7))).toBe(7);
  });

  it("xp split is proportional, rounded, min 1 per damager", () => {
    const s = splitXp(100, [["a", 75], ["b", 25]]);
    expect(s.get("a")).toBe(75);
    expect(s.get("b")).toBe(25);
    const t = splitXp(6, [["a", 999], ["b", 1]]);
    expect(t.get("a")).toBe(6);
    expect(t.get("b")).toBe(1);
    expect(splitXp(10, [["a", 0]]).size).toBe(0);
  });

  it("regen is at least 1 and 3x in PZ", () => {
    expect(regenAmount(150, 1, false)).toBe(2);
    expect(regenAmount(150, 1, true)).toBe(6);
    expect(regenAmount(10, 1, false)).toBeGreaterThanOrEqual(1);
  });
});

describe("baseStats", () => {
  it("magos ganham 6 de vida por level (lv 30: 324), ainda bem abaixo do paladino e do cavaleiro", () => {
    expect(baseStats("sorcerer", 1).maxHp).toBe(150);
    expect(baseStats("sorcerer", 30).maxHp).toBe(324);
    expect(baseStats("druid", 30).maxHp).toBe(324);
    expect(baseStats("paladin", 30).maxHp).toBeGreaterThan(baseStats("druid", 30).maxHp);
    expect(baseStats("knight", 30).maxHp).toBeGreaterThan(baseStats("paladin", 30).maxHp);
  });
});
