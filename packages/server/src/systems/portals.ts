import { findObjects, objectTile, type TeleportedMsg, type TiledMap } from "@tibinha/shared";
import type { PlayerState } from "../state.ts";
import type { MovementSystem } from "./movement.ts";
import { nearestFreeTile } from "../world/tiles.ts";

export const PORTAL_COOLDOWN_MS = 1000;

interface Dest { toX: number; toY: number }

/** Portais (objetos `portal` com toX/toY): ao PISAR no tile, teleporta. */
export class PortalSystem {
  private readonly portals = new Map<string, Dest>();
  private readonly last = new WeakMap<PlayerState, { x: number; y: number }>();
  private readonly cooldownUntil = new WeakMap<PlayerState, number>();

  constructor(
    tiled: TiledMap,
    private readonly movement: Pick<MovementSystem, "teleport">,
    private readonly send: (playerId: string, msg: TeleportedMsg) => void,
    private readonly now: () => number = Date.now,
    /** Tile livre para chegar (andável, sem monstro/NPC/jogador). Destino ocupado → tile livre mais próximo. */
    private readonly isFree?: (x: number, y: number, self: PlayerState) => boolean,
  ) {
    for (const o of findObjects(tiled, "portal")) {
      const num = (n: string) => Number(o.properties?.find((p) => p.name === n)?.value);
      const toX = num("toX"), toY = num("toY");
      if (!Number.isFinite(toX) || !Number.isFinite(toY)) continue;
      const t = objectTile(o, tiled.tilewidth);
      this.portals.set(`${t.x},${t.y}`, { toX, toY });
    }
  }

  /** Para a IA de monstros evitar pisar em portais. */
  isPortalTile(x: number, y: number): boolean {
    return this.portals.has(`${x},${y}`);
  }

  /** Destino do portal em (x,y), se houver (alcançabilidade). */
  destination(x: number, y: number): { x: number; y: number } | undefined {
    const d = this.portals.get(`${x},${y}`);
    return d ? { x: d.toX, y: d.toY } : undefined;
  }

  /** Chamar após o movimento, a cada tick. */
  check(p: PlayerState): void {
    const prev = this.last.get(p);
    this.last.set(p, { x: p.x, y: p.y });
    if (prev && prev.x === p.x && prev.y === p.y) return; // não mudou de tile
    const dest = this.portals.get(`${p.x},${p.y}`);
    if (!dest) return;
    const now = this.now();
    if (now < (this.cooldownUntil.get(p) ?? 0)) return;
    this.cooldownUntil.set(p, now + PORTAL_COOLDOWN_MS);
    const free = this.isFree;
    const to = (free && nearestFreeTile(dest.toX, dest.toY, (x, y) => free(x, y, p))) || { x: dest.toX, y: dest.toY };
    this.movement.teleport(p, to.x, to.y);
    this.last.set(p, to);
    this.send(p.id, to);
  }
}
