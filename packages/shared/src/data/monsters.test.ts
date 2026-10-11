/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MONSTERS } from "./monsters.ts";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const world = JSON.parse(readFileSync(root + "assets/maps/world.json", "utf8"));

function spawnIds(): string[] {
  const layer = world.layers.find((l: any) => l.name === "objects");
  const ids = new Set<string>();
  for (const o of layer.objects) {
    const p = (o.properties ?? []).find((q: any) => q.name === "monster");
    if (p) ids.add(p.value);
  }
  return [...ids];
}

describe("MONSTERS", () => {
  it("define todo monstro usado nos spawns do mapa", () => {
    const ids = spawnIds();
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(MONSTERS[id], id).toBeDefined();
  });

  it("sprites existem em disco", () => {
    for (const d of Object.values(MONSTERS)) {
      expect(existsSync(root + "assets/" + d.sprite.url), d.id).toBe(true);
      if (d.sprite.layout === "custom") expect(d.sprite.walk, d.id).toBeDefined();
    }
  });

  it("campos sensatos", () => {
    for (const [key, d] of Object.entries(MONSTERS)) {
      if (key.startsWith("summoned_")) { expect(d.hp).toBeGreaterThan(0); continue; } // invocações: xp 0, sem respawn
      expect(d.id).toBe(key);
      expect(d.hp).toBeGreaterThan(0);
      expect(d.xp).toBeGreaterThan(0);
      expect(d.damage[0]).toBeLessThanOrEqual(d.damage[1]);
      expect(d.attackRange).toBeGreaterThanOrEqual(1);
      expect(d.stepMs).toBeGreaterThanOrEqual(200);
      expect(d.stepMs).toBeLessThanOrEqual(900);
      expect(d.respawnMs).toBeGreaterThan(0);
    }
  });

  it("xp por hp cresce (aprox.) com o level", () => {
    const list = Object.values(MONSTERS).filter((d) => !d.boss && !d.id.startsWith("summoned_")).sort((a, b) => a.level - b.level);
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1], cur = list[i];
      expect(cur.xp / cur.hp, `${prev.id} -> ${cur.id}`).toBeGreaterThanOrEqual((prev.xp / prev.hp) * 0.9);
    }
  });

  it("bosses respawnam em ~2h", () => {
    for (const d of Object.values(MONSTERS).filter((m) => m.boss)) expect(d.respawnMs).toBeGreaterThanOrEqual(3_600_000);
  });
});
