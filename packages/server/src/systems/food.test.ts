import { describe, expect, it } from "vitest";
import { FOOD_MAX_MS, FOOD_TICK_MS } from "@lemonquest/shared";
import { MSG, makeItem } from "./inventory.ts";
import { invWorld } from "./m4kit.ts";

const bp = (w: ReturnType<typeof invWorld>) => w.inv.get("p1")!.backpack;

describe("food", () => {
  it("eating grants fed with remaining time, no instant heal, consumes one", () => {
    const w = invWorld();
    const p = w.mk("p1", { hp: 150 }); p.hp = 10;
    w.inv.addItem(p, makeItem("bread", 2));
    w.inv.onUseItem(p, { index: 0 });
    expect(p.hp).toBe(10);
    expect(bp(w)[0]?.count).toBe(1);
    expect(w.food.condition("p1", w.now())).toMatchObject({ id: "fed", remainingMs: 600_000, value: 1, value2: 1 });
  });

  it("duration adds, rates are the max, capped at 20 min; satisfied notice at cap without consuming", () => {
    const w = invWorld();
    const p = w.mk();
    w.inv.addItem(p, makeItem("bread", 5));
    w.inv.addItem(p, makeItem("steak", 5));
    w.inv.onUseItem(p, { index: 0 });           // bread: +1/+1, 10 min
    w.advance(1000);
    w.inv.onUseItem(p, { index: 1 });           // steak: +6/+0, 12 min → ~21.98 min → cap 20
    const c = w.food.condition("p1", w.now())!;
    expect(c.value).toBe(6);
    expect(c.value2).toBe(1);                   // max rule keeps the better mana rate
    expect(c.remainingMs).toBe(FOOD_MAX_MS);
    w.advance(1000);
    w.inv.onUseItem(p, { index: 0 });
    expect(w.notices().at(-1)).toBe(MSG.satisfied);
    expect(w.sent.filter((s) => s.type === "notice").at(-1)!.msg.kind).toBe("info");
    expect(bp(w)[0]?.count).toBe(4);            // not consumed
    w.advance(20_000);                          // below cap again → can eat
    w.inv.onUseItem(p, { index: 0 });
    expect(bp(w)[0]?.count).toBe(3);
  });

  it("ticks restore hp and mana every 2 s, only when there is something to restore", () => {
    const w = invWorld();
    const p = w.mk("p1", { hp: 150, mana: 50 }); p.hp = 100; p.mana = 50;
    w.inv.addItem(p, makeItem("steak", 1));
    w.inv.onUseItem(p, { index: 0 });
    w.advance(FOOD_TICK_MS - 1);
    w.tickFood();
    expect(p.hp).toBe(100);
    w.advance(1);
    w.tickFood();
    expect(p.hp).toBe(106);
    expect(w.events.filter((e) => e.food)).toEqual([{ kind: "heal", amount: 6, food: true }]);
  });

  it("restores both hp and mana when both are missing", () => {
    const w = invWorld();
    const p = w.mk("p1", { hp: 150, mana: 50 }); p.hp = 100; p.mana = 10;
    w.inv.addItem(p, makeItem("bread", 1));
    w.inv.onUseItem(p, { index: 0 });
    w.advance(FOOD_TICK_MS);
    w.tickFood();
    expect([p.hp, p.mana]).toEqual([101, 11]);
    expect(w.events.filter((e) => e.food).map((e) => e.kind)).toEqual(["heal", "mana"]);
  });

  it("expires after the duration", () => {
    const w = invWorld();
    const p = w.mk(); p.hp = 1;
    w.inv.addItem(p, makeItem("bread", 1));
    w.inv.onUseItem(p, { index: 0 });
    w.advance(600_000 + 1);
    w.tickFood();
    expect(w.food.condition("p1", w.now())).toBeUndefined();
  });

  it("persists remaining time and rates across logout (time does not pass offline)", () => {
    const w = invWorld();
    const p = w.mk();
    w.inv.addItem(p, makeItem("steak", 1));
    w.inv.onUseItem(p, { index: 0 });
    w.advance(60_000);
    const saved = w.food.serialize("p1", w.now())!;
    expect(saved).toEqual({ remainingMs: 660_000, hpPerTick: 6, manaPerTick: 0 });
    w.food.removePlayer("p1");
    w.advance(5 * 3_600_000);
    w.food.load("p1", { fed: JSON.parse(JSON.stringify(saved)) }, w.now());
    expect(w.food.condition("p1", w.now())).toMatchObject({ remainingMs: 660_000, value: 6, value2: 0 });
  });

  it("food cooldown is separate from potions", () => {
    const w = invWorld();
    const p = w.mk("p1", { hp: 150, mana: 50 }); p.hp = 10; p.mana = 0;
    w.inv.addItem(p, makeItem("hp_pot", 3));
    w.inv.addItem(p, makeItem("bread", 3));
    w.inv.onUseItem(p, { index: 0 });           // potion
    w.inv.onUseItem(p, { index: 1 });           // food right after: allowed
    expect(w.food.condition("p1", w.now())).toBeDefined();
    w.inv.onUseItem(p, { index: 1 });           // second food within 1 s
    expect(w.notices().at(-1)).toBe(MSG.foodCooldown);
    expect(bp(w)[1]?.count).toBe(2);
    w.inv.onQuickPotion(p, { kind: "mana" });   // quick potion is potions-only (ignores food)
    expect(w.notices().at(-1)).toBe(MSG.noMana);
  });
});
