import { describe, expect, it } from "vitest";
import { CollisionGrid } from "@lemonquest/shared";
import { findPath, type Point } from "./pathfinding.ts";

/** '#' = parede, '.' = livre. */
function grid(rows: string[]): CollisionGrid {
  const h = rows.length, w = rows[0].length;
  const b = new Uint8Array(w * h);
  rows.forEach((r, y) => [...r].forEach((c, x) => { b[y * w + x] = c === "#" ? 1 : 0; }));
  return new CollisionGrid(w, h, b);
}

function isValidPath(g: CollisionGrid, from: Point, path: Point[]) {
  let cur = from;
  for (const n of path) {
    const dx = n.x - cur.x, dy = n.y - cur.y;
    expect(Math.max(Math.abs(dx), Math.abs(dy))).toBe(1);
    expect(g.isWalkable(n.x, n.y)).toBe(true);
    if (dx && dy) {
      expect(g.isWalkable(cur.x + dx, cur.y)).toBe(true);
      expect(g.isWalkable(cur.x, cur.y + dy)).toBe(true);
    }
    cur = n;
  }
}

describe("findPath", () => {
  const open = grid(Array.from({ length: 10 }, () => ".........."));

  it("returns [] when already at target", () => {
    expect(findPath(open, { x: 2, y: 2 }, { x: 2, y: 2 })).toEqual([]);
  });

  it("goes diagonal in open field (octile optimal)", () => {
    const p = findPath(open, { x: 0, y: 0 }, { x: 4, y: 4 })!;
    expect(p).toHaveLength(4);
    expect(p.at(-1)).toEqual({ x: 4, y: 4 });
    isValidPath(open, { x: 0, y: 0 }, p);
  });

  it("straight line is straight", () => {
    const p = findPath(open, { x: 0, y: 5 }, { x: 6, y: 5 })!;
    expect(p.map((n) => n.y)).toEqual([5, 5, 5, 5, 5, 5]);
  });

  it("routes around a wall", () => {
    const g = grid([
      ".....",
      ".###.",
      ".#...",
      ".#.#.",
      ".....",
    ]);
    const p = findPath(g, { x: 0, y: 0 }, { x: 2, y: 2 })!;
    expect(p).not.toBeNull();
    expect(p.at(-1)).toEqual({ x: 2, y: 2 });
    isValidPath(g, { x: 0, y: 0 }, p);
  });

  it("never cuts corners", () => {
    const g = grid([
      "..",
      "#.",
    ]);
    // (0,0) -> (1,1): diagonal cutting the wall at (0,1) is forbidden; must go via (1,0).
    const p = findPath(g, { x: 0, y: 0 }, { x: 1, y: 1 })!;
    expect(p).toEqual([{ x: 1, y: 0 }, { x: 1, y: 1 }]);
  });

  it("returns null when unreachable or target is a wall", () => {
    const g = grid([
      "..#..",
      "..#..",
      "..#..",
    ]);
    expect(findPath(g, { x: 0, y: 0 }, { x: 4, y: 0 })).toBeNull();
    expect(findPath(g, { x: 0, y: 0 }, { x: 2, y: 1 })).toBeNull();
    expect(findPath(g, { x: 0, y: 0 }, { x: 9, y: 9 })).toBeNull(); // fora do mapa
  });

  it("respects dynamic blockers but not on the goal", () => {
    const g = grid([
      "...",
      "...",
      "...",
    ]);
    const blocked = (x: number, y: number) => x === 1 && y === 0;
    const p = findPath(g, { x: 0, y: 0 }, { x: 2, y: 0 }, blocked)!;
    expect(p.some((n) => n.x === 1 && n.y === 0)).toBe(false);
    expect(p.at(-1)).toEqual({ x: 2, y: 0 });
    // goal ocupado ainda gera caminho até ele
    expect(findPath(g, { x: 0, y: 0 }, { x: 1, y: 0 }, blocked)).toEqual([{ x: 1, y: 0 }]);
  });

  it("honors maxDist and maxNodes", () => {
    const big = grid(Array.from({ length: 60 }, () => ".".repeat(60)));
    expect(findPath(big, { x: 0, y: 0 }, { x: 50, y: 0 })).toBeNull(); // > 40
    expect(findPath(big, { x: 0, y: 0 }, { x: 40, y: 0 })).toHaveLength(40);
    expect(findPath(big, { x: 0, y: 0 }, { x: 30, y: 30 }, undefined, { maxNodes: 5 })).toBeNull();
  });
});
