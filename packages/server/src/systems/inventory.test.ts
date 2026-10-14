import { describe, expect, it } from "vitest";
import { BACKPACK_SIZE, S2C, baseStats, weaponDamageRange, playerDamageRange } from "@lemonquest/shared";
import { MSG, makeItem } from "./inventory.ts";
import { attackProfile } from "./combat.ts";
import { invWorld, itemsFx } from "./m4kit.ts";

const bp = (w: ReturnType<typeof invWorld>, id = "p1") => w.inv.get(id)!.backpack;
const eq = (w: ReturnType<typeof invWorld>, id = "p1") => w.inv.get(id)!.equipment;

describe("inventory: equip", () => {
  it("validates slot, vocation and level; equips and swaps", () => {
    const w = invWorld();
    const p = w.mk("p1", { vocation: "knight", level: 5 });
    w.inv.addItem(p, makeItem("sword"));   // 0
    w.inv.addItem(p, makeItem("plate"));   // 1 (level 20)
    w.inv.addItem(p, makeItem("bow"));     // 2 (paladin)
    w.inv.onMoveItem(p, { from: { where: "backpack", index: 0 }, to: { where: "equip", slot: "shield" } });
    expect(w.notices().at(-1)).toBe(MSG.slot);
    w.inv.onMoveItem(p, { from: { where: "backpack", index: 1 }, to: { where: "equip", slot: "armor" } });
    expect(w.notices().at(-1)).toBe("Level insuficiente.");
    w.inv.onMoveItem(p, { from: { where: "backpack", index: 2 }, to: { where: "equip", slot: "weapon" } });
    expect(w.notices().at(-1)).toBe("Sua vocação não pode usar isso.");
    w.inv.onMoveItem(p, { from: { where: "backpack", index: 0 }, to: { where: "equip", slot: "weapon" } });
    expect(eq(w).weapon?.defId).toBe("sword");
    expect(bp(w)[0]).toBeNull();
    // Troca: arma de duas mãos no lugar da espada → espada volta para o slot de origem.
    w.inv.addItem(p, makeItem("axe2h"));
    const i = bp(w).findIndex((x) => x?.defId === "axe2h");
    w.inv.onMoveItem(p, { from: { where: "backpack", index: i }, to: { where: "equip", slot: "weapon" } });
    expect(eq(w).weapon?.defId).toBe("axe2h");
    expect(bp(w)[i]?.defId).toBe("sword");
  });

  it("two-handed weapon moves the shield to the backpack, or fails when full", () => {
    const w = invWorld();
    const p = w.mk();
    w.inv.addItem(p, makeItem("shield"));
    w.inv.onMoveItem(p, { from: { where: "backpack", index: 0 }, to: { where: "equip", slot: "shield" } });
    w.inv.addItem(p, makeItem("axe2h"));
    w.inv.onMoveItem(p, { from: { where: "backpack", index: 0 }, to: { where: "equip", slot: "weapon" } });
    expect(eq(w).weapon?.defId).toBe("axe2h");
    expect(eq(w).shield).toBeUndefined();
    expect(bp(w)[0]?.defId).toBe("shield");
    // Escudo de volta: tira a arma de duas mãos (vai para o slot que o escudo liberou).
    w.inv.onMoveItem(p, { from: { where: "backpack", index: 0 }, to: { where: "equip", slot: "shield" } });
    expect(eq(w).shield?.defId).toBe("shield");
    expect(eq(w).weapon).toBeUndefined();
    expect(bp(w)[0]?.defId).toBe("axe2h");
  });

  it("two-handed weapon fails when there is no room for the shield", () => {
    const w = invWorld();
    const p = w.mk();
    w.inv.addItem(p, makeItem("sword"));
    w.inv.addItem(p, makeItem("shield"));
    w.inv.onMoveItem(p, { from: { where: "backpack", index: 0 }, to: { where: "equip", slot: "weapon" } });
    w.inv.onMoveItem(p, { from: { where: "backpack", index: 1 }, to: { where: "equip", slot: "shield" } });
    w.inv.addItem(p, makeItem("axe2h"));
    for (let k = 1; k < BACKPACK_SIZE; k++) w.inv.addItem(p, makeItem("vest"));
    expect(bp(w).every(Boolean)).toBe(true);
    // A espada volta para o slot do machado, mas o escudo não tem para onde ir.
    w.inv.onMoveItem(p, { from: { where: "backpack", index: 0 }, to: { where: "equip", slot: "weapon" } });
    expect(w.notices().at(-1)).toBe("Mochila cheia.");
    expect([eq(w).weapon?.defId, eq(w).shield?.defId, bp(w)[0]?.defId]).toEqual(["sword", "shield", "axe2h"]);
  });

  it("unequip to an occupied slot uses the first free slot; full backpack fails", () => {
    const w = invWorld();
    const p = w.mk();
    w.inv.addItem(p, makeItem("vest"));
    w.inv.onMoveItem(p, { from: { where: "backpack", index: 0 }, to: { where: "equip", slot: "armor" } });
    for (let k = 0; k < BACKPACK_SIZE; k++) w.inv.addItem(p, makeItem("bone", 1)), w.inv.addItem(p, makeItem("shield"));
    expect(bp(w).every(Boolean)).toBe(true);
    w.inv.onMoveItem(p, { from: { where: "equip", slot: "armor" }, to: { where: "backpack", index: 3 } });
    expect(w.notices().at(-1)).toBe("Mochila cheia.");
    expect(eq(w).armor?.defId).toBe("vest");
  });
});

