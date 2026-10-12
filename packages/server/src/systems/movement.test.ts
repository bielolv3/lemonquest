import { describe, expect, it } from "vitest";
import { CollisionGrid, Dir, GroundSpeedGrid, TICK_MS, stepDuration } from "@lemonquest/shared";
import type { PlayerState } from "../state.ts";
import { MovementSystem } from "./movement.ts";

function grid(rows: string[]): CollisionGrid {
  const h = rows.length, w = rows[0].length;
  const b = new Uint8Array(w * h);
  rows.forEach((r, y) => [...r].forEach((c, x) => { b[y * w + x] = c === "#" ? 1 : 0; }));
  return new CollisionGrid(w, h, b);
}

const OPEN = grid(Array.from({ length: 12 }, () => "............"));

// Objetos simples no lugar do Schema (MovementSystem só lê/escreve campos).
function player(id: string, x: number, y: number, level = 1): PlayerState {
  return { id, name: id, vocation: "knight", level, x, y, dir: Dir.S, stepMs: 0, seq: 0 } as unknown as PlayerState;
}

function setup(g = OPEN, opts: ConstructorParameters<typeof MovementSystem>[1] = {}) {
  let clock = 1000;
  const sys = new MovementSystem(g, { now: () => clock, ...opts });
  const players: PlayerState[] = [];
  const add = (p: PlayerState) => { players.push(p); sys.addPlayer(p); return p; };
  /** Avança o tempo em ticks de TICK_MS. */
  const run = (ms: number) => {
    const end = clock + ms;
    while (clock < end) { clock += TICK_MS; sys.tick(clock, players); }
  };
  return { sys, add, run, now: () => clock, setClock: (t: number) => { clock = t; } };
}

const STEP = stepDuration(1, Dir.E);
const DIAG = stepDuration(1, Dir.NE);

