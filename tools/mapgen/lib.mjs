// Shared helpers for the Tibinha map generator: RNG/noise, tileset registry, layer grid, autotile, stamps, preview renderer.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const repo = path.resolve(here, '../..');
export const TILESET_DIR = path.join(repo, 'assets/ninja/Backgrounds/Tilesets');
export const MAPS_DIR = path.join(repo, 'assets/maps');

// ---------------------------------------------------------------- RNG + noise
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** smooth value noise in [0,1], feature size `scale` tiles */
export function noise2(x, y, scale, seed = 1) {
  const fx = x / scale, fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed), c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
export const fbm = (x, y, scale, seed = 1) => 0.6 * noise2(x, y, scale, seed) + 0.28 * noise2(x, y, scale / 2, seed + 7) + 0.12 * noise2(x, y, scale / 4, seed + 13);

// ---------------------------------------------------------------- tilesets
// name -> file (relative to TILESET_DIR)
export const TILESET_FILES = [
  ['TilesetFloor', 'TilesetFloor.png'],
  ['TilesetWater', 'TilesetWater.png'],
  ['TilesetNature', 'TilesetNature.png'],
  ['TilesetHouse', 'TilesetHouse.png'],
  ['TilesetRelief', 'TilesetRelief.png'],
  ['TilesetReliefDetail', 'TilesetReliefDetail.png'],
  ['TilesetHole', 'TilesetHole.png'],
  ['TilesetFloorDetail', 'TilesetFloorDetail.png'],
  ['TilesetVillageAbandoned', 'TilesetVillageAbandoned.png'],
  ['TilesetDungeon', 'TilesetDungeon.png'],
  ['TilesetElement', 'TilesetElement.png'],
  ['TilesetInteriorFloor', 'Interior/TilesetInteriorFloor.png'],
];

export class Tilesets {
  constructor() {
    this.list = [];
    this.byName = {};
    let gid = 1;
    for (const [name, file] of TILESET_FILES) {
      const png = PNG.sync.read(fs.readFileSync(path.join(TILESET_DIR, file)));
      const columns = Math.floor(png.width / 16);
      const tilecount = columns * Math.floor(png.height / 16);
      const ts = { name, file, png, firstgid: gid, columns, tilecount, imagewidth: png.width, imageheight: png.height };
      this.list.push(ts);
      this.byName[name] = ts;
      gid += tilecount;
    }
    this.short = { F: 'TilesetFloor', W: 'TilesetWater', N: 'TilesetNature', H: 'TilesetHouse', R: 'TilesetRelief', D: 'TilesetReliefDetail', O: 'TilesetHole', FD: 'TilesetFloorDetail', V: 'TilesetVillageAbandoned', G: 'TilesetDungeon', E: 'TilesetElement', I: 'TilesetInteriorFloor' };
  }
  gid(ts, col, row) {
    const t = this.byName[this.short[ts] ?? ts];
    if (!t) throw new Error('unknown tileset ' + ts);
    if (col < 0 || col >= t.columns || row < 0 || row * t.columns + col >= t.tilecount) throw new Error(`tile out of range ${ts} ${col},${row}`);
    return t.firstgid + row * t.columns + col;
  }
  /** is the 16x16 tile completely transparent? */
  isEmpty(ts, col, row) {
    const t = this.byName[this.short[ts] ?? ts];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const i = ((row * 16 + y) * t.imagewidth + col * 16 + x) * 4 + 3;
      if (t.png.data[i] > 8) return false;
    }
    return true;
  }
  locate(gid) {
    for (let i = this.list.length - 1; i >= 0; i--) if (gid >= this.list[i].firstgid) {
      const t = this.list[i];
      const id = gid - t.firstgid;
      return { t, col: id % t.columns, row: Math.floor(id / t.columns) };
    }
    return null;
  }
  json() {
    return this.list.map((t) => ({
      firstgid: t.firstgid, name: t.name, image: '../ninja/Backgrounds/Tilesets/' + t.file,
      imagewidth: t.imagewidth, imageheight: t.imageheight, tilewidth: 16, tileheight: 16,
      columns: t.columns, tilecount: t.tilecount, margin: 0, spacing: 0,
    }));
  }
}

