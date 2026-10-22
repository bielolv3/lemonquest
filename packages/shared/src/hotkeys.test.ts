import { describe, expect, it } from "vitest";
import {
  HOTKEY_MAX, SPELL_FAMILIES, SUGGESTED_KEYS, defaultHotkeys, familiesFor, familyDef, familyOf, familySpells, hotkeysFromOrder,
  isHotkeyKey, keyLabel, pickFromFamily, reservedFor, sanitizeHotkeys, spellDef, spellsFor,
} from "./index.ts";

describe("atalhos de magia", () => {
  it("teclas: aceita números, letras livres, F2–F4/F10, símbolos e Shift; recusa as do jogo e lixo", () => {
    for (const k of ["Digit1", "Digit0", "KeyF", "KeyZ", "F2", "F10", "Minus", "Shift+Digit3", "Shift+KeyF", "Space"]) expect(isHotkeyKey(k), k).toBe(true);
    for (const k of ["F11", "F12", "KeyQ", "Shift+KeyQ", "KeyW", "ArrowUp", "Numpad7", "Enter", "Escape", "F1", "F5", "F9", "KeyH", "KeyM", "Ctrl+Digit1", "Shift+Shift+Digit1", "", 3, null]) {
      expect(isHotkeyKey(k), String(k)).toBe(false);
    }
    expect(reservedFor("KeyQ")).toBe("Poção de vida");
    expect(reservedFor("Shift+KeyE")).toBe("Poção de mana");
    expect(reservedFor("Numpad3")).toMatch(/Andar/);
    expect(reservedFor("KeyF")).toBeNull();
    expect(reservedFor("Shift+Slash")).toMatch(/Ajuda/); // "?" abre a ajuda
    expect(reservedFor("Shift+IntlRo")).toMatch(/Ajuda/);
    expect(reservedFor("Slash")).toBeNull();
  });

  it("rótulos curtos, com o layout real quando o navegador informa", () => {
    expect(keyLabel("Digit1")).toBe("1");
    expect(keyLabel("Shift+KeyF")).toBe("⇧F");
    expect(keyLabel("F10")).toBe("F10");
    expect(keyLabel("Minus")).toBe("-");
    expect(keyLabel("Semicolon", new Map([["Semicolon", "ç"]]))).toBe("Ç");
  });

  it("sanitize: lixo, tecla reservada ou repetida, magia de outra vocação e excesso saem", () => {
    expect(sanitizeHotkeys("x", "sorcerer")).toEqual([]);
    expect(sanitizeHotkeys([
      { key: "Digit1", spellId: "fireball" },
      { key: "Digit1", spellId: "energy_wave" },    // tecla repetida
      { key: "KeyQ", spellId: "energy_wave" },      // tecla do jogo
      { key: "Digit2", spellId: "ice_shard" },      // magia do druida
      { key: "Digit3", spellId: "nao_existe" },
      null, 7, { key: "Digit4" },
      { key: "Shift+Digit1", spellId: "inferno" },  // level ainda não alcançado: pode
      { key: "Digit5", spellId: "fireball" },       // magia repetida
    ], "sorcerer")).toEqual([{ key: "Digit1", spellId: "fireball" }, { key: "Shift+Digit1", spellId: "inferno" }]);
    const many = Array.from({ length: 30 }, (_, i) => ({ key: `Shift+Key${"ABCDFGNPTUVXYZ"[i % 14]}${i >= 14 ? "x" : ""}`, spellId: "fireball" }));
    expect(sanitizeHotkeys(many, "sorcerer").length).toBeLessThanOrEqual(HOTKEY_MAX);
  });

  it("padrão (recomendado): cada magia da vocação uma vez — direto ou pela família —, em ordem de level, nas teclas 1–0", () => {
    const sizes: Record<string, number> = {};
    for (const v of ["knight", "paladin", "sorcerer", "druid"] as const) {
      const d = defaultHotkeys(v);
      const covered = d.flatMap((h) => familyDef(h.spellId)?.spells ?? [h.spellId]);
      expect([...covered].sort(), v).toEqual(spellsFor(v).map((s) => s.id).sort());
      expect(d.map((h) => h.key), v).toEqual(SUGGESTED_KEYS.slice(0, d.length));
      expect(sanitizeHotkeys(d, v), v).toEqual(d);
      sizes[v] = d.length;
    }
    // A barra encolhe: menos teclas que magias em todas as vocações, e cabe no 1–0.
    expect(sizes).toEqual({ knight: 8, paladin: 5, sorcerer: 7, druid: 9 });
    expect(SUGGESTED_KEYS.slice(10, 12)).toEqual(["KeyC", "KeyF"]); // A, B, D, E são do jogo
  });

  it("migração da barra antiga: mesmas magias nas mesmas teclas; as que faltam nas teclas livres", () => {
    const order = ["energy_wave", null, "fireball", "ice_shard", "lixo"];
    const h = hotkeysFromOrder(order, "sorcerer");
    expect(h[0]).toEqual({ key: "Digit1", spellId: "energy_wave" });
    expect(h.find((x) => x.spellId === "fireball")?.key).toBe("Digit3");
    expect(h.some((x) => x.spellId === "ice_shard")).toBe(false);
    expect(h.find((x) => x.key === "Digit2")).toBeDefined(); // tecla vaga recebe magia que faltava
    expect(new Set(h.map((x) => x.spellId)).size).toBe(h.length);
    expect(hotkeysFromOrder(null, "knight")).toEqual(defaultHotkeys("knight"));
  });

  it("famílias: magias de dano da própria vocação, cada uma em uma família só, da mais forte (level maior) para a mais fraca", () => {
    const seen = new Set<string>();
    for (const f of SPELL_FAMILIES) {
      const spells = familySpells(f);
      expect(spells.length, f.id).toBe(f.spells.length);
      expect(spells.length, f.id).toBeGreaterThanOrEqual(2);
      for (const s of spells) {
        expect(s.vocations, s.id).toContain(f.vocation);
        expect(s.damage, s.id).toBeDefined();
        expect(seen.has(s.id), s.id).toBe(false);
        seen.add(s.id);
        expect(familyOf(s.id, f.vocation)).toBe(f);
      }
      const levels = spells.map((s) => s.level);
      expect(levels, f.id).toEqual([...levels].sort((a, b) => b - a));
    }
  });

  it("família no atalho: aceita a da vocação, recusa a de outra e não repete", () => {
    const [mine] = familiesFor("sorcerer"), [other] = familiesFor("druid");
    const out = sanitizeHotkeys([
      { key: "Digit1", spellId: mine!.id }, { key: "Digit2", spellId: other!.id }, { key: "Digit3", spellId: mine!.id },
      { key: "Digit4", spellId: "fam:sorcerer:nada" },
    ], "sorcerer");
    expect(out).toEqual([{ key: "Digit1", spellId: mine!.id }]);
  });

  it("família escolhe a mais forte liberada que estiver pronta", () => {
    const f = familyDef("fam:sorcerer:target")!;
    expect(pickFromFamily(f, 1, () => true)?.id).toBe("fireball");
    expect(pickFromFamily(f, 60, () => true)?.id).toBe("sudden_death");
    expect(pickFromFamily(f, 60, (s) => s.id !== "sudden_death")?.id).toBe("energy_beam");
    expect(pickFromFamily(f, 60, () => false)).toBeNull();
    expect(spellDef("sudden_death")!.level).toBeLessThanOrEqual(60);
  });
});
