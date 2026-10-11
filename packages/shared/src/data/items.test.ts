/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GEAR_SHAPES, GEAR_TIERS, ITEMS, gearFrame, isEquipable, type ItemDef } from "./items.ts";
import { MONSTERS } from "./monsters.ts";
import { playerDamageRange } from "../formulas.ts";
import { VOCATIONS, type Vocation } from "../types.ts";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const gear = JSON.parse(readFileSync(root + "assets/icons/gear.json", "utf8")) as { count: number; frames: Record<string, number> };
const all = Object.values(ITEMS);
const weapons = all.filter((d) => d.kind === "weapon");

describe("ITEMS", () => {
  it("ids batem com as chaves", () => {
    for (const [k, d] of Object.entries(ITEMS)) expect(d.id).toBe(k);
    expect(all.length).toBeGreaterThanOrEqual(60);
  });

  it("frames do atlas de equipamento batem com gear.json", () => {
    for (const s of GEAR_SHAPES) for (const t of GEAR_TIERS) expect(gearFrame(s, t), `${s}_${t}`).toBe(gear.frames[`${s}_${t}`]);
    for (const t of GEAR_TIERS) {
      expect(gearFrame("ring", t)).toBe(gear.frames[`ring_${t}`]);
      expect(gearFrame("amulet", t)).toBe(gear.frames[`amulet_${t}`]);
    }
  });

  it("ícones existem em disco e frames estão dentro do atlas", () => {
    for (const d of all) {
      expect(existsSync(root + "assets/" + d.icon.url), `${d.id}: ${d.icon.url}`).toBe(true);
      if (d.icon.frame !== undefined) {
        expect(d.icon.url).toBe("icons/gear.png");
        expect(d.icon.frame, d.id).toBeGreaterThanOrEqual(0);
        expect(d.icon.frame, d.id).toBeLessThan(gear.count);
        expect(d.icon.frameWidth).toBe(16);
        expect(d.icon.frameHeight).toBe(16);
      }
    }
  });

  it("equipáveis têm slot compatível com o kind", () => {
    const slotKinds = new Set(["weapon", "shield", "helmet", "armor", "legs", "boots", "ring", "amulet"]);
    for (const d of all) {
      if (slotKinds.has(d.kind)) { expect(d.slot, d.id).toBe(d.kind); expect(isEquipable(d)).toBe(true); expect(d.stats, d.id).toBeDefined(); }
      else expect(d.slot, d.id).toBeUndefined();
    }
  });

  it("armas têm range, damageKind, weaponType e attack", () => {
    for (const d of weapons) {
      expect(d.range, d.id).toBeGreaterThanOrEqual(1);
      expect(d.damageKind, d.id).toBeDefined();
      expect(d.weaponType, d.id).toBeDefined();
      expect(d.stats?.attack, d.id).toBeGreaterThan(0);
      expect(d.vocations?.length, d.id).toBe(1);
    }
    for (const d of weapons.filter((w) => w.weaponType === "bow")) { expect(d.range).toBe(6); expect(d.damageKind).toBe("physical"); }
    for (const d of weapons.filter((w) => w.weaponType === "wand" || w.weaponType === "rod")) expect(d.range).toBe(4);
    for (const d of weapons.filter((w) => w.weaponType === "sword" || w.weaponType === "axe" || w.weaponType === "club")) expect(d.range).toBe(1);
  });

  it("empilháveis têm maxStack sensato; poções têm uso", () => {
    for (const d of all) {
      if (d.stackable) expect(d.maxStack ?? 100, d.id).toBeGreaterThanOrEqual(1);
      else expect(d.maxStack, d.id).toBeUndefined();
      if (d.kind === "potion") { expect(d.stackable).toBe(true); expect(d.use?.heal || d.use?.mana, d.id).toBeTruthy(); }
      if (!d.stackable) expect(["weapon", "shield", "helmet", "armor", "legs", "boots", "ring", "amulet", "key", "quest"]).toContain(d.kind);
    }
  });

  it("preços sensatos", () => {
    for (const d of all) {
      expect(Number.isInteger(d.value), d.id).toBe(true);
      expect(d.value, d.id).toBeGreaterThanOrEqual(0);
      if (d.kind !== "key" && d.kind !== "quest") expect(d.value, d.id).toBeGreaterThan(0);
      if (d.level !== undefined) expect(d.level).toBeGreaterThanOrEqual(1);
    }
    expect(ITEMS.health_potion!.value).toBe(40);
    // Preço cresce com o level dentro do mesmo tipo de arma/vocação.
    for (const voc of VOCATIONS) {
      const ws = weapons.filter((w) => w.vocations![0] === voc);
      for (const w of ws) for (const o of ws.filter((x) => x.level! < w.level!)) expect(w.value, `${voc} ${w.id} vs ${o.id}`).toBeGreaterThan(o.value);
    }
  });

  it("loot de monstros referencia itens existentes", () => {
    for (const m of Object.values(MONSTERS)) {
      if (m.id.startsWith("summoned_")) { expect(m.loot).toBeUndefined(); continue; }
      expect(m.gold, m.id).toBeDefined();
      expect(m.gold![0]).toBeLessThanOrEqual(m.gold![1]);
      expect(m.loot?.length, m.id).toBeGreaterThan(0);
      for (const e of m.loot!) {
        expect(ITEMS[e.itemId], `${m.id} -> ${e.itemId}`).toBeDefined();
        expect(e.chance).toBeGreaterThan(0);
        expect(e.chance).toBeLessThanOrEqual(1);
        if (e.min !== undefined || e.max !== undefined) expect(e.min!).toBeLessThanOrEqual(e.max!);
      }
      if (m.boss) for (const id of ["crypt_key", "goblin_crown"]) void id;
    }
    expect(MONSTERS.swamp_lich!.loot!.some((e) => e.itemId === "crypt_key" && e.chance === 1)).toBe(true);
  });

  it("ouro dos monstros cresce com o level", () => {
    const ms = Object.values(MONSTERS).filter((m) => !m.boss && m.gold).sort((a, b) => a.level - b.level);
    for (let i = 1; i < ms.length; i++) expect(ms[i]!.gold![1], ms[i]!.id).toBeGreaterThanOrEqual(ms[i - 1]!.gold![1]);
  });

  it("toda vocação tem arma de level 1 e de ~level 8", () => {
    for (const voc of VOCATIONS) {
      const ws = weapons.filter((w) => w.vocations!.includes(voc));
      expect(ws.some((w) => w.level === 1), voc).toBe(true);
      expect(ws.some((w) => w.level! >= 6 && w.level! <= 10), voc).toBe(true);
    }
  });

  it("dano médio da arma (skill 10) >= dano desarmado da vocação no level exigido", () => {
    const rows: Record<string, string | number>[] = [];
    for (const w of weapons.sort((a, b) => a.level! - b.level!)) {
      const voc = w.vocations![0] as Vocation;
      const [lo, hi] = playerDamageRange(voc, w.level!);
      const unarmed = (lo + hi) / 2;
      const weaponAvg = w.stats!.attack! + w.level! * 0.3;
      rows.push({ item: w.id, voc, lv: w.level!, attack: w.stats!.attack!, weaponAvg: +weaponAvg.toFixed(1), unarmed, ratio: +(weaponAvg / unarmed).toFixed(2) });
      expect(weaponAvg, w.id).toBeGreaterThanOrEqual(unarmed);
    }
    console.table(rows);
  });

  it("armadura total por tier fica em ~25-35% do dano médio dos monstros da zona", () => {
    const sum = (prefix: string, slots: string[]) => slots.reduce((s, sl) => s + (ITEMS[`${prefix}_${sl}`]?.stats?.armor ?? 0), 0);
    const melee = ["helmet", "armor", "legs", "boots", "shield"];
    const zoneAvg = (names: string[]) => names.reduce((s, n) => { const m = MONSTERS[n]!; return s + (m.damage[0] + m.damage[1]) / 2; }, 0) / names.length;
    const tiers: [string, number, string[]][] = [
      ["leather", 3, ["rat", "slime", "bee"]], ["bronze", 5, ["wolf", "snake"]], ["iron", 7, ["spider", "bat"]],
      ["steel", 10, ["skeleton", "goblin"]], ["mithril", 14, ["ghost", "lizardman", "flame_spirit"]],
    ];
    const rows = tiers.map(([p, total, ms]) => {
      const a = sum(p, melee), avg = zoneAvg(ms);
      expect(a, p).toBe(total);
      return { set: p, armor: a, zoneAvgDmg: +avg.toFixed(1), pct: Math.round((a / avg) * 100) };
    });
    console.table(rows);
    for (const r of rows.slice(1)) { expect(r.pct).toBeGreaterThanOrEqual(22); expect(r.pct).toBeLessThanOrEqual(40); }
  });

  it("economia: ouro+loot esperado por abate em lv 1-10 paga uma arma tier 2 em ~20-30 min", () => {
    const sellRate = 0.3;
    const ev = (id: string) => {
      const m = MONSTERS[id]!;
      const gold = (m.gold![0] + m.gold![1]) / 2;
      const loot = m.loot!.reduce((s, e) => { const d = ITEMS[e.itemId]!; const q = ((e.min ?? 1) + (e.max ?? 1)) / 2; return s + (d.kind === "material" || d.kind === "food" ? d.value * sellRate * e.chance * q : 0); }, 0);
      return gold + loot;
    };
    const mix = ["rat", "slime", "bee", "wolf"];
    const perKill = mix.reduce((s, id) => s + ev(id), 0) / mix.length;
    const killsPerMin = 3;
    const target = ITEMS.longsword!.value;
    const minutes = target / (perKill * killsPerMin);
    console.table({ perKill: +perKill.toFixed(1), killsPerMin, target, minutes: +minutes.toFixed(1) });
    expect(minutes).toBeGreaterThan(10);
    expect(minutes).toBeLessThan(40);
  });
});

describe("uso dos itens por vocação", () => {
  it("cada vocação tem conjunto equipável de tier 1 (compartilhado)", () => {
    for (const d of all.filter((x) => x.id.startsWith("leather_"))) expect(d.vocations).toBeUndefined();
  });
  it("itens de dois-mãos são armas", () => {
    for (const d of all.filter((x: ItemDef) => x.twoHanded)) expect(d.kind).toBe("weapon");
  });
});
