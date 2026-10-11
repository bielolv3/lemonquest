import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CollisionGrid, DEFAULT_SPAWN, findObjects, objectTile, type TiledMap } from "@tibinha/shared";

const assetsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../assets");

export interface LoadedMap {
  tiled: TiledMap;
  grid: CollisionGrid;
  spawn: { x: number; y: number };
}

export function loadMap(name = "world"): LoadedMap {
  const file = path.join(assetsDir, "maps", `${name}.json`);
  const tiled = JSON.parse(fs.readFileSync(file, "utf8")) as TiledMap;
  const grid = CollisionGrid.fromTiled(tiled);
  const sp = findObjects(tiled, "spawn_player")[0];
  return { tiled, grid, spawn: sp ? objectTile(sp, tiled.tilewidth) : DEFAULT_SPAWN };
}
