/**
 * Formato de mapa: Tiled JSON (orthogonal, tiles 16x16, camadas não-infinitas).
 * Convenções de camadas (por nome):
 *   - tilelayers: "ground", "deco" (abaixo dos personagens), "above" (desenhada sobre os personagens: copas, telhados)
 *   - tilelayer "collision": qualquer gid != 0 bloqueia o tile
 *   - objectgroup "objects": pontos com `type`/`class` = "spawn_player" | "npc" | "monster_spawn" | "portal"
 */
export interface TiledLayer {
  name: string;
  type: "tilelayer" | "objectgroup";
  width?: number;
  height?: number;
  data?: number[];
  objects?: TiledObject[];
}

export interface TiledObject {
  id: number;
  name: string;
  type?: string;
  class?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  properties?: { name: string; type: string; value: unknown }[];
}

export interface TiledMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: { firstgid: number; source?: string; name?: string; image?: string; tilewidth?: number; tileheight?: number; columns?: number; tilecount?: number; imagewidth?: number; imageheight?: number }[];
}

/** Grade de colisão compartilhada por servidor (autoridade) e cliente (predição). */
export class CollisionGrid {
  constructor(readonly width: number, readonly height: number, private readonly blocked: Uint8Array) {}

  static fromTiled(map: TiledMap): CollisionGrid {
    const layer = map.layers.find((l) => l.type === "tilelayer" && l.name === "collision");
    const blocked = new Uint8Array(map.width * map.height);
    if (layer?.data) for (let i = 0; i < blocked.length; i++) blocked[i] = layer.data[i] ? 1 : 0;
    return new CollisionGrid(map.width, map.height, blocked);
  }

  isWalkable(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    return this.blocked[y * this.width + x] === 0;
  }
}

export function findObjects(map: TiledMap, kind: string): TiledObject[] {
  const layer = map.layers.find((l) => l.type === "objectgroup" && l.name === "objects");
  return (layer?.objects ?? []).filter((o) => (o.type ?? o.class) === kind);
}

/** Converte posição em pixels de um objeto Tiled para coordenada de tile. */
export const objectTile = (o: TiledObject, tile = 16) => ({ x: Math.floor(o.x / tile), y: Math.floor(o.y / tile) });

// ---------------------------------------------------------------------------
// Helpers de movimento compartilhados (servidor = autoridade, cliente = predição).
// ---------------------------------------------------------------------------

/** Tile de spawn do mapa (objeto "spawn_player"), ou o fallback informado. */
export function mapSpawn(map: TiledMap, fallback: { x: number; y: number }): { x: number; y: number } {
  const sp = findObjects(map, "spawn_player")[0];
  return sp ? objectTile(sp, map.tilewidth) : { x: fallback.x, y: fallback.y };
}

/** Tiles a até este raio (Chebyshev) do spawn não bloqueiam por jogador (anti-grief no templo). */
export const SPAWN_SAFE_RADIUS = 1;

export function isNearSpawn(spawn: { x: number; y: number } | null | undefined, x: number, y: number): boolean {
  return !!spawn && Math.max(Math.abs(spawn.x - x), Math.abs(spawn.y - y)) <= SPAWN_SAFE_RADIUS;
}

/**
 * Checa só o terreno para um passo de (x,y) em (dx,dy): o destino precisa ser andável e,
 * em diagonais, os dois vizinhos ortogonais também (sem cortar quina).
 */
export function canStepTerrain(grid: CollisionGrid, x: number, y: number, dx: number, dy: number): boolean {
  if (!grid.isWalkable(x + dx, y + dy)) return false;
  if (dx !== 0 && dy !== 0) return grid.isWalkable(x + dx, y) && grid.isWalkable(x, y + dy);
  return true;
}
