import { describe, expect, it } from "vitest";
import { SPELLS, spellsFor, spellByWords, type ConditionId, type SpellDef, type SpellFormula } from "./spells.ts";
import { MONSTERS } from "./monsters.ts";
import { baseStats, playerDamageRange } from "../formulas.ts";
import type { Vocation } from "../types.ts";

const VOCS: Vocation[] = ["knight", "paladin", "sorcerer", "druid"];
const LEVELS = [1, 5, 10, 15, 20, 30];
const CONDITIONS: ConditionId[] = [
  "combat", "poison", "burn", "energy", "bleed", "freeze", "protect", "haste", "slow", "drunk", "regen", "pz",
  "manashield", "rooted", "taunted",
];

/** Estimativa de magic level por vocação/level (magos ~22 no lvl 30, cavaleiros ~4). */
function mlEstimate(voc: Vocation, level: number): number {
  switch (voc) {
    case "sorcerer": case "druid": return Math.floor(level * 0.75);
    case "paladin": return Math.floor(level / 4);
    default: return Math.floor(level / 7);
  }
}

const avg = (f: SpellFormula, voc: Vocation, level: number) => f.base + level * f.perLevel + mlEstimate(voc, level) * f.perMagic;
const value = (s: SpellDef, level = s.level) => {
  const f = s.damage ?? s.heal;
  return f ? avg(f, s.vocation, level) : 0;
};
const autoAvg = (voc: Vocation, level: number) => {
  const [a, b] = playerDamageRange(voc, level);
  return (a + b) / 2;
};

