import { describe, expect, it } from "vitest";
import { SPELLS, spellsFor, spellByWords, spellMana, type ConditionId, type SpellDef, type SpellFormula } from "./spells.ts";
import { MONSTERS } from "./monsters.ts";
import { baseStats, playerDamageRange, weaponDamageRange } from "../formulas.ts";
import { ITEMS } from "./items.ts";
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
/** Valor esperado da magia para uma vocação (padrão: a primeira que a conjura). */
const value = (s: SpellDef, level = s.level, voc: Vocation = s.vocations[0]!) => {
  const f = s.damage ?? s.heal;
  return f ? avg(f, voc, level) : 0;
};
/** Auto-ataque médio de quem usa a melhor arma da vocação liberada no level (o punho fica bem abaixo de propósito). */
const autoAvg = (voc: Vocation, level: number) => {
  const magic = voc === "sorcerer" || voc === "druid";
  let best = playerDamageRange(voc, level);
  for (const it of Object.values(ITEMS)) {
    if (it.kind !== "weapon" || !it.vocations?.includes(voc) || (it.level ?? 1) > level) continue;
    const r = weaponDamageRange(it.stats?.attack ?? 0, magic ? 0 : 10, level, magic);
    if (r[0] + r[1] > best[0] + best[1]) best = r;
  }
  return (best[0] + best[1]) / 2;
};
const healPct = (id: string, voc: Vocation, level: number) => value(SPELLS[id]!, level, voc) / baseStats(voc, level).maxHp;
const HEALS = ["light_heal"];

