import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CollisionGrid, WaterGrid, type TiledMap } from "./map.ts";

const map = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../assets/maps/world.json"), "utf8")) as TiledMap;

describe("WaterGrid (pesca)", () => {
  const water = WaterGrid.fromTiled(map);
  const collision = CollisionGrid.fromTiled(map);
  const tiles: [number, number][] = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (water.isWater(x, y)) tiles.push([x, y]);

  it("o mapa tem água de verdade e quase toda ela é intransitável (lago e mar)", () => {
    expect(tiles.length).toBeGreaterThan(500);
    const blocked = tiles.filter(([x, y]) => !collision.isWalkable(x, y)).length;
    expect(blocked / tiles.length).toBeGreaterThan(0.9);
  });

  it("existe margem: tile de água com tile andável a até 5 passos (dá para pescar de algum lugar)", () => {
    const hasShore = tiles.some(([x, y]) => {
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (collision.isWalkable(x + dx, y + dy) && !water.isWater(x + dx, y + dy)) return true;
      return false;
    });
    expect(hasShore).toBe(true);
  });

  it("fora do mapa e terra não são água; mapa sem tileset de água não tem água", () => {
    expect(water.isWater(-1, 0)).toBe(false);
    expect(water.isWater(map.width, 0)).toBe(false);
    const g = map.layers.find((l) => l.name === "ground")!.data!;
    const land = g.findIndex((v, i) => v && !water.isWater(i % map.width, Math.floor(i / map.width)));
    expect(water.isWater(land % map.width, Math.floor(land / map.width))).toBe(false);
    const none = WaterGrid.fromTiled({ ...map, tilesets: map.tilesets.filter((t) => t.name !== "TilesetWater") });
    expect(none.isWater(tiles[0]![0], tiles[0]![1])).toBe(false);
  });
});