// ---------------------------------------------------------------- autotile (47-blob, Godot terrain data from the pack)
const MASK_NAMES = ['top_side', 'top_right_corner', 'right_side', 'bottom_right_corner', 'bottom_side', 'bottom_left_corner', 'left_side', 'top_left_corner'];
let _blob = null;
export function blobTable() {
  if (_blob) return _blob;
  const t = JSON.parse(fs.readFileSync(path.join(here, 'floor-terrain.json'), 'utf8'));
  const table = {};
  for (const [k, v] of Object.entries(t)) {
    if (v.terrain !== 1) continue;
    const mask = MASK_NAMES.map((n) => (v.bits[n] === 1 ? 1 : 0)).join('');
    const [c, r] = k.split(',').map(Number);
    if (!table[mask]) table[mask] = [c, r];
  }
  if (Object.keys(table).length !== 47) throw new Error('blob table incomplete: ' + Object.keys(table).length);
  _blob = table;
  return table;
}
export function blobMask(inside, x, y) {
  const n = inside(x, y - 1), e = inside(x + 1, y), s = inside(x, y + 1), w = inside(x - 1, y);
  const ne = n && e && inside(x + 1, y - 1), se = s && e && inside(x + 1, y + 1), sw = s && w && inside(x - 1, y + 1), nw = n && w && inside(x - 1, y - 1);
  return [n, ne, e, se, s, sw, w, nw].map((b) => (b ? 1 : 0)).join('');
}

// ---------------------------------------------------------------- map grid
export class GameMap {
  constructor(w, h, ts) {
    this.w = w; this.h = h; this.ts = ts;
    this.layers = { ground: new Int32Array(w * h), deco: new Int32Array(w * h), above: new Int32Array(w * h), collision: new Int32Array(w * h) };
    this.objects = [];
    this.nextId = 1;
    this.occ = new Uint8Array(w * h); // 1 = reserved/occupied by structures (no scattering)
    // gid used for collision cells: any non-zero; use first tile of Logic-like tileset (Floor 0,0)
    this.blockGid = ts.gid('F', 0, 0);
  }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  idx(x, y) { return y * this.w + x; }
  set(layer, x, y, gid) { if (this.inb(x, y)) this.layers[layer][this.idx(x, y)] = gid; }
  get(layer, x, y) { return this.inb(x, y) ? this.layers[layer][this.idx(x, y)] : 0; }
  put(layer, x, y, ts, c, r) { this.set(layer, x, y, this.ts.gid(ts, c, r)); }
  block(x, y, v = true) { if (this.inb(x, y)) this.layers.collision[this.idx(x, y)] = v ? this.blockGid : 0; }
  blocked(x, y) { return !this.inb(x, y) || this.layers.collision[this.idx(x, y)] !== 0; }
  reserve(x, y, w = 1, h = 1) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (this.inb(x + i, y + j)) this.occ[this.idx(x + i, y + j)] = 1; }
  isFree(x, y, w = 1, h = 1) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { if (!this.inb(x + i, y + j) || this.occ[this.idx(x + i, y + j)]) return false; } return true; }

  /**
   * Stamp a rectangular block of tiles from one tileset. Fully transparent source tiles are skipped.
   * opts: baseRows = number of bottom rows that go to "deco" (+collision); rest goes to "above".
   *       solid(col,row) -> bool override for collision; allAbove: everything to above; allDeco; doors: [[dx,dy]...] not blocked
   */
  stamp(ts, c0, r0, w, h, x, y, opts = {}) {
    const { baseRows = 1, collide = true, doors = [], layerAll = null, reserve = true } = opts;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (this.ts.isEmpty(ts, c0 + i, r0 + j)) continue;
      const tx = x + i, ty = y + j;
      const isBase = j >= h - baseRows;
      const layer = layerAll ?? (isBase ? 'deco' : 'above');
      this.put(layer, tx, ty, ts, c0 + i, r0 + j);
      const isDoor = doors.some(([dx, dy]) => dx === i && dy === j);
      if (collide && !isDoor && (layerAll ? true : isBase || opts.blockAll)) this.block(tx, ty);
    }
    if (reserve) this.reserve(x, y, w, h);
  }

  addObject(o) {
    const obj = { id: this.nextId++, name: o.name ?? o.type, type: o.type, class: o.type, x: o.x, y: o.y, width: o.width ?? 0, height: o.height ?? 0, rotation: 0, visible: true };
    if (!o.rect) obj.point = true;
    if (o.props) obj.properties = Object.entries(o.props).map(([name, value]) => ({ name, type: typeof value === 'number' ? 'int' : 'string', value }));
    this.objects.push(obj);
    return obj;
  }
  tileObj(type, tx, ty, props, name) { return this.addObject({ type, name, x: tx * 16, y: ty * 16, props }); }

  toTiled() {
    const layer = (name, id) => ({ id, name, type: 'tilelayer', x: 0, y: 0, width: this.w, height: this.h, opacity: 1, visible: true, data: Array.from(this.layers[name]) });
    return {
      compressionlevel: -1, height: this.h, width: this.w, infinite: false, orientation: 'orthogonal', renderorder: 'right-down',
      tiledversion: '1.10.2', version: '1.10', type: 'map', tilewidth: 16, tileheight: 16, nextlayerid: 6, nextobjectid: this.nextId,
      tilesets: this.ts.json(),
      layers: [layer('ground', 1), layer('deco', 2), layer('above', 3), layer('collision', 4),
        { id: 5, name: 'objects', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects: this.objects }],
    };
  }
}

