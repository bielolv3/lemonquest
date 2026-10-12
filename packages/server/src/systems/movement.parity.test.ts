// Paridade predição × servidor: o Predictor do cliente e o MovementSystem do servidor, com a MESMA grade
// de colisão e de velocidade do chão, precisam produzir exatamente os mesmos passos (posição, duração e
// instante de término) — senão o cliente "corrige" a cada mudança de terreno.
import { describe, expect, it } from "vitest";
import { CollisionGrid, Dir, GroundSpeedGrid, TICK_MS, type TiledMap } from "@lemonquest/shared";
import type { PlayerState } from "../state.ts";
import { MovementSystem } from "./movement.ts";
import { Predictor } from "../../../client/src/game/predictor.ts";

/** Mapa Tiled mínimo: estrada (85), grama (sem prop), lama (150), arbusto deco (115), parede. */
function tiledMap(): TiledMap {
  const rows = [
    "RRRRGGGGMMMMGGGG",
    "RRRRGGGGMMMMGGGG",
    "RRRRGGbGMMMMGGGG",
    "RRRRGGGGMMMM#GGG",
    "GGGGGGGGGGGGGGGG",
  ];
  const w = rows[0].length, h = rows.length;
  const gid: Record<string, number> = { R: 1, G: 2, M: 3, b: 2, "#": 2 };
  const ground: number[] = [], deco: number[] = [], coll: number[] = [];
  for (const r of rows) for (const c of r) { ground.push(gid[c]); deco.push(c === "b" ? 4 : 0); coll.push(c === "#" ? 1 : 0); }
  const sp = (v: number) => [{ name: "speed", type: "int", value: v }];
  return {
    width: w, height: h, tilewidth: 16, tileheight: 16,
    tilesets: [
      { firstgid: 1, name: "floor", tilecount: 3, tiles: [{ id: 0, properties: sp(85) }, { id: 2, properties: sp(150) }] },
      { firstgid: 4, name: "deco", tilecount: 1, tiles: [{ id: 0, properties: sp(115) }] },
    ],
    layers: [
      { name: "ground", type: "tilelayer", width: w, height: h, data: ground },
      { name: "deco", type: "tilelayer", width: w, height: h, data: deco },
      { name: "collision", type: "tilelayer", width: w, height: h, data: coll },
    ],
  };
}

interface Step { x: number; y: number; ms: number; endsAt: number }

describe("Predictor ⇄ MovementSystem parity over mixed terrain", () => {
  it("identical step positions, durations and end times; zero corrections", () => {
    const tiled = tiledMap();
    const grid = CollisionGrid.fromTiled(tiled);
    const groundSpeed = GroundSpeedGrid.fromTiled(tiled);

    let clock = 10_000;
    const sys = new MovementSystem(grid, { now: () => clock, groundSpeed });
    const p = { id: "me", name: "me", vocation: "knight", level: 7, x: 0, y: 1, dir: Dir.S, stepMs: 0, seq: 0 } as unknown as PlayerState;
    sys.addPlayer(p);
    const mover = () => (sys as unknown as { movers: Map<string, { stepEndsAt: number }> }).movers.get("me")!;

    const pred = new Predictor({ grid, spawn: null, groundSpeed, isOccupied: () => false });
    pred.level = p.level;
    pred.reset(p.x, p.y, p.dir);

    const client: Step[] = [], server: Step[] = [];
    const reconciles: string[] = [];
    const clientUpdate = () => {
      const ev = pred.update(clock);
      if (ev?.kind === "step") client.push({ x: ev.x, y: ev.y, ms: ev.ms, endsAt: pred.stepEndsAt });
    };
    // Patches do servidor chegam ao cliente com latência de rede (como na vida real).
    const LATENCY = 40;
    const inflight: { at: number; x: number; y: number; ms: number }[] = [];
    let last = { x: p.x, y: p.y };
    const serverObserve = () => {
      if (p.x === last.x && p.y === last.y) return;
      last = { x: p.x, y: p.y };
      server.push({ x: p.x, y: p.y, ms: p.stepMs, endsAt: mover().stepEndsAt });
      inflight.push({ at: clock + LATENCY, x: p.x, y: p.y, ms: p.stepMs });
    };
    const deliver = () => {
      while (inflight.length && inflight[0].at <= clock) {
        const m = inflight.shift()!;
        reconciles.push(pred.onServerPos(m.x, m.y, m.ms, clock).kind);
      }
    };
    let seq = 0;
    // Mesma ordem da WorldScene.onInputDir. Input chega ao servidor no mesmo instante: é o pior caso para a
    // paridade (com latência de ida o servidor só fica mais atrasado, e o encadeamento absorve até 1 tick).
    const input = (d: Dir | null) => {
      clientUpdate();
      if (d === null) pred.release(); else pred.press(d);
      clientUpdate();
      sys.onMove(p, { dir: d, seq: ++seq });
      serverObserve();
    };

    // Roteiro (teclas trocadas no meio dos passos): estrada → grama → diagonal até o arbusto (deco 115) →
    // lama → desce contornando a parede → diagonal de volta para a lama → oeste pela lama, grama e estrada.
    const script: [number, Dir | null][] = [
      [0, Dir.E], [1000, Dir.SE], [1300, Dir.E], [3900, Dir.S], [4500, Dir.W], [5000, Dir.NW], [5300, Dir.W], [9000, null],
    ];
    const t0 = clock;
    let next = 0;
    for (let t = 0; t <= 12_000; t++) {
      clock = t0 + t;
      while (next < script.length && script[next][0] === t) input(script[next++][1]);
      deliver();
      if (t % 16 === 0) clientUpdate();          // ~60 fps
      if (t % TICK_MS === 0) { sys.tick(clock, [p]); serverObserve(); }
    }

    expect(client.length).toBeGreaterThanOrEqual(15);
    expect(server).toEqual(client);
    expect(reconciles.every((k) => k === "confirmed")).toBe(true);
    // O roteiro realmente cruzou todos os terrenos (passo saindo de cada um, incl. o arbusto em 6,2):
    const fromSpeeds = new Set<number>();
    let prev = { x: 0, y: 1 };
    for (const s of client) { fromSpeeds.add(groundSpeed.speedAt(prev.x, prev.y)); prev = s; }
    expect([...fromSpeeds].sort((a, b) => a - b)).toEqual([85, 100, 115, 150]);
    expect(client.some((s) => s.x === 6 && s.y === 2)).toBe(true);
    expect(new Set(client.map((s) => s.ms)).size).toBeGreaterThanOrEqual(5);
  });
});
