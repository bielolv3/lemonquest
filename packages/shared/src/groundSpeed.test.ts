import { describe, expect, it } from "vitest";
import { Dir } from "./types.ts";
import { stepDuration } from "./formulas.ts";
import { GroundSpeedGrid, TILED_GID_MASK, type TiledMap, type TiledProperty } from "./map.ts";

const speed = (value: number, terrain?: string): TiledProperty[] => [
  { name: "speed", type: "int", value },
  ...(terrain ? [{ name: "terrain", type: "string", value: terrain }] : []),
];

/** 4x1 map, two tilesets: A (gids 1..10) and B (gids 11..30). */
function makeMap(ground: number[], deco: number[] = [0, 0, 0, 0]): TiledMap {
  return {
    width: 4, height: 1, tilewidth: 16, tileheight: 16,
    tilesets: [
      // fora de ordem de propósito: a resolução não pode depender da ordem do array
      { firstgid: 11, name: "B", tilecount: 20, tiles: [{ id: 0, properties: speed(150, "mud") }, { id: 5, properties: speed(115) }] },
      { firstgid: 1, name: "A", tilecount: 10, tiles: [{ id: 0, properties: speed(85, "road") }, { id: 2, properties: [{ name: "other", type: "int", value: 7 }] }] },
    ],
    layers: [
      { name: "ground", type: "tilelayer", width: 4, height: 1, data: ground },
      { name: "deco", type: "tilelayer", width: 4, height: 1, data: deco },
    ],
  };
}

describe("GroundSpeedGrid", () => {
  it("resolves gid -> tileset by firstgid range across multiple tilesets", () => {
    // A#0 (gid 1) = 85, A#1 (gid 2) = sem prop, B#0 (gid 11) = 150, B#5 (gid 16) = 115
    const g = GroundSpeedGrid.fromTiled(makeMap([1, 2, 11, 16]));
    expect([0, 1, 2, 3].map((x) => g.speedAt(x, 0))).toEqual([85, 100, 150, 115]);
    expect([0, 1, 2, 3].map((x) => g.terrainAt(x, 0))).toEqual(["road", null, "mud", null]);
  });

  it("does not leak a tile id into the next tileset (gid 11 is B#0, not A#10)", () => {
    const g = GroundSpeedGrid.fromTiled(makeMap([10, 11, 0, 3]));
    expect([0, 1, 2, 3].map((x) => g.speedAt(x, 0))).toEqual([100, 150, 100, 100]);
  });

  it("ignores Tiled flip/rotation flag bits", () => {
    const flipped = (gid: number) => (gid | 0x80000000 | 0x40000000 | 0x20000000) >>> 0;
    expect(flipped(11) & TILED_GID_MASK).toBe(11);
    const g = GroundSpeedGrid.fromTiled(makeMap([flipped(1), flipped(11), 0, 0]));
    expect(g.speedAt(0, 0)).toBe(85);
    expect(g.speedAt(1, 0)).toBe(150);
  });

  it("deco overrides ground only when the deco tile has the property", () => {
    // x0: grama(sem prop) + arbusto 115; x1: estrada + deco sem prop; x2: estrada + lama decal; x3: nada
    const g = GroundSpeedGrid.fromTiled(makeMap([2, 1, 1, 2], [16, 3, 11, 0]));
    expect([0, 1, 2, 3].map((x) => g.speedAt(x, 0))).toEqual([115, 85, 150, 100]);
    // terrain sobrescreve independente: arbusto não tem terrain → mantém o do chão
    expect([0, 1, 2].map((x) => g.terrainAt(x, 0))).toEqual([null, "road", "mud"]);
  });

  it("out of bounds and maps without properties default to 100", () => {
    const g = GroundSpeedGrid.fromTiled(makeMap([1, 1, 1, 1]));
    expect(g.speedAt(-1, 0)).toBe(100);
    expect(g.speedAt(4, 0)).toBe(100);
    expect(g.terrainAt(0, 5)).toBeNull();
    const bare: TiledMap = { width: 2, height: 1, tilewidth: 16, tileheight: 16, tilesets: [{ firstgid: 1 }], layers: [] };
    expect(GroundSpeedGrid.fromTiled(bare).speedAt(0, 0)).toBe(100);
  });
});

describe("stepDuration with ground speed", () => {
  it("default/100 keeps the old result", () => {
    for (const lvl of [1, 10, 40, 80]) for (const d of [Dir.E, Dir.NE]) {
      expect(stepDuration(lvl, d, 100)).toBe(stepDuration(lvl, d));
    }
    expect(stepDuration(1, Dir.E)).toBe(280);
  });

  it("scales by groundSpeed/100 from the rounded base, rounded", () => {
    const base = stepDuration(1, Dir.E); // 280
    expect(stepDuration(1, Dir.E, 85)).toBe(238);
    expect(stepDuration(1, Dir.E, 150)).toBe(420);
    const diag = stepDuration(7, Dir.SW);
    expect(stepDuration(7, Dir.SW, 115)).toBe(Math.round((diag * 115) / 100));
    expect(stepDuration(1, Dir.E, 150)).toBeGreaterThan(base);
    expect(stepDuration(1, Dir.E, 85)).toBeLessThan(base);
  });
});