describe("MovementSystem — keys", () => {
  it("held key walks one tile per step duration and updates dir/stepMs/seq", () => {
    const { sys, add, run } = setup();
    const p = add(player("a", 2, 5));
    sys.onMove(p, { dir: Dir.E, seq: 7 });
    expect(p.seq).toBe(7);
    run(TICK_MS);
    expect(p.x).toBe(3);
    expect(p.dir).toBe(Dir.E);
    expect(p.stepMs).toBe(STEP);
    run(STEP * 3);
    expect(p.x).toBe(6); // 3 passos a mais em 3*STEP (cadência exata, sem perda por tick)
  });

  it("cannot start a new step before the previous one ends", () => {
    const { sys, add, run } = setup();
    const p = add(player("a", 2, 5));
    sys.onMove(p, { dir: Dir.E, seq: 1 });
    run(TICK_MS);
    expect(p.x).toBe(3);
    sys.onMove(p, { dir: Dir.S, seq: 2 });
    run(STEP - 2 * TICK_MS);
    expect(p).toMatchObject({ x: 3, y: 5 });
    run(2 * TICK_MS);
    expect(p).toMatchObject({ x: 3, y: 6 });
  });

  it("a tap (press+release before next tick) still performs exactly one step", () => {
    const { sys, add, run } = setup();
    const p = add(player("a", 2, 5));
    sys.onMove(p, { dir: Dir.N, seq: 1 });
    sys.onMove(p, { dir: null, seq: 2 });
    run(STEP * 4);
    expect(p).toMatchObject({ x: 2, y: 4, seq: 2 });
  });

  it("a tap during a step is buffered and executed after it", () => {
    const { sys, add, run } = setup();
    const p = add(player("a", 2, 5));
    sys.onMove(p, { dir: Dir.E, seq: 1 });
    run(TICK_MS);
    sys.onMove(p, { dir: null, seq: 2 });
    sys.onMove(p, { dir: Dir.S, seq: 3 });
    sys.onMove(p, { dir: null, seq: 4 });
    run(STEP * 4);
    expect(p).toMatchObject({ x: 3, y: 6 });
  });

  it("starts immediately on input (no tick wait)", () => {
    const { sys, add } = setup();
    const p = add(player("a", 2, 5));
    sys.onMove(p, { dir: Dir.E, seq: 1 });
    expect(p.x).toBe(3);
  });

  it("release arriving after a step boundary (before the tick) still performs that step", () => {
    const { sys, add, setClock } = setup();
    const p = add(player("a", 2, 5));
    sys.onMove(p, { dir: Dir.E, seq: 1 }); // t=1000, passo até 1000+STEP
    setClock(1000 + STEP + 10);              // nenhum tick rodou ainda
    sys.onMove(p, { dir: null, seq: 2 });
    expect(p.x).toBe(4);
  });

  it("diagonal steps take longer", () => {
    const { sys, add, run } = setup();
    const p = add(player("a", 5, 5));
    sys.onMove(p, { dir: Dir.NE, seq: 1 });
    run(TICK_MS);
    expect(p).toMatchObject({ x: 6, y: 4, stepMs: DIAG });
    sys.onMove(p, { dir: null, seq: 2 });
    run(DIAG * 3);
    expect(p).toMatchObject({ x: 6, y: 4 });
  });

  it("blocked by wall: only turns", () => {
    const g = grid([
      "....",
      ".#..",
      "....",
    ]);
    const { sys, add, run } = setup(g);
    const p = add(player("a", 0, 1));
    sys.onMove(p, { dir: Dir.E, seq: 1 });
    run(STEP * 2);
    expect(p).toMatchObject({ x: 0, y: 1, dir: Dir.E });
  });

  it("no corner cutting on diagonals", () => {
    const g = grid([
      "....",
      ".#..",
      "....",
    ]);
    const { sys, add, run } = setup(g);
    const p = add(player("a", 0, 0));
    sys.onMove(p, { dir: Dir.SE, seq: 1 }); // (1,1) is a wall
    run(STEP);
    expect(p).toMatchObject({ x: 0, y: 0, dir: Dir.SE });
    const q = add(player("b", 2, 0));
    sys.onMove(q, { dir: Dir.SW, seq: 1 }); // destino (1,1) parede
    sys.onMove(p, { dir: null, seq: 2 });
    const r = add(player("c", 0, 2));
    sys.onMove(r, { dir: Dir.NE, seq: 1 }); // destino (1,1) parede
    run(STEP);
    expect(q).toMatchObject({ x: 2, y: 0 });
    expect(r).toMatchObject({ x: 0, y: 2 });
    const s = add(player("d", 2, 2));
    sys.onMove(s, { dir: Dir.NW, seq: 1 }); // destino (1,1) parede
    const t = add(player("e", 2, 1));
    sys.onMove(t, { dir: Dir.SW, seq: 1 }); // destino (1,2) livre, mas corta (1,1)
    run(STEP);
    expect(s).toMatchObject({ x: 2, y: 2 });
    expect(t).toMatchObject({ x: 2, y: 1 });
  });

  it("players block each other", () => {
    const { sys, add, run } = setup();
    const a = add(player("a", 2, 2));
    add(player("b", 3, 2));
    sys.onMove(a, { dir: Dir.E, seq: 1 });
    run(STEP * 2);
    expect(a).toMatchObject({ x: 2, y: 2, dir: Dir.E });
  });

  it("players do not block near the spawn tile", () => {
    const { sys, add, run } = setup(OPEN, { spawn: { x: 5, y: 5 } });
    const a = add(player("a", 5, 7));
    add(player("b", 5, 6)); // a 1 tile do spawn
    add(player("c", 5, 5)); // no spawn
    sys.onMove(a, { dir: Dir.N, seq: 1 });
    run(TICK_MS);
    expect(a).toMatchObject({ x: 5, y: 6 });
    run(STEP);
    expect(a).toMatchObject({ x: 5, y: 5 });
  });

  it("ignores invalid input", () => {
    const { sys, add, run } = setup();
    const p = add(player("a", 2, 2));
    sys.onMove(p, { dir: 9 as Dir, seq: 1 });
    sys.onMove(p, { dir: 1.5 as Dir, seq: 1 });
    sys.onMove(p, { dir: Dir.E, seq: "x" as unknown as number });
    sys.onMove(p, null as never);
    sys.onWalkTo(p, { x: 1.5, y: 2 });
    sys.onWalkTo(p, { x: -1, y: 2 });
    sys.onWalkTo(p, { x: 999, y: 2 });
    sys.onTurn(p, { dir: -1 as Dir });
    run(STEP * 3);
    expect(p).toMatchObject({ x: 2, y: 2, dir: Dir.S, seq: 0 });
  });
});

describe("MovementSystem — turn", () => {
  it("turns when idle, not mid-step", () => {
    const { sys, add, run } = setup();
    const p = add(player("a", 2, 2));
    sys.onTurn(p, { dir: Dir.W });
    expect(p.dir).toBe(Dir.W);
    sys.onMove(p, { dir: Dir.E, seq: 1 });
    sys.onMove(p, { dir: null, seq: 2 });
    run(TICK_MS);
    sys.onTurn(p, { dir: Dir.N });
    expect(p.dir).toBe(Dir.E);
    run(STEP);
    sys.onTurn(p, { dir: Dir.N });
    expect(p.dir).toBe(Dir.N);
  });
});

