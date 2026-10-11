import { describe, expect, it } from "vitest";
import type { ItemDef, ItemInstance } from "@tibinha/shared";
import { canEquip, compareStats, fmtStat, sellPrice, statLines, totalStats, useText } from "./itemInfo.ts";

const sword: ItemDef = { id: "s", name: "Espada", kind: "weapon", slot: "weapon", icon: { url: "x.png" }, value: 100, stats: { attack: 10 }, level: 5, vocations: ["knight"] };
const better: ItemDef = { ...sword, id: "s2", stats: { attack: 12, armor: 1 } };
const inst = (defId: string, bonuses: ItemInstance["bonuses"] = []): ItemInstance => ({ uid: defId, defId, count: 1, rarity: "rare", bonuses });

describe("itemInfo", () => {
  it("soma base e bônus", () => {
    expect(totalStats(sword, inst("s", [{ stat: "attack", value: 2 }, { stat: "crit", value: 3 }]))).toEqual({ attack: 12, crit: 3 });
    const l = statLines(sword, inst("s", [{ stat: "attack", value: 2 }]));
    expect(l[0]).toMatchObject({ stat: "attack", total: 12, base: 10, bonus: 2 });
  });
  it("compara com o equipado", () => {
    expect(compareStats(better, inst("s2"), sword, inst("s"))).toEqual([
      { stat: "attack", label: "Ataque", delta: 2 }, { stat: "armor", label: "Armadura", delta: 1 },
    ]);
  });
  it("formata percentuais", () => {
    expect(fmtStat("speed", 5)).toBe("+5%");
    expect(fmtStat("armor", -2)).toBe("−2");
  });
  it("valida equipar", () => {
    const get = (id: string) => (id === "s" ? sword : undefined);
    expect(canEquip(sword, "weapon", { level: 5, vocation: "knight" }, {}, get)).toEqual({ ok: true });
    expect(canEquip(sword, "weapon", { level: 4, vocation: "knight" }, {}, get)).toEqual({ ok: false, reason: "level" });
    expect(canEquip(sword, "weapon", { level: 9, vocation: "druid" }, {}, get)).toEqual({ ok: false, reason: "vocation" });
    expect(canEquip(sword, "shield", { level: 9, vocation: "knight" }, {}, get)).toEqual({ ok: false, reason: "slot" });
  });
  it("preço de venda", () => {
    expect(sellPrice(sword, 0.3)).toBe(30);
    expect(sellPrice({ ...sword, value: 1 }, 0.3)).toBe(1);
    expect(sellPrice(sword, 0.3, "rare")).toBe(75);
  });
});

describe("useText", () => {
  it("describes food as regen over time", () => {
    const food: ItemDef = { id: "f", name: "Bife", kind: "food", icon: { url: "x.png" }, value: 1, use: { food: { hpPerTick: 6, manaPerTick: 1, durationMs: 360_000 }, cooldownMs: 1000 } };
    expect(useText(food)).toBe("Recupera +6 vida e +1 mana a cada 2 s por 6 min");
  });
});
