import { describe, expect, it } from "vitest";
import { CollisionGrid, hasLineOfSight, lineOfSight } from "./map.ts";

function grid(rows: string[]): CollisionGrid {
  const h = rows.length, w = rows[0].length;
  const b = new Uint8Array(w * h);
  rows.forEach((r, y) => [...r].forEach((c, x) => { b[y * w + x] = c === "#" ? 1 : 0; }));
  return new CollisionGrid(w, h, b);
}
const P = (x: number, y: number) => ({ x, y });

describe("hasLineOfSight", () => {
  const open = grid(Array.from({ length: 12 }, () => ".".repeat(12)));

  it("open field: always clear (straight, diagonal, knight-move, long)", () => {
    expect(hasLineOfSight(open, P(1, 1), P(10, 1))).toBe(true);
    expect(hasLineOfSight(open, P(1, 1), P(9, 9))).toBe(true);
    expect(hasLineOfSight(open, P(1, 1), P(3, 2))).toBe(true);
    expect(hasLineOfSight(open, P(0, 0), P(11, 7))).toBe(true);
    expect(hasLineOfSight(open, P(5, 5), P(5, 5))).toBe(true);
  });

  it("a wall between the endpoints blocks; walls at the endpoints don't count", () => {
    const g = grid([
      "..........",
      "....#.....",
      "..........",
    ]);
    expect(hasLineOfSight(g, P(1, 1), P(8, 1))).toBe(false);
    expect(hasLineOfSight(g, P(8, 1), P(1, 1))).toBe(false); // simétrica
    expect(hasLineOfSight(g, P(1, 1), P(4, 1))).toBe(true);  // o destino é a parede
    expect(hasLineOfSight(g, P(1, 0), P(8, 0))).toBe(true);  // linha de cima livre
    expect(hasLineOfSight(g, P(0, 0), P(8, 2))).toBe(false); // diagonal longa cruza (4,1)
  });

  it("adjacent tiles always see each other (orthogonal and diagonal with an open corner)", () => {
    const g = grid([
      "#.",
      "..",
    ]);
    expect(hasLineOfSight(g, P(1, 0), P(0, 1))).toBe(true); // quina (0,0) parede, (1,1) livre
    expect(hasLineOfSight(g, P(1, 1), P(1, 0))).toBe(true);
  });

  it("diagonal corner: squeezing exactly between two walls is blocked, one wall is not", () => {
    const both = grid([
      ".#",
      "#.",
    ]);
    expect(hasLineOfSight(both, P(0, 0), P(1, 1))).toBe(false);
    expect(hasLineOfSight(both, P(1, 1), P(0, 0))).toBe(false);
    const one = grid([
      ".#",
      "..",
    ]);
    expect(hasLineOfSight(one, P(0, 0), P(1, 1))).toBe(true);
    // Diagonal longa passando pela quina de duas paredes em "xadrez".
    const chk = grid([
      "....",
      "..#.",
      ".#..",
      "....",
    ]);
    expect(hasLineOfSight(chk, P(0, 0), P(3, 3))).toBe(false); // (1,1)→(2,2) entre (2,1) e (1,2)
    expect(hasLineOfSight(chk, P(0, 3), P(3, 0))).toBe(false); // passa pelas próprias paredes
    expect(hasLineOfSight(chk, P(0, 0), P(3, 0))).toBe(true);
  });

  it("is symmetric on random grids", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const rows = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => (rnd() < 0.2 ? "#" : ".")).join(""));
    const g = grid(rows);
    const pass = (x: number, y: number) => g.isWalkable(x, y);
    for (let i = 0; i < 2000; i++) {
      const ax = Math.floor(rnd() * 16), ay = Math.floor(rnd() * 16), bx = Math.floor(rnd() * 16), by = Math.floor(rnd() * 16);
      expect(lineOfSight(ax, ay, bx, by, pass)).toBe(lineOfSight(bx, by, ax, ay, pass));
    }
  });
});
