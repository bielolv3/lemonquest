import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CollisionGrid, Dir, type TiledMap } from "@tibinha/shared";
import type { PlayerState } from "../state.ts";
import { MovementSystem } from "./movement.ts";
import { PORTAL_COOLDOWN_MS, PortalSystem } from "./portals.ts";

const tiled = (portals: [number, number, number, number][]) => ({
  tilewidth: 16,
  layers: [{ type: "objectgroup", name: "objects", objects: portals.map(([x, y, toX, toY], i) => ({
    id: i, name: "portal", type: "portal", x: x * 16, y: y * 16, width: 16, height: 16,
    properties: [{ name: "toX", type: "int", value: toX }, { name: "toY", type: "int", value: toY }],
  })) }],
}) as unknown as TiledMap;

const player = (x: number, y: number) => ({ id: "a", x, y, dir: Dir.S, stepMs: 0, level: 1, seq: 0 }) as unknown as PlayerState;

function setup(portals: [number, number, number, number][]) {
  let clock = 1000;
  const g = new CollisionGrid(20, 20, new Uint8Array(400));
  const mv = new MovementSystem(g, { now: () => clock });
  const sent: unknown[] = [];
  const sys = new PortalSystem(tiled(portals), mv, (_id, m) => sent.push(m), () => clock);
  const p = player(1, 1);
  mv.addPlayer(p);
  return { sys, p, sent, setClock: (t: number) => { clock = t; } };
}

describe("PortalSystem", () => {
  it("teleports on arrival and notifies", () => {
    const { sys, p, sent } = setup([[5, 5, 15, 15], [15, 15, 5, 5]]);
    sys.check(p);
    p.x = 5; p.y = 5; sys.check(p);
    expect([p.x, p.y]).toEqual([15, 15]);
    expect(sent).toEqual([{ x: 15, y: 15 }]);
    expect(sys.isPortalTile(5, 5)).toBe(true);
    expect(sys.isPortalTile(6, 5)).toBe(false);
  });

  it("does not ping-pong, and cooldown expires", () => {
    const { sys, p, setClock } = setup([[5, 5, 15, 15], [15, 15, 5, 5]]);
    sys.check(p);
    p.x = 5; p.y = 5; sys.check(p);
    sys.check(p); sys.check(p);
    expect([p.x, p.y]).toEqual([15, 15]);
    p.x = 14; sys.check(p); p.x = 15; sys.check(p); // back onto target portal during cooldown: ignored
    expect([p.x, p.y]).toEqual([15, 15]);
    setClock(1000 + PORTAL_COOLDOWN_MS + 1);
    p.x = 14; sys.check(p); p.x = 15; sys.check(p);
    expect([p.x, p.y]).toEqual([5, 5]);
  });

  it("world map portals have walkable, non-portal targets", () => {
    const m = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../../../../assets/maps/world.json"), "utf8")) as TiledMap;
    const grid = CollisionGrid.fromTiled(m);
    const sys = new PortalSystem(m, { teleport() {} }, () => {});
    const objs = m.layers.find((l) => l.name === "objects")!.objects!.filter((o) => o.type === "portal");
    expect(objs.length).toBeGreaterThan(0);
    for (const o of objs) {
      const g = (n: string) => Number(o.properties!.find((x) => x.name === n)!.value);
      expect(grid.isWalkable(g("toX"), g("toY"))).toBe(true);
      expect(sys.isPortalTile(g("toX"), g("toY"))).toBe(false);
    }
  });
});
