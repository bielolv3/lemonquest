// Ground speed (Tibia-style) + terrain kind per tile, emitted as Tiled tile properties on the tilesets:
//   tiles: [{ id, properties: [{ name: "speed", type: "int", value }, { name: "terrain", type: "string", value }] }]
// speed is a percentage of the normal step time (100 = normal, higher = slower). The game reads it through
// GroundSpeedGrid (packages/shared/src/map.ts): ground layer value, overridden by the deco layer if the deco tile has it.
// terrain is cosmetic (footstep particles). Tiles not listed here = speed 100, no terrain.
//
// Rules: [tilesetName, col0, row0, col1, row1 (inclusive), speed, terrain]. Later rules win.
export const SPEED_RULES = [
  // ---- TilesetFloor (22 cols): blob terrains are 11x5 blocks; left half = light family, right half = dark family
  ['TilesetFloor', 0, 0, 10, 4, 120, 'sand'],      // light sand (unused in the overworld for now)
  ['TilesetFloor', 11, 0, 21, 4, 120, 'sand'],     // pink sand
  ['TilesetFloor', 0, 5, 5, 6, 120, 'sand'],       // sand ground + tufts
  ['TilesetFloor', 11, 5, 16, 6, 120, 'sand'],
  ['TilesetFloor', 0, 7, 10, 11, 85, 'road'],      // brown dirt on light grass = roads + town streets
  ['TilesetFloor', 11, 7, 21, 11, 95, 'dirt'],     // dark dirt on dark grass = ruins paths, goblin arena
  ['TilesetFloor', 0, 12, 5, 13, 100, 'grass'],    // forest / town grass
  ['TilesetFloor', 11, 12, 16, 13, 100, 'grass'],  // dark (ruins) grass
  ['TilesetFloor', 0, 14, 10, 18, 125, 'snow'],    // snow (unused)
  ['TilesetFloor', 11, 14, 21, 18, 150, 'mud'],    // swamp mud (patches + swamp trails)
  ['TilesetFloor', 0, 19, 5, 20, 125, 'snow'],
  ['TilesetFloor', 11, 19, 16, 20, 115, 'swamp'],  // boggy swamp soil
  // ---- cave floor: same image as TilesetFloor (the cave reuses the mud art), separate tileset so it can be normal speed
  ['TilesetCaveFloor', 11, 14, 21, 18, 100, 'stone'],
  // ---- arena floor: same image as TilesetFloor, normal speed (the orange sand ground + tufts)
  ['TilesetArenaFloor', 0, 5, 5, 6, 100, 'sand'],
  // ---- TilesetInteriorFloor
  ['TilesetInteriorFloor', 0, 0, 21, 11, 85, 'floor'],    // polished stone / wooden floors
  ['TilesetInteriorFloor', 0, 12, 10, 16, 85, 'cobble'],  // town plaza cobblestone
  ['TilesetInteriorFloor', 11, 12, 21, 16, 95, 'stone'],  // crypt dark cobble
  // ---- deco overrides (walkable things lying on the ground)
  ['TilesetFloorDetail', 0, 2, 7, 3, 110, null],   // weeds / tall grass tufts
  ['TilesetNature', 0, 10, 9, 10, 115, null],      // bushes (when walkable)
];

/** Tiled `tiles` array for a tileset (only tiles with properties). */
export function tileProps(name, columns, tilecount) {
  const props = new Map();
  for (const [ts, c0, r0, c1, r1, speed, terrain] of SPEED_RULES) {
    if (ts !== name) continue;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      if (c >= columns) continue;
      const id = r * columns + c;
      if (id >= tilecount) continue;
      props.set(id, { speed, terrain });
    }
  }
  return [...props.entries()].sort((a, b) => a[0] - b[0]).map(([id, { speed, terrain }]) => ({
    id,
    properties: [
      { name: 'speed', type: 'int', value: speed },
      ...(terrain ? [{ name: 'terrain', type: 'string', value: terrain }] : []),
    ],
  }));
}