describe("MovementSystem — walkTo", () => {
  it("follows an A* path one node per step", () => {
    const g = grid([
      "......",
      "#####.",
      "......",
    ]);
    const { sys, add, run } = setup(g);
    const p = add(player("a", 0, 2));
    sys.onWalkTo(p, { x: 5, y: 0 });
    run(TICK_MS);
    expect(p).toMatchObject({ x: 1, y: 2 });
    run(STEP * 10);
    expect(p).toMatchObject({ x: 5, y: 0 });
  });

  it("move key cancels the path", () => {
    const { sys, add, run } = setup();
    const p = add(player("a", 0, 0));
    sys.onWalkTo(p, { x: 8, y: 0 });
    run(TICK_MS);
    expect(p.x).toBe(1);
    sys.onMove(p, { dir: Dir.S, seq: 1 });
    sys.onMove(p, { dir: null, seq: 2 });
    run(STEP * 5);
    expect(p).toMatchObject({ x: 1, y: 1 });
  });

  it("recomputes around a player that steps into the path", () => {
    const { sys, add, run } = setup();
    const p = add(player("a", 0, 5));
    sys.onWalkTo(p, { x: 6, y: 5 });
    run(TICK_MS);
    expect(p).toMatchObject({ x: 1, y: 5 });
    add(player("b", 2, 5)); // aparece no caminho
    run(STEP * 10);
    expect(p).toMatchObject({ x: 6, y: 5 });
  });

  it("stops next to an occupied destination", () => {
    const { sys, add, run } = setup();
    const p = add(player("a", 0, 5));
    add(player("b", 4, 5));
    sys.onWalkTo(p, { x: 4, y: 5 });
    run(STEP * 10);
    expect(p).toMatchObject({ x: 3, y: 5, dir: Dir.E });
  });

  it("rejects targets farther than the max distance", () => {
    const big = grid(Array.from({ length: 60 }, () => ".".repeat(60)));
    const { sys, add, run } = setup(big);
    const p = add(player("a", 0, 0));
    sys.onWalkTo(p, { x: 55, y: 0 });
    run(STEP * 2);
    expect(p).toMatchObject({ x: 0, y: 0 });
  });
});

/** R = estrada (85), . = grama (100), M = lama (150). */
function speeds(rows: string[]): GroundSpeedGrid {
  const h = rows.length, w = rows[0].length;
  const v = new Uint16Array(w * h);
  const S: Record<string, number> = { R: 85, ".": 100, M: 150 };
  rows.forEach((r, y) => [...r].forEach((c, x) => { v[y * w + x] = S[c]; }));
  return new GroundSpeedGrid(w, h, v);
}

describe("MovementSystem — ground speed", () => {
  const TERRAIN = speeds([
    "RRR...MMM...",
    "RRR...MMM...",
    "............",
  ]);
  const G3 = grid(["............", "............", "............"]);

  it("step duration uses the ORIGIN tile's ground speed (road fast, mud slow)", () => {
    const { sys, add, run } = setup(G3, { groundSpeed: TERRAIN });
    const p = add(player("a", 0, 0));
    const seen: { x: number; ms: number }[] = [];
    sys.onMove(p, { dir: Dir.E, seq: 1 });
    seen.push({ x: p.x, ms: p.stepMs });
    for (let i = 0; i < 200 && p.x < 10; i++) {
      const before = p.x;
      run(TICK_MS);
      if (p.x !== before) seen.push({ x: p.x, ms: p.stepMs });
    }
    // passo que SAI do tile x usa o chão de x: 0,1,2 estrada; 3,4,5 grama; 6,7,8 lama; 9 grama
    const road = stepDuration(1, Dir.E, 85), norm = stepDuration(1, Dir.E), mud = stepDuration(1, Dir.E, 150);
    expect(seen.map((s) => s.ms)).toEqual([road, road, road, norm, norm, norm, mud, mud, mud, norm]);
    expect(road).toBeLessThan(norm);
    expect(mud).toBeGreaterThan(norm);
  });

  it("slow tiles take longer in wall-clock time (exact cadence)", () => {
    const { sys, add, run, now } = setup(G3, { groundSpeed: TERRAIN });
    const p = add(player("a", 0, 0));
    const t0 = now();
    sys.onMove(p, { dir: Dir.E, seq: 1 });
    // starts[k] = instante (observado no tick) em que começa o passo que SAI do tile k; o 1º foi no onMove.
    const starts: number[] = [0];
    while (p.x < 9 && now() - t0 < 10_000) { const b = p.x; run(TICK_MS); if (p.x !== b) starts.push(now() - t0); }
    const took = (k: number) => starts[k + 1] - starts[k];
    const road = stepDuration(1, Dir.E, 85), mud = stepDuration(1, Dir.E, 150);
    // tiles 0..2 estrada, 6..8 lama (±1 tick de quantização na observação)
    for (const k of [0, 1]) expect(Math.abs(took(k) - road)).toBeLessThanOrEqual(TICK_MS);
    for (const k of [6, 7]) expect(Math.abs(took(k) - mud)).toBeLessThanOrEqual(TICK_MS);  });

  it("without a grid every tile is 100 (backwards compatible)", () => {
    const { sys, add, run } = setup(G3);
    const p = add(player("a", 6, 0));
    sys.onMove(p, { dir: Dir.E, seq: 1 });
    run(TICK_MS);
    expect(p.stepMs).toBe(STEP);
  });

  it("diagonals scale too", () => {
    const { sys, add, run } = setup(G3, { groundSpeed: TERRAIN });
    const p = add(player("a", 6, 0));
    sys.onMove(p, { dir: Dir.SE, seq: 1 });
    run(TICK_MS);
    expect(p).toMatchObject({ x: 7, y: 1, stepMs: stepDuration(1, Dir.SE, 150) });
    expect(p.stepMs).toBe(Math.round((DIAG * 150) / 100));
  });
});
