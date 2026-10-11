#!/usr/bin/env node
// Gera assets/maps/world.json — mapa PLACEHOLDER (60x60) para testar movimento/render.
// Será substituído pelo mapa real. Uso: node tools/gen-placeholder-map.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "assets/maps/world.json");

const W = 60, H = 60, T = 16;

// tileset_floor.png: 352x417 → 22 colunas; altura não é múltipla de 16 → 26 linhas inteiras.
const TS = { cols: 22, imgW: 352, imgH: 417 };
TS.rows = Math.floor(TS.imgH / T);
TS.count = TS.rows * TS.cols;

// Índices (0-based) escolhidos olhando a imagem; gid = índice + 1.
const TILE = {
  grass: 275,
  grassTufts: [276, 277, 278, 279],
  dirt: 218,
  water: 511,   // azul claro (bloco "gelo/água")
  rock: 372,    // pedra marrom escura (borda e obstáculos)
  boulder: 254, // pedregulho sobre terra
};
const gid = (i) => i + 1;

// PRNG determinístico (mulberry32) para o mapa não mudar a cada execução.
let seed = 1337;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const layer = () => new Array(W * H).fill(0);
const ground = layer(), deco = layer(), above = layer(), collision = layer();
const idx = (x, y) => y * W + x;
const set = (l, x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) l[idx(x, y)] = v; };

const spawn = { x: 30, y: 30 };

// 1) Grama com tufos esparsos.
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const r = rand();
  ground[idx(x, y)] = gid(r < 0.08 ? TILE.grassTufts[Math.floor(rand() * 4)] : TILE.grass);
}

// 2) Caminhos de terra em cruz passando pelo spawn + praça 5x5.
for (let i = 2; i < W - 2; i++) {
  for (const o of [0, 1]) { set(ground, i, spawn.y + o, gid(TILE.dirt)); set(ground, spawn.x + o, i, gid(TILE.dirt)); }
}
for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) set(ground, spawn.x + x, spawn.y + y, gid(TILE.dirt));

// 3) Lago (elipse) a nordeste.
const pond = { cx: 44, cy: 14, rx: 7, ry: 5 };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const d = ((x - pond.cx) / pond.rx) ** 2 + ((y - pond.cy) / pond.ry) ** 2;
  if (d <= 1) { set(ground, x, y, gid(TILE.water)); set(collision, x, y, 1); }
}

// 4) Borda de pedra.
for (let i = 0; i < W; i++) {
  for (const [x, y] of [[i, 0], [i, H - 1], [0, i], [W - 1, i]]) { set(ground, x, y, gid(TILE.rock)); set(collision, x, y, 1); }
}

// 5) Obstáculos: blocos de pedra, um muro em L (para testar A*) e pedregulhos soltos.
const rock = (x, y) => { set(ground, x, y, gid(TILE.rock)); set(collision, x, y, 1); };
for (const [bx, by] of [[12, 12], [20, 44], [46, 40], [38, 24]]) {
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) rock(bx + x, by + y);
}
for (let x = 14; x <= 24; x++) rock(x, 20);      // muro horizontal
for (let y = 20; y <= 27; y++) rock(14, y);       // perna vertical do L
for (let y = 36; y <= 46; y++) if (y !== 41) rock(40, y); // muro com uma passagem
for (let n = 0; n < 25; n++) {
  const x = 3 + Math.floor(rand() * (W - 6)), y = 3 + Math.floor(rand() * (H - 6));
  const nearSpawn = Math.abs(x - spawn.x) <= 4 && Math.abs(y - spawn.y) <= 4;
  const onPath = x === spawn.x || x === spawn.x + 1 || y === spawn.y || y === spawn.y + 1;
  if (nearSpawn || onPath || collision[idx(x, y)]) continue;
  set(ground, x, y, gid(TILE.boulder)); set(collision, x, y, 1);
}

const tileLayer = (id, name, data, visible = true) => ({
  id, name, type: "tilelayer", width: W, height: H, x: 0, y: 0, opacity: 1, visible, data,
});

const map = {
  type: "map",
  version: "1.10",
  tiledversion: "1.11.2",
  orientation: "orthogonal",
  renderorder: "right-down",
  infinite: false,
  compressionlevel: -1,
  width: W,
  height: H,
  tilewidth: T,
  tileheight: T,
  nextlayerid: 6,
  nextobjectid: 2,
  properties: [{ name: "placeholder", type: "bool", value: true }],
  tilesets: [{
    firstgid: 1,
    name: "tileset_floor",
    image: "../ninja-adventure/content/map/tileset_floor.png",
    imagewidth: TS.imgW,
    imageheight: TS.imgH,
    tilewidth: T,
    tileheight: T,
    columns: TS.cols,
    tilecount: TS.count,
    margin: 0,
    spacing: 0,
  }],
  layers: [
    tileLayer(1, "ground", ground),
    tileLayer(2, "deco", deco),
    tileLayer(3, "above", above),
    tileLayer(4, "collision", collision, false),
    {
      id: 5, name: "objects", type: "objectgroup", draworder: "topdown", x: 0, y: 0, opacity: 1, visible: true,
      objects: [{
        id: 1, name: "temple", type: "spawn_player", point: true, rotation: 0, visible: true,
        x: spawn.x * T + T / 2, y: spawn.y * T + T / 2, width: 0, height: 0,
      }],
    },
  ],
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(map));
console.log(`wrote ${path.relative(root, out)} (${W}x${H}, spawn ${spawn.x},${spawn.y})`);