describe("inventory: stacking", () => {
  it("merges up to maxStack, splits and swaps", () => {
    const w = invWorld();
    const p = w.mk();
    expect(w.inv.addItem(p, makeItem("mana_pot", 7))).toBe(0);
    expect(w.inv.addItem(p, makeItem("mana_pot", 7))).toBe(0);
    expect(bp(w).slice(0, 2).map((x) => x?.count)).toEqual([10, 4]);
    // Split 3 do slot 0 para o slot 5.
    w.inv.onMoveItem(p, { from: { where: "backpack", index: 0 }, to: { where: "backpack", index: 5 }, count: 3 });
    expect([bp(w)[0]?.count, bp(w)[5]?.count]).toEqual([7, 3]);
    expect(bp(w)[5]!.uid).not.toBe(bp(w)[0]!.uid);
    // Merge 5 → 1 (4 + 5 = 9).
    w.inv.onMoveItem(p, { from: { where: "backpack", index: 0 }, to: { where: "backpack", index: 1 }, count: 5 });
    expect([bp(w)[0]?.count, bp(w)[1]?.count]).toEqual([2, 9]);
    // Merge limitado pelo máximo (9 + 3 → 10, sobra 2).
    w.inv.onMoveItem(p, { from: { where: "backpack", index: 5 }, to: { where: "backpack", index: 1 } });
    expect([bp(w)[1]?.count, bp(w)[5]?.count]).toEqual([10, 2]);
    // Troca de itens diferentes.
    w.inv.addItem(p, makeItem("sword"));
    const s = bp(w).findIndex((x) => x?.defId === "sword");
    w.inv.onMoveItem(p, { from: { where: "backpack", index: s }, to: { where: "backpack", index: 0 } });
    expect(bp(w)[0]?.defId).toBe("sword");
    expect(bp(w)[s]?.defId).toBe("mana_pot");
  });

  it("gold coins become the gold counter; overflow returns leftover", () => {
    const w = invWorld();
    const p = w.mk();
    expect(w.inv.addItem(p, makeItem("gold_coin", 250))).toBe(0);
    expect(w.inv.gold("p1")).toBe(250);
    for (let k = 0; k < BACKPACK_SIZE; k++) w.inv.addItem(p, makeItem("sword"));
    expect(w.inv.addItem(p, makeItem("bone", 4))).toBe(4);
    w.inv.flush();
    const msg = w.sent.filter((s) => s.type === S2C.Inventory).at(-1)!.msg;
    expect(msg.cap).toEqual({ used: BACKPACK_SIZE, max: BACKPACK_SIZE });
    expect(msg.gold).toBe(250);
  });

  it("inventory messages are coalesced per flush", () => {
    const w = invWorld();
    const p = w.mk();
    w.inv.flush();
    const before = w.sent.length;
    w.inv.addItem(p, makeItem("bone", 1));
    w.inv.addItem(p, makeItem("bone", 1));
    w.inv.addGold(p, 3);
    w.inv.flush();
    expect(w.sent.length - before).toBe(1);
  });
});

describe("inventory: potions", () => {
  it("heals, restores mana, shares a cooldown and consumes one", () => {
    const w = invWorld();
    const p = w.mk("p1", { hp: 150, mana: 50 });
    p.hp = 10; p.mana = 0;
    w.inv.addItem(p, makeItem("hp_pot", 3));
    w.inv.addItem(p, makeItem("mana_pot", 2));
    w.inv.onUseItem(p, { index: 0 });
    expect(p.hp).toBe(60);
    expect(bp(w)[0]?.count).toBe(2);
    w.inv.onQuickPotion(p, { kind: "mana" });
    expect(w.notices().at(-1)).toBe(MSG.cooldown);
    expect(p.mana).toBe(0);
    w.advance(1000);
    w.inv.onQuickPotion(p, { kind: "mana" });
    expect(p.mana).toBe(30);
    expect(w.events.at(-1)).toMatchObject({ kind: "mana", amount: 30, sourceId: "p1", targetId: "p1" });
    expect(bp(w)[1]?.count).toBe(1);
    w.advance(1000);
    w.inv.onUseItem(p, { index: 1 });
    expect(bp(w)[1]).toBeNull();
    w.advance(1000);
    w.inv.onQuickPotion(p, { kind: "mana" });
    expect(w.notices().at(-1)).toBe(MSG.noMana);
  });

  it("discard destroys the item", () => {
    const w = invWorld();
    const p = w.mk();
    w.inv.addItem(p, makeItem("sword"));
    w.inv.onDiscard(p, { index: 0 });
    expect(bp(w)[0]).toBeNull();
  });
});