// ---------------------------------------------------------------- BFS
/** 4-connected BFS over non-blocked tiles; portals: Map "x,y" -> [tx,ty]. Returns Uint8Array reached. */
export function bfs(map, sx, sy, portals = new Map(), extraBlocked = new Set()) {
  const seen = new Uint8Array(map.w * map.h);
  const q = [[sx, sy]];
  seen[map.idx(sx, sy)] = 1;
  while (q.length) {
    const [x, y] = q.pop();
    const push = (nx, ny) => {
      if (!map.inb(nx, ny) || seen[map.idx(nx, ny)]) return;
      if (map.blocked(nx, ny) && !extraBlocked.has(nx + ',' + ny)) return;
      seen[map.idx(nx, ny)] = 1; q.push([nx, ny]);
    };
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
    const p = portals.get(x + ',' + y);
    if (p) push(p[0], p[1]);
  }
  return seen;
}

// ---------------------------------------------------------------- preview renderer
export function renderPreview(map, outPath, { scale = 16, layers = ['ground', 'deco', 'above'], collisionOverlay = false, objectsOverlay = false } = {}) {
  const W = map.w * 16, H = map.h * 16;
  const full = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) { full[i * 4 + 3] = 255; }
  const blit = (gid, tx, ty) => {
    const loc = map.ts.locate(gid); if (!loc) return;
    const { t, col, row } = loc;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const si = ((row * 16 + y) * t.imagewidth + col * 16 + x) * 4;
      const a = t.png.data[si + 3]; if (!a) continue;
      const di = ((ty * 16 + y) * W + tx * 16 + x) * 4;
      if (a === 255) { full[di] = t.png.data[si]; full[di + 1] = t.png.data[si + 1]; full[di + 2] = t.png.data[si + 2]; }
      else { const k = a / 255; for (let c = 0; c < 3; c++) full[di + c] = Math.round(t.png.data[si + c] * k + full[di + c] * (1 - k)); }
    }
  };
  for (const ln of layers) for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) { const g = map.layers[ln][y * map.w + x]; if (g) blit(g, x, y); }
  if (collisionOverlay) for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (map.layers.collision[y * map.w + x]) {
    for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { const di = ((y * 16 + j) * W + x * 16 + i) * 4; full[di] = Math.min(255, full[di] * 0.6 + 100); full[di + 1] *= 0.6; full[di + 2] *= 0.6; }
  }
  if (objectsOverlay) {
    const col = { spawn_player: [0, 255, 0], npc: [0, 200, 255], monster_spawn: [255, 0, 0], portal: [255, 0, 255] };
    for (const o of map.objects) {
      const c = col[o.type]; if (!c) continue;
      const tx = Math.floor(o.x / 16), ty = Math.floor(o.y / 16);
      for (let j = 3; j < 13; j++) for (let i = 3; i < 13; i++) { const di = ((ty * 16 + j) * W + tx * 16 + i) * 4; full[di] = c[0]; full[di + 1] = c[1]; full[di + 2] = c[2]; }
    }
  }
  const png = new PNG({ width: W, height: H });
  png.data = Buffer.from(full);
  if (scale === 16) { fs.writeFileSync(outPath, PNG.sync.write(png, { colorType: 2, deflateLevel: 9 })); return { W, H }; }
  // box-downscale to `scale` px per tile
  const f = 16 / scale, w2 = map.w * scale, h2 = map.h * scale;
  const out = new PNG({ width: w2, height: h2 });
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) { const si = ((y * f + j) * W + x * f + i) * 4; r += full[si]; g += full[si + 1]; b += full[si + 2]; n++; }
    const di = (y * w2 + x) * 4; out.data[di] = r / n; out.data[di + 1] = g / n; out.data[di + 2] = b / n; out.data[di + 3] = 255;
  }
  fs.writeFileSync(outPath, PNG.sync.write(out, { colorType: 2, deflateLevel: 9 }));
  return { W: w2, H: h2 };
}

/** crop helper for review: tile rect of the full-res render -> png (optionally upscaled) */
export function cropPng(srcPath, outPath, tx, ty, tw, th, up = 1) {
  const src = PNG.sync.read(fs.readFileSync(srcPath));
  const w = tw * 16 * up, h = th * 16 * up;
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = tx * 16 + Math.floor(x / up), sy = ty * 16 + Math.floor(y / up);
    const si = (sy * src.width + sx) * 4, di = (y * w + x) * 4;
    out.data[di] = src.data[si]; out.data[di + 1] = src.data[si + 1]; out.data[di + 2] = src.data[si + 2]; out.data[di + 3] = 255;
  }
  fs.writeFileSync(outPath, PNG.sync.write(out));
}