describe("SPELLS", () => {
  it("6 magias por vocação, levels 1/5/10/15/20/30", () => {
    for (const v of VOCS) {
      const list = spellsFor(v);
      expect(list.length, v).toBe(6);
      expect(list.map((s) => s.level), v).toEqual(LEVELS);
    }
    expect(Object.keys(SPELLS).length).toBe(24);
  });

  it("ids batem com a chave, palavras únicas e minúsculas", () => {
    const words = new Set<string>();
    for (const [key, s] of Object.entries(SPELLS)) {
      expect(s.id).toBe(key);
      expect(s.words).toBe(s.words.trim().toLowerCase().replace(/\s+/g, " "));
      expect(words.has(s.words), `palavras duplicadas: ${s.words}`).toBe(false);
      words.add(s.words);
      expect(spellByWords(s.words)).toBe(s);
    }
  });

  it("campos exigidos por tipo de alvo e dados válidos", () => {
    for (const s of Object.values(SPELLS)) {
      const tag = s.id;
      if (s.target === "target" || s.target === "area_target") expect(s.range, tag).toBeGreaterThan(0);
      if (s.target === "area_self" || s.target === "area_target" || s.target === "party") expect(s.radius, tag).toBeGreaterThan(0);
      if (s.target === "wave") { expect(s.length, tag).toBeGreaterThan(0); expect(s.width, tag).toBeGreaterThan(0); }
      if (s.summon) {
        expect(MONSTERS[s.summon.monsterId], tag).toBeDefined();
        expect(s.summon.count).toBeGreaterThan(0);
        expect(s.summon.durationMs).toBeGreaterThan(0);
      }
      if (s.condition) {
        expect(CONDITIONS, tag).toContain(s.condition.id);
        expect(s.condition.durationMs).toBeGreaterThan(0);
      }
      if (s.dash) expect(s.target).toBe("target");
      if (s.taunt) expect(s.target).toBe("area_self");
      expect(s.mana, tag).toBeGreaterThan(0);
      expect(s.cooldownMs, tag).toBeGreaterThanOrEqual(1000);
      expect(s.name.length, tag).toBeGreaterThan(0);
      expect(s.description.trim().length, tag).toBeGreaterThan(0);
      expect(Boolean(s.damage || s.heal || s.condition || s.summon || s.taunt), tag).toBe(true);
    }
  });

  it("summoned_wolf é um aliado válido", () => {
    const w = MONSTERS.summoned_wolf;
    expect(w.name).toBe("Lobo Espiritual");
    expect(w.aggroRange).toBe(0);
    expect(w.xp).toBe(0);
    expect(w.respawnMs).toBe(0);
  });

  it("tabela de balanceamento (valor esperado no level de desbloqueio)", () => {
    const rows = Object.values(SPELLS)
      .sort((a, b) => VOCS.indexOf(a.vocation) - VOCS.indexOf(b.vocation) || a.level - b.level)
      .map((s) => {
        const { maxHp, maxMana } = baseStats(s.vocation, s.level);
        return {
          voc: s.vocation, lvl: s.level, spell: s.name, words: s.words, ML: mlEstimate(s.vocation, s.level),
          mana: s.mana, "mana%": Math.round((s.mana / maxMana) * 100), cd: s.cooldownMs / 1000,
          dmg: s.damage ? Math.round(avg(s.damage, s.vocation, s.level)) : "",
          heal: s.heal ? Math.round(avg(s.heal, s.vocation, s.level)) : "",
          "heal%hp": s.heal ? Math.round((avg(s.heal, s.vocation, s.level) / maxHp) * 100) : "",
          "x auto": s.damage ? +(avg(s.damage, s.vocation, s.level) / autoAvg(s.vocation, s.level)).toFixed(1) : "",
        };
      });
    console.table(rows);
    expect(rows.length).toBe(24);
  });

  describe("metas de balanceamento", () => {
    it("magia de ataque do level 1 vale 2-3x o auto-ataque, mana 10-20% de 50", () => {
      for (const [v, id] of [["sorcerer", "fireball"], ["paladin", "piercing_arrow"], ["knight", "spin_strike"]] as const) {
        const s = SPELLS[id];
        expect(s.vocation).toBe(v);
        const ratio = value(s) / autoAvg(v, 1);
        expect(ratio, id).toBeGreaterThanOrEqual(2);
        expect(ratio, id).toBeLessThanOrEqual(3);
        expect(s.mana / 50, id).toBeGreaterThanOrEqual(0.1);
        expect(s.mana / 50, id).toBeLessThanOrEqual(0.2);
        expect(s.cooldownMs, id).toBeLessThanOrEqual(4000);
      }
      expect(SPELLS.fireball.cooldownMs).toBe(2000);
      expect(SPELLS.piercing_arrow.cooldownMs).toBe(2000);
    });

    it("cura leve ~15-20% da vida máxima no level de desbloqueio", () => {
      for (const id of ["light_heal", "paladin_heal", "wound_care"]) {
        const s = SPELLS[id];
        const pct = value(s) / baseStats(s.vocation, s.level).maxHp;
        expect(pct, id).toBeGreaterThanOrEqual(0.13);
        expect(pct, id).toBeLessThanOrEqual(0.22);
      }
    });

    it("cura em grupo cura menos por alvo que a cura leve do mesmo level", () => {
      expect(value(SPELLS.group_heal)).toBeLessThan(value(SPELLS.light_heal, SPELLS.group_heal.level));
    });

    it("AoE de mago nos levels 15-20 mata um bando (~175 HP) em 3-4 casts", () => {
      const packHp = 175; // aranha 180 / morcego 170
      for (const [id, lvl] of [["fire_burst", 15], ["fire_burst", 20], ["ice_rain", 15], ["ice_rain", 20]] as const) {
        const casts = Math.ceil(packHp / value(SPELLS[id], lvl));
        expect(casts, `${id}@${lvl}`).toBeGreaterThanOrEqual(3);
        expect(casts, `${id}@${lvl}`).toBeLessThanOrEqual(4);
      }
    });

    it("AoE de mago no level 30 supera a do paladino; Golpe Giratório não substitui o auto-ataque", () => {
      expect(value(SPELLS.inferno)).toBeGreaterThan(value(SPELLS.holy_wave));
      expect(value(SPELLS.blizzard)).toBeGreaterThan(value(SPELLS.holy_wave));
      expect(value(SPELLS.spin_strike, 20)).toBeLessThan(autoAvg("knight", 20) * 1.6);
    });

    it("mana limita os magos, mas nenhuma magia custa mais de 35% da mana máxima", () => {
      for (const s of Object.values(SPELLS)) {
        expect(s.mana / baseStats(s.vocation, s.level).maxMana, s.id).toBeLessThanOrEqual(0.35);
      }
      // Só AoE no level 20: gasto por segundo é da ordem do regen (2% + 0.5*lvl por 2 s), não muito menor nem maior.
      const { maxMana } = baseStats("sorcerer", 20);
      const regenPerSec = (maxMana * 0.02 + 20 * 0.5) / 2;
      const burnPerSec = SPELLS.fire_burst.mana / (SPELLS.fire_burst.cooldownMs / 1000);
      expect(burnPerSec).toBeGreaterThan(regenPerSec * 0.5);
      expect(burnPerSec).toBeLessThan(regenPerSec * 2.5);
    });

    it("cooldowns por categoria: AoE 4-8 s, buffs/utilidade >= 15 s, invocação >= 60 s", () => {
      for (const s of Object.values(SPELLS)) {
        if (s.summon) expect(s.cooldownMs, s.id).toBeGreaterThanOrEqual(60_000);
        else if (s.condition && !s.damage) expect(s.cooldownMs, s.id).toBeGreaterThanOrEqual(15_000);
        else if (s.target === "area_self" || s.target === "area_target" || s.target === "wave") {
          expect(s.cooldownMs, s.id).toBeGreaterThanOrEqual(4000);
          expect(s.cooldownMs, s.id).toBeLessThanOrEqual(8000);
        }
      }
    });
  });
});
