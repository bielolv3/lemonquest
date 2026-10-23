// Consistência das famílias de magia ("tecla inteligente"): toda magia existe, é da vocação, a lista vai da mais
// forte para a mais fraca (prioridade) e nenhuma magia está em duas famílias da mesma vocação.
import { describe, expect, it } from "vitest";
import {
  FAMILY_PREFIX, SPELL_FAMILIES, castableBy, familiesFor, familyDef, familyLevel, familyOf, familySpells, isFamilyId, pickFromFamily,
} from "./spellFamilies.ts";
import { SPELLS, spellDef } from "./spells.ts";
import { VOCATIONS } from "../types.ts";

describe("SPELL_FAMILIES", () => {
  it("ids únicos no formato fam:<vocação>:<papel>, com nome e descrição; toda vocação tem ao menos uma", () => {
    expect(SPELL_FAMILIES.length).toBeGreaterThan(0);
    expect(new Set(SPELL_FAMILIES.map((f) => f.id)).size).toBe(SPELL_FAMILIES.length);
    for (const f of SPELL_FAMILIES) {
      expect(f.id, f.id).toBe(`${FAMILY_PREFIX}${f.vocation}:${f.id.split(":")[2]}`);
      expect(isFamilyId(f.id)).toBe(true);
      expect(VOCATIONS).toContain(f.vocation);
      expect(f.name.trim().length).toBeGreaterThan(0);
      expect(f.desc.trim().length).toBeGreaterThan(0);
      expect(familyDef(f.id)).toBe(f);
    }
    for (const v of VOCATIONS) expect(familiesFor(v).length, v).toBeGreaterThan(0);
    expect(familyDef("fam:knight:nada")).toBeUndefined();
    expect(isFamilyId("fireball")).toBe(false);
  });

  it("toda magia existe em SPELLS, é da vocação da família, sem repetição; a descrição cita cada uma", () => {
    for (const f of SPELL_FAMILIES) {
      expect(f.spells.length, f.id).toBeGreaterThanOrEqual(2);
      expect(new Set(f.spells).size, f.id).toBe(f.spells.length);
      for (const id of f.spells) {
        const s = spellDef(id);
        expect(s, `${f.id}: ${id}`).toBeDefined();
        expect(s!.vocations, `${f.id}: ${id}`).toContain(f.vocation);
        expect(f.desc, `${f.id} não cita ${s!.name}`).toContain(s!.name);
      }
      expect(familySpells(f).map((s) => s.id)).toEqual([...f.spells]);
    }
  });

  it("prioridade = da mais forte (level maior) para a mais fraca, sem empate", () => {
    for (const f of SPELL_FAMILIES) {
      const levels = familySpells(f).map((s) => s.level);
      for (let i = 1; i < levels.length; i++) expect(levels[i]!, `${f.id}: ${f.spells[i]}`).toBeLessThan(levels[i - 1]!);
      expect(familyLevel(f)).toBe(levels[levels.length - 1]);
    }
  });

  it("nenhuma magia em duas famílias da mesma vocação; familyOf é o inverso da lista", () => {
    for (const v of VOCATIONS) {
      const seen = new Map<string, string>();
      for (const f of familiesFor(v)) {
        for (const id of f.spells) {
          expect(seen.get(id), `${id} em ${seen.get(id)} e ${f.id}`).toBeUndefined();
          seen.set(id, f.id);
          expect(familyOf(id, v)).toBe(f);
          for (const other of VOCATIONS) if (other !== v) expect(familyOf(id, other)).toBeUndefined();
        }
      }
      // Magia da vocação fora de qualquer família (cura, buff) é avulsa.
      expect(familyOf("light_heal", v)).toBeUndefined();
    }
    expect(familyOf("nao_existe", "knight")).toBeUndefined();
  });

  it("pickFromFamily respeita level e prontidão; castableBy aceita a família só na vocação dela", () => {
    const f = familyOf("fireball", "sorcerer")!;
    const weakest = familySpells(f).at(-1)!, strongest = familySpells(f)[0]!;
    expect(pickFromFamily(f, weakest.level, () => true)).toBe(weakest);
    expect(pickFromFamily(f, 999, () => true)).toBe(strongest);
    expect(pickFromFamily(f, 999, (s) => s.id !== strongest.id)).toBe(familySpells(f)[1]);
    expect(pickFromFamily(f, 999, () => false)).toBeNull();
    expect(pickFromFamily(f, weakest.level - 1, () => true)).toBeNull();
    expect(castableBy(f.id, "sorcerer")).toBe(true);
    expect(castableBy(f.id, "druid")).toBe(false);
    expect(castableBy("fireball", "sorcerer")).toBe(true);
    expect(castableBy("fireball", "knight")).toBe(false);
    expect(castableBy("fam:sorcerer:nada", "sorcerer")).toBe(false);
    expect(Object.keys(SPELLS)).toContain("fireball");
  });
});
