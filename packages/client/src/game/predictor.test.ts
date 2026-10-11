import { describe, expect, it } from "vitest";
import { CollisionGrid, Dir, stepDuration } from "@tibinha/shared";
import { Predictor } from "./predictor.ts";

function grid(rows: string[]): CollisionGrid {
  const h = rows.length, w = rows[0].length;
  const b = new Uint8Array(w * h);
  rows.forEach((r, y) => [...r].forEach((c, x) => { b[y * w + x] = c === "#" ? 1 : 0; }));
  return new CollisionGrid(w, h, b);
}

const G = grid(["......", "......", "..#...", "......"]);
const STEP = stepDuration(1, Dir.E);

function make(occupied: [number, number][] = []) {
  const p = new Predictor({ grid: G, spawn: null, isOccupied: (x, y) => occupied.some(([ox, oy]) => ox === x && oy === y) });
  p.reset(0, 0, Dir.S);
  return p;
}

describe("Predictor", () => {
  it("steps immediately on press and chains at exact cadence while held", () => {
    const p = make();
    p.press(Dir.E);
    expect(p.update(0)).toMatchObject({ kind: "step", x: 1, y: 0 });
    expect(p.update(STEP - 1)).toBeNull();
    expect(p.update(STEP + 10)).toMatchObject({ kind: "step", x: 2 });
    expect(p.stepEndsAt).toBe(2 * STEP); // encadeado a partir do fim do passo anterior
  });

  it("tap = exactly one step", () => {
    const p = make();
    p.press(Dir.S);
    p.release();
    expect(p.update(0)).toMatchObject({ kind: "step", x: 0, y: 1 });
    expect(p.update(STEP * 3)).toBeNull();
  });

  it("blocked → turn only (walls and players)", () => {
    const p = make([[1, 0]]);
    p.press(Dir.E);
    expect(p.update(0)).toEqual({ kind: "turn", dir: Dir.E });
    expect(p.x).toBe(0);
  });

  it("confirms matching server positions and detects divergence", () => {
    const p = make();
    p.press(Dir.E);
    p.update(0);
    p.update(STEP);
    expect(p.unconfirmed).toBe(2);
    expect(p.onServerPos(1, 0, STEP, 50).kind).toBe("confirmed");
    expect(p.unconfirmed).toBe(1);
    expect(p.onServerPos(1, 1, STEP, STEP + 50).kind).toBe("diverged");
    expect(p.unconfirmed).toBe(0);
    expect([p.x, p.y]).toEqual([1, 1]);
  });

  it("server-driven moves (click-walk) are external", () => {
    const p = make();
    expect(p.onServerPos(1, 1, STEP, 0)).toEqual({ kind: "external", ms: STEP });
    expect(p.isFree(STEP - 1)).toBe(false);
  });

  it("gives up on predictions the server never confirms", () => {
    const p = make();
    p.press(Dir.E);
    p.release();
    p.update(0);
    expect(p.checkStale(0, 0, 100)).toBe(false);
    expect(p.checkStale(0, 0, 1000)).toBe(true);
    expect([p.x, p.y]).toEqual([0, 0]);
  });
});