describe("SPELLS", () => {
  it("cada vocação tem 6-8 magias (cabem na barra de 8), com UMA cura própria", () => {
    for (const v of VOCS) {
      const list = spellsFor(v);
      expect(list.length, v).toBeGreaterThanOrEqual(6);
      expect(list.length, v).toBeLessThanOrEqual(8);
      expect(list.map((s) => s.level), v).toEqual([...list.map((s) => s.level)].sort((a, b) => a - b));
      expect(list.some((s) => s.id === "light_heal"), v).toBe(true);
      // exatamente uma cura em si mesmo (alvo "self" com heal); a cura em grupo do druida é outra coisa
      expect(list.filter((s) => s.target === "self" && s.heal).map((s) => s.id), v).toEqual(["light_heal"]);
      expect(list.every((s) => s.vocations.includes(v))).toBe(true);
    }
    expect(Object.keys(SPELLS).length).toBe(23);
  });

  it("cura única: exura (lv1) para todas as vocações; sem exura gran/vita; druida mantém exura mas sio", () => {
    expect(spellByWords("exura")).toMatchObject({ id: "light_heal", name: "Cura", level: 1, vocations: VOCS });
    expect(spellByWords("exura gran")).toBeUndefined();
    expect(spellByWords("exura vita")).toBeUndefined();
    expect(SPELLS.great_heal).toBeUndefined();
    expect(SPELLS.vital_heal).toBeUndefined();
    expect(spellByWords("exura mas sio")).toMatchObject({ id: "group_heal", vocations: ["druid"], target: "party" });
    expect(spellsFor("knight").map((s) => s.words)).not.toContain("exura mas sio");
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
    const rows = VOCS.flatMap((v) => spellsFor(v).map((s) => ({ s, v })))
      .map(({ s, v }) => {
        const { maxHp, maxMana } = baseStats(v, s.level);
        return {
          voc: v, lvl: s.level, spell: s.name, words: s.words, ML: mlEstimate(v, s.level),
          mana: s.mana, "mana%": Math.round((s.mana / maxMana) * 100), cd: s.cooldownMs / 1000,
          dmg: s.damage ? Math.round(avg(s.damage, v, s.level)) : "",
          heal: s.heal ? Math.round(avg(s.heal, v, s.level)) : "",
          "heal%hp": s.heal ? Math.round((avg(s.heal, v, s.level) / maxHp) * 100) : "",
          "x auto": s.damage ? +(avg(s.damage, v, s.level) / autoAvg(v, s.level)).toFixed(1) : "",
        };
      });
    console.table(rows);
    expect(rows.length).toBe(VOCS.flatMap((v) => spellsFor(v)).length);
  });

  describe("metas de balanceamento", () => {
    // Base = auto-ataque com a arma inicial (o personagem novo já começa com ela): a Bola de Fogo fica em ~1,8×.
    it("magia de ataque do level 1 vale 1,5-3x o auto-ataque, mana 10-20% de 50", () => {
      for (const [v, id] of [["sorcerer", "fireball"], ["druid", "ice_shard"], ["paladin", "piercing_arrow"], ["knight", "spin_strike"]] as const) {
        const s = SPELLS[id];
        expect(s.vocations).toEqual([v]);
        const ratio = value(s) / autoAvg(v, 1);
        expect(ratio, id).toBeGreaterThanOrEqual(1.5);
        expect(ratio, id).toBeLessThanOrEqual(3);
        expect(s.mana / 50, id).toBeGreaterThanOrEqual(0.1);
        expect(s.mana / 50, id).toBeLessThanOrEqual(0.2);
        expect(s.cooldownMs, id).toBeLessThanOrEqual(4000);
      }
      expect(SPELLS.fireball.cooldownMs).toBe(2000);
      expect(SPELLS.piercing_arrow.cooldownMs).toBe(2000);
    });

    it("Cura (exura): ~15% da vida no level 1; mago 25-30% (lv20) e 30-35% (lv30); cav/pal 15-22%", () => {
      for (const v of VOCS) {
        expect(healPct("light_heal", v, 1), v).toBeGreaterThanOrEqual(0.15);
        expect(healPct("light_heal", v, 1), v).toBeLessThanOrEqual(0.20);
      }
      const MAGE: Record<number, [number, number]> = { 20: [0.25, 0.30], 30: [0.30, 0.35] };
      for (const lvl of [20, 30]) {
        for (const v of ["sorcerer", "druid"] as const) {
          expect(healPct("light_heal", v, lvl), `${v}@${lvl}`).toBeGreaterThanOrEqual(MAGE[lvl][0]);
          expect(healPct("light_heal", v, lvl), `${v}@${lvl}`).toBeLessThanOrEqual(MAGE[lvl][1]);
        }
        for (const v of ["knight", "paladin"] as const) {
          expect(healPct("light_heal", v, lvl), `${v}@${lvl}`).toBeGreaterThanOrEqual(0.15);
          expect(healPct("light_heal", v, lvl), `${v}@${lvl}`).toBeLessThanOrEqual(0.22);
        }
      }
      expect(healPct("light_heal", "druid", 20)).toBeGreaterThan(healPct("light_heal", "knight", 20));
    });

    it("custo de mana da Cura cresce com o level (20 + 1.5/level) e tem teto", () => {
      const s = SPELLS.light_heal!;
      expect(spellMana(s, 1)).toBe(22);
      expect(spellMana(s, 10)).toBe(35);
      expect(spellMana(s, 20)).toBe(50);
      expect(spellMana(s, 30)).toBe(65);
      expect(spellMana(s, 100)).toBe(70);
      expect(spellMana(SPELLS.fireball!, 30)).toBe(SPELLS.fireball!.mana); // sem manaPerLevel: fixo
      expect(s.cooldownMs).toBe(1000);
    });

    it("curas custam mais mana por PV que ataques de nível 1 e respeitam cooldown >= 1 s", () => {
      for (const id of HEALS) expect(SPELLS[id]!.cooldownMs).toBeGreaterThanOrEqual(1000);
    });

    it("cura em grupo cura menos por alvo que a cura leve do mesmo level", () => {
      expect(value(SPELLS.group_heal)).toBeLessThan(value(SPELLS.light_heal, SPELLS.group_heal.level, "druid"));
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
      for (const v of VOCS) for (const s of spellsFor(v)) {
        // Curas são caras de propósito (mana cresce com o level): quem tem pouca mana dá poucos casts (mana potions!).
        if (HEALS.includes(s.id)) continue;
        expect(s.mana / baseStats(v, s.level).maxMana, `${s.id}/${v}`).toBeLessThanOrEqual(0.35);
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
