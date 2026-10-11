/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ITEMS } from "./items.ts";
import { NPCS } from "./npcs.ts";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const world = JSON.parse(readFileSync(root + "assets/maps/world.json", "utf8"));

function npcIds(): string[] {
  const layer = world.layers.find((l: any) => l.name === "objects");
  const ids = new Set<string>();
  for (const o of layer.objects) {
    const p = (o.properties ?? []).find((q: any) => q.name === "npcId");
    if (p) ids.add(p.value);
  }
  return [...ids];
}

describe("NPCS", () => {
  it("define todo npcId usado no mapa", () => {
    const ids = npcIds();
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(NPCS[id], id).toBeDefined();
  });

  it("ids batem, sprites existem, textos presentes", () => {
    for (const [k, n] of Object.entries(NPCS)) {
      expect(n.id).toBe(k);
      expect(existsSync(root + "assets/" + n.sprite), n.id).toBe(true);
      const png = readFileSync(root + "assets/" + n.sprite);
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], `${n.id}: sheet 64x112`).toEqual([64, 112]);
      expect(n.name.length).toBeGreaterThan(0);
      expect(n.greeting.length).toBeGreaterThan(0);
      expect(n.idleLines?.length ?? 0, n.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("itens das lojas existem e preços são válidos", () => {
    for (const n of Object.values(NPCS)) {
      for (const e of n.shop?.sells ?? []) {
        expect(ITEMS[e.itemId], `${n.id} -> ${e.itemId}`).toBeDefined();
        if (e.price !== undefined) expect(e.price).toBeGreaterThan(0);
      }
      const ids = (n.shop?.sells ?? []).map((e) => e.itemId);
      expect(new Set(ids).size, n.id).toBe(ids.length);
    }
  });

  it("papéis: loja, depósito e NPCs sem loja", () => {
    expect(NPCS.shop!.shop!.sells.length).toBeGreaterThan(10);
    expect(NPCS.depot!.depot).toBe(true);
    expect(NPCS.priest!.shop).toBeUndefined();
    expect(NPCS.guard_captain!.shop).toBeUndefined();
    expect(NPCS.bounty_board!.shop).toBeUndefined();
    expect(NPCS.old_hunter!.shop!.sells.some((e) => ITEMS[e.itemId]!.vocations?.includes("paladin"))).toBe(true);
    expect(NPCS.herbalist!.shop!.sells.some((e) => ITEMS[e.itemId]!.vocations?.includes("sorcerer"))).toBe(true);
  });

  it("loja principal cobre todas as vocações com arma de level 1 e ~8", () => {
    const items = NPCS.shop!.shop!.sells.map((e) => ITEMS[e.itemId]!);
    for (const voc of ["knight", "paladin", "sorcerer", "druid"] as const) {
      const ws = items.filter((d) => d.kind === "weapon" && d.vocations?.includes(voc));
      expect(ws.some((w) => w.level === 1), voc).toBe(true);
      expect(ws.some((w) => w.level === 8), voc).toBe(true);
    }
  });
});
