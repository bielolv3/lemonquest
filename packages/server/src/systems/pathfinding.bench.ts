// Benchmark manual (não roda no `npm test`): npx tsx packages/server/src/systems/pathfinding.bench.ts
import { findPath, type WalkGrid } from "./pathfinding.ts";

// Mapa do tamanho do real (160×288) com obstáculos pseudoaleatórios fixos.
const W = 160, H = 288;
const walk = new Uint8Array(W * H).map((_, i) => ((i * 2654435761) >>> 0) % 7 === 0 ? 0 : 1);
const grid: WalkGrid = { width: W, height: H, isWalkable: (x, y) => x >= 0 && y >= 0 && x < W && y < H && walk[y * W + x] === 1 };

const cases: [number, number, number, number][] = [];
for (let i = 0; i < 200; i++) {
  const x = 20 + (i * 37) % 120, y = 20 + (i * 53) % 240;
  cases.push([x, y, Math.min(W - 1, x + ((i * 7) % 12) - 6 + 8), Math.min(H - 1, y + ((i * 11) % 12) - 3)]);
}
const run = () => { let n = 0; for (const [a, b, c, d] of cases) n += findPath(grid, { x: a, y: b }, { x: c, y: d })?.length ?? 0; return n; };
for (let i = 0; i < 20; i++) run(); // aquecimento
const rounds = 200;
const heap0 = process.memoryUsage().heapUsed;
const t0 = performance.now();
let total = 0;
for (let i = 0; i < rounds; i++) total += run();
const ms = performance.now() - t0;
console.log(`${(ms / (rounds * cases.length) * 1000).toFixed(1)} µs/caminho (${rounds * cases.length} buscas, soma ${total}); heap Δ ${((process.memoryUsage().heapUsed - heap0) / 1e6).toFixed(1)} MB`);
