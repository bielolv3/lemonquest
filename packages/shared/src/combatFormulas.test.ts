import { describe, expect, it } from "vitest";
import {
  VOCATIONS, baseStats, blessingPrice, deathPenalty, levelForXp, mitigate, playerAttackDamage, playerDamageRange, regenAmount, rollInt, splitXp,
  xpForLevel, XP_STAGES, applyXpStage, xpStage, shieldArmorBonus, keptBySellAll, RARITIES,
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

  it("blessing price scales linearly with level", () => {
    expect(blessingPrice(1)).toBe(200);
    expect(blessingPrice(80)).toBe(16000);
    expect(blessingPrice(0)).toBe(200); // nunca menos que o level 1
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

describe("armadura da skill Escudo", () => {
  it("+1 a cada 4 níveis acima de 10; nunca negativa", () => {
    expect(shieldArmorBonus(10)).toBe(0);
    expect(shieldArmorBonus(13)).toBe(0);
    expect(shieldArmorBonus(14)).toBe(1);
    expect(shieldArmorBonus(30)).toBe(5);
    expect(shieldArmorBonus(50)).toBe(10);
    expect(shieldArmorBonus(5)).toBe(0);
    expect(shieldArmorBonus(Number.NaN)).toBe(0);
  });
});

describe("estágios de XP", () => {
  it("faixas em ordem, começando no level 1 com XP cheia e sempre caindo", () => {
    expect(XP_STAGES[0]).toEqual({ fromLevel: 1, mult: 1 });
    for (let i = 1; i < XP_STAGES.length; i++) {
      expect(XP_STAGES[i]!.fromLevel).toBeGreaterThan(XP_STAGES[i - 1]!.fromLevel);
      expect(XP_STAGES[i]!.mult).toBeLessThan(XP_STAGES[i - 1]!.mult);
    }
  });

  it("xpStage e applyXpStage", () => {
    expect(xpStage(1).mult).toBe(1);
    expect(xpStage(39).mult).toBe(1);
    expect(xpStage(40).mult).toBe(0.5);
    expect(xpStage(60).mult).toBe(0.3);
    expect(xpStage(80).mult).toBe(0.2);
    expect(xpStage(150).mult).toBe(0.12);
    expect(applyXpStage(1000, 30)).toBe(1000);
    expect(applyXpStage(1000, 85)).toBe(200);
    expect(applyXpStage(1, 120)).toBe(1); // nunca zera um abate
    expect(applyXpStage(0, 120)).toBe(0);
  });
});

describe("vender tudo (NPC)", () => {
  it("deixa na mochila raro ou melhor; comum e incomum vendem", () => {
    expect(RARITIES.filter((r) => keptBySellAll(r))).toEqual(["rare", "epic", "legendary"]);
  });
});