describe("inventory: depot", () => {
  it("only works while the depot is open", () => {
    let open = false;
    const w = invWorld({ depotOpen: () => open });
    const p = w.mk();
    w.inv.addItem(p, makeItem("bone", 5));
    w.inv.onMoveItem(p, { from: { where: "backpack", index: 0 }, to: { where: "depot", index: 0 } });
    expect(w.notices().at(-1)).toBe(MSG.depotClosed);
    open = true;
    w.inv.onMoveItem(p, { from: { where: "backpack", index: 0 }, to: { where: "depot", index: 0 } });
    expect(w.inv.get("p1")!.depot[0]?.count).toBe(5);
    w.inv.flush();
    expect(w.sent.some((s) => s.type === S2C.Depot && s.msg.items[0]?.defId === "bone")).toBe(true);
  });
});

describe("inventory: stats aggregation", () => {
  it("sums armor, attack, hpMax (with bonuses) and recomputes max hp", () => {
    const w = invWorld();
    const p = w.mk("p1", { vocation: "knight", level: 30 });
    const base = baseStats("knight", 30);
    expect(p.maxHp).toBe(base.maxHp);
    w.inv.addItem(p, makeItem("plate", 1, "rare", [{ stat: "hpMax", value: 25 }, { stat: "armor", value: 2 }]));
    w.inv.addItem(p, makeItem("sword", 1, "uncommon", [{ stat: "attack", value: 4 }]));
    w.inv.addItem(p, makeItem("ring"));
    w.inv.onMoveItem(p, { from: { where: "backpack", index: 0 }, to: { where: "equip", slot: "armor" } });
    w.inv.onMoveItem(p, { from: { where: "backpack", index: 1 }, to: { where: "equip", slot: "weapon" } });
    w.inv.onMoveItem(p, { from: { where: "backpack", index: 2 }, to: { where: "equip", slot: "ring" } });
    expect(w.inv.stats("p1")).toEqual({ armor: 7, hpMax: 65, attack: 24, crit: 10, magic: 2, hpRegen: 3 });
    expect(p.maxHp).toBe(base.maxHp + 65);
    p.hp = p.maxHp;
    // Tira a armadura: maxHp cai e a vida é limitada.
    w.inv.onMoveItem(p, { from: { where: "equip", slot: "armor" }, to: { where: "backpack", index: 0 } });
    expect(p.maxHp).toBe(base.maxHp);
    expect(p.hp).toBe(base.maxHp);
    // Arma: weaponDamageRange com attack total e skill + crítico do anel.
    const prof = attackProfile({ ...p, skillMelee: 20 } as typeof p, itemsFx("sword"), (s) => w.inv.stat("p1", s));
    expect(prof.damage).toEqual(weaponDamageRange(24, 20, 30));
    // Nunca abaixo do desarmado: no level 150 essa arma fraca perderia do punho — vale o desarmado com a skill efetiva.
    const weak = attackProfile({ ...p, level: 150, skillMelee: 20 } as typeof p, itemsFx("sword"), (s) => w.inv.stat("p1", s));
    const armed = weaponDamageRange(24, 20, 150), fists = playerDamageRange("knight", 150, 20 + w.inv.stat("p1", "melee"));
    expect(armed[1]).toBeLessThan(fists[0]);
    expect(weak.damage).toEqual(fists);
    expect(prof.critPct).toBeCloseTo(0.17);
    expect(prof.range).toBe(1);
    // Desarmado = fórmula da vocação.
    expect(attackProfile(p, undefined).damage).toEqual(playerDamageRange("knight", 30, undefined));
  });

  it("weapon range/damageKind override the vocation", () => {
    const p = invWorld().mk("x", { vocation: "paladin", level: 10 });
    const prof = attackProfile(p, itemsFx("bow"), (s) => (s === "attack" ? 12 : 0));
    expect([prof.range, prof.kind, prof.ranged]).toEqual([6, "physical", true]);
  });

  it("persistence roundtrip", () => {
    const w = invWorld();
    const p = w.mk();
    w.inv.addItem(p, makeItem("vest", 1, "epic", [{ stat: "hpMax", value: 9 }]));
    w.inv.addItem(p, makeItem("bone", 7));
    w.inv.onMoveItem(p, { from: { where: "backpack", index: 0 }, to: { where: "equip", slot: "armor" } });
    w.inv.addGold(p, 123);
    const saved = JSON.parse(JSON.stringify(w.inv.serialize("p1")));
    const w2 = invWorld();
    const q = w2.mk("p1");
    w2.inv.load(q, { ...saved, backpack: [...saved.backpack, { defId: "nope", count: 1 }] });
    expect(w2.inv.serialize("p1")).toEqual(w.inv.serialize("p1"));
    expect(w2.inv.stat("p1", "hpMax")).toBe(29);
  });
});
