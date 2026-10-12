// "TilesetLemon": the generated terrain-art tileset of The Lemon Quest (swamp / ruins / dungeon dressing + zone-seam blends).
// Drawn in code in the Ninja Adventure style (16x16, 1px dark outline #141b1b, same palette family as the CC0 pack) and
// appended as the LAST tileset of world.json (image: assets/tiles/lemon-terrain.png), so all pack gids stay stable.
// Everything is deterministic. Tiles are allocated on demand (blend/overlay variants), the atlas is cropped to the used rows.
import { mulberry32 } from './lib.mjs';

export const COLS = 16, CAP_ROWS = 160;
const hexc = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const rgb = (c) => (typeof c === 'string' ? hexc(c) : c);
export const OL = '#141b1b';

/** tiny RGBA canvas */
export class Cv {
  constructor(w = 16, h = 16) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  ok(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, c, a = 255) { x = Math.round(x); y = Math.round(y); if (!this.ok(x, y)) return; const [r, g, b] = rgb(c); const i = (y * this.w + x) * 4; this.d[i] = r; this.d[i + 1] = g; this.d[i + 2] = b; this.d[i + 3] = a; }
  /** source-over blend */
  over(x, y, c, a) {
    x = Math.round(x); y = Math.round(y); if (!this.ok(x, y) || a <= 0) return; const [r, g, b] = rgb(c); const i = (y * this.w + x) * 4;
    const da = this.d[i + 3] / 255, sa = a / 255, oa = sa + da * (1 - sa);
    for (let k = 0; k < 3; k++) this.d[i + k] = ([r, g, b][k] * sa + this.d[i + k] * da * (1 - sa)) / oa;
    this.d[i + 3] = oa * 255;
  }
  get(x, y) { if (!this.ok(x, y)) return [0, 0, 0, 0]; const i = (y * this.w + x) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]; }
  solid(x, y) { return this.ok(x, y) && this.d[(y * this.w + x) * 4 + 3] >= 200; }
  clear(x, y) { if (this.ok(x, y)) this.d[(y * this.w + x) * 4 + 3] = 0; }
  rect(x, y, w, h, c, a = 255) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a); }
  ell(cx, cy, rx, ry, c, a = 255) { for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.set(x, y, c, a); }
  line(x0, y0, x1, y1, c, a = 255) { x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy; for (;;) { this.set(x0, y0, c, a); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } }
  /** 1px outline on transparent pixels that touch a solid one (4-neighbourhood) */
  outline(c = OL) { const add = []; for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { if (this.d[(y * this.w + x) * 4 + 3] >= 40) continue; if (this.solid(x + 1, y) || this.solid(x - 1, y) || this.solid(x, y + 1) || this.solid(x, y - 1)) add.push([x, y]); } for (const [x, y] of add) this.set(x, y, c); return this; }
  paste(o, ox, oy) { for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) { const [r, g, b, a] = o.get(x, y); if (a) this.over(ox + x, oy + y, [r, g, b], a); } }
  slice(tx, ty) { const o = new Cv(16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const [r, g, b, a] = this.get(tx * 16 + x, ty * 16 + y); if (a) { o.set(x, y, [r, g, b], a); } } return o; }
  /** radial glow (alpha-blended) */
  glow(cx, cy, r, c, a0 = 70) { for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r; if (d < 1) this.over(x, y, c, a0 * (1 - d) ** 1.4); } }
}

export class LemonSet {
  constructor() {
    this.columns = COLS; this.capacity = COLS * CAP_ROWS; this.used = 0;
    this.png = { width: COLS * 16, height: CAP_ROWS * 16, data: new Uint8Array(COLS * 16 * CAP_ROWS * 16 * 4) };
    this.keys = new Map(); this.props = new Map();
  }
  /** allocate (or fetch) a tile by key; returns the local tile id */
  add(key, draw, props) {
    if (this.keys.has(key)) return this.keys.get(key);
    if (this.used >= this.capacity) throw new Error('lemon atlas full');
    const id = this.used++; this.keys.set(key, id);
    const cv = typeof draw === 'function' ? draw() : draw;
    const cx = (id % COLS) * 16, cy = Math.floor(id / COLS) * 16, W = this.png.width;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const [r, g, b, a] = cv.get(x, y); const i = ((cy + y) * W + cx + x) * 4; this.png.data[i] = r; this.png.data[i + 1] = g; this.png.data[i + 2] = b; this.png.data[i + 3] = a; }
    if (props) this.props.set(id, props);
    return id;
  }
  croppedPng() { const rows = Math.ceil(this.used / COLS); return { width: this.png.width, height: rows * 16, data: this.png.data.subarray(0, this.png.width * rows * 16 * 4) }; }
}

// ===================================================================== art
const P = {
  ol: OL, g1: '#adbc3a', g2: '#74a334', g3: '#4a7f4b', g4: '#345a52',
  w1: '#e9c48f', w2: '#c69469', w3: '#965746', w4: '#7b473c', w5: '#433737',
  s1: '#e8d9aa', s2: '#d2b37d', s3: '#c8966b', s4: '#a37a56', s5: '#7a5c44',
  m1: '#a8a129', m2: '#74a334',
  c1: '#d6d3c4', c2: '#8d977f', c3: '#5f7160', c4: '#4e484a',
  bone: '#f2eaf1', bone2: '#d6d3c4', bone3: '#a9a597',
  fire1: '#e66a3a', fire2: '#ffad5d', fire3: '#ffe9a0', red: '#d14b34', red2: '#8a1c24',
};

function hashf(x, y, s = 0) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }

function reed(seed) {
  const r = mulberry32(seed), cv = new Cv(); const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x = 2 + Math.floor((i + 0.2 + r() * 0.6) * (12 / n)), h = 8 + Math.floor(r() * 6), lean = r() < 0.45 ? (r() < 0.5 ? -1 : 1) : 0;
    for (let k = 0; k < h; k++) { const xx = x + (lean && k > h * 0.55 ? lean : 0); cv.set(xx, 15 - k, k % 3 === 2 ? P.g2 : P.g3); }
    const hx = x + lean, hy = 15 - h;
    if (r() < 0.8) { cv.rect(hx - 1, hy - 3, 2, 4, P.w4); cv.set(hx - 1, hy - 3, P.w3); cv.set(hx, hy - 4, P.w2); cv.set(hx - 1, hy, P.w5); } else { cv.set(hx, hy - 1, P.g2); cv.set(hx - lean, hy - 2, P.g2); }
    // a leaf blade
    const d = r() < 0.5 ? -1 : 1, ly = 15 - Math.floor(h * 0.4);
    cv.line(x, ly, x + d * 3, ly - 3, P.g2); cv.line(x + d, ly, x + d * 3, ly - 2, P.g3);
  }
  for (let x = 1; x < 15; x++) if (r() < 0.6) cv.set(x, 15, P.g4);
  return cv;
}

function lily(seed, flower) {
  const r = mulberry32(seed), cv = new Cv();
  const pads = flower ? [[8, 8, 5, 3.4]] : [[5, 5, 4, 2.7], [11, 10, 4.5, 3]];
  for (const [cx, cy, rx, ry] of pads) {
    cv.ell(cx, cy, rx + 0.8, ry + 0.8, P.g4); cv.ell(cx, cy, rx, ry, P.g2); cv.ell(cx - 0.6, cy - 0.5, rx * 0.6, ry * 0.55, P.g1);
    const a = r() * Math.PI * 2; for (let t = 0; t < rx + 2; t += 0.5) { const px = cx + Math.cos(a) * t, py = cy + Math.sin(a) * t * (ry / rx); cv.clear(Math.round(px), Math.round(py)); cv.clear(Math.round(px), Math.round(py) + (Math.sin(a) > 0.3 ? 0 : 0)); }
  }
  if (flower) { cv.set(7, 6, '#ef9597'); cv.set(8, 5, '#ef9597'); cv.set(9, 6, '#ef9597'); cv.set(8, 7, '#ef9597'); cv.set(7, 7, '#f2eaf1'); cv.set(9, 7, '#f2eaf1'); cv.set(8, 6, '#ffbc75'); cv.set(8, 8, '#f2eaf1'); }
  return cv;
}

const GLOW = {
  cyan: { c: ['#d4f5ff', '#79b8ce', '#548789'], g: '#7fe8ff' },
  violet: { c: ['#f0d8ff', '#b080d8', '#7a4fa8'], g: '#c890ff' },
  lime: { c: ['#f2ffb0', '#a8d050', '#6aa030'], g: '#c8ff70' },
  amber: { c: ['#fff0b0', '#ffbc75', '#e66a3a'], g: '#ffc060' },
};
function glowShroom(kind, seed) {
  const { c, g } = GLOW[kind], r = mulberry32(seed), cv = new Cv(); cv.glow(8, 9, 8.5, g, 80);
  const caps = [[8, 10, 4, 3, 5], [4, 12, 2.4, 2, 3], [12, 12.5, 2.2, 1.8, 3]];
  for (const [cx, cy, rx, ry, st] of caps) {
    const x = Math.round(cx); cv.rect(x - 1, Math.round(cy), 2, st, '#e8dcc0'); cv.set(x - 1, Math.round(cy) + st - 1, P.bone3);
    cv.ell(cx, cy, rx + 0.6, ry + 0.6, OL); cv.ell(cx, cy, rx, ry, c[1]); cv.rect(Math.round(cx - rx), Math.round(cy), Math.round(rx * 2), 1, c[2]);
    cv.set(Math.round(cx - rx * 0.4), Math.round(cy - ry * 0.5), c[0]); cv.set(Math.round(cx + rx * 0.3), Math.round(cy - ry * 0.3), c[0]); if (rx > 3) cv.set(Math.round(cx), Math.round(cy - ry * 0.7), c[0]);
  }
  return cv;
}
function shroom(kind, seed) {
  const r = mulberry32(seed), cv = new Cv();
  const capc = kind === 'red' ? [P.red, '#f2eaf1', P.red2] : [P.w2, P.w1, P.w3];
  const caps = r() < 0.5 ? [[7, 9, 4.5, 3.2, 4], [12, 12, 2.5, 2, 3]] : [[6, 10, 3.2, 2.6, 4], [11, 9, 4.2, 3, 5], [3, 13, 2, 1.6, 2]];
  for (const [cx, cy, rx, ry, st] of caps) {
    const x = Math.round(cx); cv.rect(x - 1, Math.round(cy), 2, st, '#e8dcc0'); cv.set(x, Math.round(cy) + st - 1, P.bone3);
    cv.ell(cx, cy, rx + 0.6, ry + 0.6, OL); cv.ell(cx, cy, rx, ry, capc[0]); cv.rect(Math.round(cx - rx), Math.round(cy), Math.round(rx * 2), 1, capc[2]);
    cv.set(Math.round(cx - rx * 0.4), Math.round(cy - ry * 0.5), capc[1]); cv.set(Math.round(cx + rx * 0.35), Math.round(cy - ry * 0.2), capc[1]); if (rx > 3.5) cv.set(Math.round(cx + 1), Math.round(cy - ry * 0.8), capc[1]);
  }
  return cv;
}

function darkTuft(seed) {
  const r = mulberry32(seed), cv = new Cv(); const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x = 2 + Math.floor((i + r() * 0.7) * (12 / n)), h = 4 + Math.floor(r() * 5), lean = Math.floor(r() * 3) - 1;
    for (let k = 0; k < h; k++) { const xx = x + Math.round(lean * k / 3); cv.set(xx, 14 - k, k > h - 2 ? '#8aa24a' : k % 2 ? '#5f7d33' : '#4a6a2c'); }
  }
  for (let x = 2; x < 14; x++) if (r() < 0.7) cv.set(x, 14, '#3a5428');
  return cv;
}

function planks(dir, kind, seed) {
  // dir 'h' = walkway running east-west, 'v' = north-south. kind: mid | cap1 | cap2 (cap1 = start end, cap2 = finish end)
  const cv = new Cv(), r = mulberry32(seed);
  const horiz = dir === 'h';
  const put = (a, b, c, al = 255) => (horiz ? cv.set(a, b, c, al) : cv.set(b, a, c, al)); // a along the walkway, b across it
  const lo = kind === 'cap1' ? 2 : 0, hi = kind === 'cap2' ? 13 : 15;
  for (let a = lo; a <= hi; a++) {
    for (let b = 3; b <= 12; b++) {
      let c = a % 4 === 3 ? P.w3 : a % 4 === 0 ? P.w1 : P.w2;
      if (b === 3) c = a % 4 === 3 ? P.w2 : P.w1; if (b === 12) c = P.w4;
      if (b >= 4 && b <= 11 && a % 4 === 1 && (b === 5 || b === 10) && r() < 0.8) c = P.w3; // nails
      put(a, b, c);
    }
    put(a, 2, P.ol); put(a, 13, P.ol);
    put(a, 14, P.ol, 70); put(a, 15, P.ol, 45); // shadow on the water
  }
  if (kind !== 'mid') { // end posts
    const e = kind === 'cap1' ? 1 : 14;
    for (const b of [1, 14]) for (let t = -1; t <= 1; t++) for (let u = 0; u < 2; u++) { const aa = e + t, bb = b - (b === 14 ? 0 : 0) + u; put(aa, bb, P.w4); }
    for (const b of [1, 14]) { put(e, b, P.w2); put(e - 1, b, P.w3); put(e + 1, b, P.w3); }
  }
  return cv;
}
function plankPost(dir) { // a mid-span post pair (lantern post)
  const cv = planks(dir, 'mid', 3); const put = (a, b, c) => (dir === 'h' ? cv.set(a, b, c) : cv.set(b, a, c));
  for (const b of [1, 14]) { put(7, b, P.w2); put(8, b, P.w2); put(7, b + (b === 1 ? 1 : -1), P.w3); put(8, b + (b === 1 ? 1 : -1), P.w3); }
  return cv;
}

function logPieces(seed) {
  const r = mulberry32(seed), cv = new Cv(32, 16);
  for (let x = 4; x < 29; x++) { for (let y = 4; y <= 12; y++) { const t = (y - 4) / 8; cv.set(x, y, t < 0.2 ? P.w2 : t < 0.55 ? P.w3 : t < 0.85 ? P.w4 : P.w5); } if (x % 5 === 0) cv.set(x, 6 + (x % 3), P.w5); }
  cv.ell(5, 8, 3.5, 4.6, P.w2); cv.ell(5, 8, 2.3, 3.4, P.w1); cv.ell(5, 8, 1, 1.8, P.w2); cv.set(5, 8, P.w3);
  for (let y = 4; y <= 12; y++) { const cut = Math.floor(r() * 3); cv.clear(28 - cut + (y % 2), y); cv.clear(29 - cut, y); cv.clear(30, y); }
  for (const [mx, my] of [[10, 4], [11, 4], [12, 4], [18, 4], [19, 4], [20, 4], [21, 5], [13, 5], [11, 5], [24, 4], [25, 5]]) { cv.set(mx, my, P.m2); cv.set(mx, my + 1, P.m2); }
  for (const [mx, my] of [[10, 4], [18, 4], [24, 4]]) cv.set(mx, my, P.g1);
  cv.set(14, 3, P.g2); cv.set(15, 3, P.g2); cv.set(15, 2, P.g1);
  cv.outline();
  for (let x = 3; x < 30; x++) { cv.over(x, 14, OL, 55); }
  return cv;
}

function bone(seed, kind) {
  const r = mulberry32(seed), cv = new Cv();
  const skull = (x, y, big) => { cv.ell(x, y, big ? 4 : 3, big ? 3.4 : 2.8, P.bone); cv.rect(Math.round(x - 1.5), Math.round(y + 2), 3, 2, P.bone2); cv.set(Math.round(x - 1), Math.round(y), OL); cv.set(Math.round(x - 1), Math.round(y + 1), OL); cv.set(Math.round(x + 1), Math.round(y), OL); cv.set(Math.round(x + 1), Math.round(y + 1), OL); cv.set(Math.round(x - 1), Math.round(y + 3), OL); cv.set(Math.round(x + 1), Math.round(y + 3), OL); cv.set(Math.round(x - 2), Math.round(y - 2), P.bone2); };
  const bn = (x0, y0, x1, y1) => { cv.line(x0, y0, x1, y1, P.bone); cv.set(x0, y0, P.bone); cv.set(x0 + 1, y0 + 1 > 15 ? 15 : y0 + 1, P.bone2); cv.set(x1, y1 - 1, P.bone); cv.set(x1 + 1, y1, P.bone2); };
  if (kind === 'skull') { bn(2, 13, 11, 10); bn(4, 10, 13, 13); skull(8, 8, true); }
  else if (kind === 'ribs') { bn(7, 3, 7, 13); for (let i = 0; i < 4; i++) { cv.line(7, 5 + i * 2, 3, 6 + i * 2, P.bone); cv.line(7, 5 + i * 2, 11, 6 + i * 2, P.bone); cv.set(3, 6 + i * 2, P.bone2); cv.set(11, 6 + i * 2, P.bone2); } }
  else { skull(5, 9, false); bn(8, 12, 14, 8); bn(7, 6, 13, 4); cv.set(12, 12, P.bone2); cv.set(10, 14, P.bone2); }
  // shadow
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (cv.solid(x, y) && !cv.solid(x, y + 1) && y < 15) cv.over(x, y + 1, OL, 70);
  return cv;
}

function rubble(seed, pal) {
  const r = mulberry32(seed), cv = new Cv(); const [hi, mid, lo, dk] = pal;
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const w = 3 + Math.floor(r() * 4), h = 2 + Math.floor(r() * 3), x = 1 + Math.floor(r() * (13 - w)), y = 5 + Math.floor(r() * (10 - h));
    cv.rect(x - 1, y - 1, w + 2, h + 2, OL); cv.rect(x, y, w, h, mid); cv.rect(x, y, w, 1, hi); cv.rect(x + w - 1, y + 1, 1, h - 1, lo); if (r() < 0.4) cv.set(x + 1, y + h - 1, dk);
  }
  for (let i = 0; i < 3; i++) { const x = 1 + Math.floor(r() * 13), y = 9 + Math.floor(r() * 5); if (!cv.solid(x, y)) cv.set(x, y, lo); }
  return cv;
}

function stalagmite(seed, tall) {
  const r = mulberry32(seed), W = 16, Hh = tall ? 32 : 16, cv = new Cv(W, Hh);
  const cones = tall ? [[8, 30, 6, 28]] : [[6, 14, 4.2, 9], [11, 14, 3, 6]];
  for (const [cx, by, hw, h] of cones) {
    for (let y = 0; y < h; y++) { const t = y / h, w = hw * (0.15 + 0.85 * t), yy = by - h + 1 + y; for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) { if (Math.abs(x + 0.5 - cx) > w) continue; const s = (x + 0.5 - cx) / w; cv.set(x, yy, s < -0.35 ? P.c1 : s < 0.2 ? P.c2 : s < 0.7 ? P.c3 : P.c4); } }
  }
  cv.outline();
  for (let x = 0; x < W; x++) for (let y = 0; y < Hh; y++) if (cv.solid(x, y) && !cv.solid(x, y + 1) && y + 1 < Hh) cv.over(x, y + 1, OL, 60);
  return cv;
}

function crystal(kind, seed) {
  const { c, g } = GLOW[kind], r = mulberry32(seed), cv = new Cv(); cv.glow(8, 9, 9, g, 90);
  const prisms = [[8, 14, 3.2, 11], [4, 14, 2.2, 6], [12, 14, 2.4, 7]];
  for (const [cx, by, hw, h] of prisms) {
    for (let y = 0; y < h; y++) { const t = y / h, w = hw * (t < 0.25 ? 0.3 + t * 2.8 : 1) , yy = by - h + 1 + y; for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) { if (Math.abs(x + 0.5 - cx) > w) continue; const s = (x + 0.5 - cx) / w; cv.set(x, yy, s < -0.2 ? c[0] : s < 0.5 ? c[1] : c[2]); } }
  }
  cv.outline(); cv.set(7, 6, '#ffffff'); cv.set(7, 7, '#ffffff'); cv.set(3, 10, '#ffffff');
  for (let x = 2; x < 14; x++) cv.over(x, 15, OL, 70);
  return cv;
}

function candle(kind) {
  const cv = new Cv(); const flame = (x, y) => { cv.set(x, y, P.fire2); cv.set(x, y - 1, P.fire3); cv.set(x, y - 2, P.fire2); cv.set(x, y - 3, P.fire1, 200); cv.glow(x + 0.5, y - 1, 6, '#ffbc75', 80); };
  const wax = (x, h, w = 3) => { cv.rect(x, 14 - h, w, h, P.bone); cv.rect(x + w - 1, 14 - h, 1, h, P.bone2); cv.set(x + 1, 14 - h, P.bone3); };
  if (kind === 'one') { cv.glow(8, 9, 7, '#ffbc75', 60); wax(6, 5); cv.set(6, 14, P.bone2); cv.rect(5, 14, 5, 1, P.bone2); cv.set(8, 12, P.bone2); flame(7, 8); cv.outline(); }
  else if (kind === 'three') {
    cv.glow(8, 9, 8, '#ffbc75', 70); cv.ell(8, 14, 6.5, 1.8, P.bone2); wax(3, 4, 3); wax(7, 7, 3); wax(11, 5, 3); flame(4, 8); flame(8, 5); flame(12, 7);
    cv.outline();
  } else { // candelabra, on a stand
    cv.rect(7, 7, 2, 7, P.w2); cv.rect(5, 14, 6, 1, P.w3); cv.rect(6, 13, 4, 1, P.w2); cv.set(7, 7, P.w1);
    cv.line(3, 6, 7, 9, P.w2); cv.line(12, 6, 8, 9, P.w2); cv.rect(3, 5, 2, 1, P.w1); cv.rect(11, 5, 2, 1, P.w1);
    wax(3, 3, 2); wax(7, 3, 2); wax(11, 3, 2);
    cv.glow(8, 6, 9, '#ffbc75', 80); flame(3, 4); flame(7, 4); flame(11, 4);
    // wax bodies sit on the arms
    cv.outline();
  }
  return cv;
}

function brazier() {
  const cv = new Cv(); cv.glow(8, 6, 9, '#ff9a3c', 80);
  // flame
  const fl = (cx, top, w, c) => { for (let y = top; y < 9; y++) { const t = (y - top) / (9 - top), hw = Math.max(0, Math.round(w * (0.25 + t * 0.85))); for (let x = cx - hw; x <= cx + hw; x++) cv.set(x, y, c); } };
  fl(8, 1, 3.4, P.fire1); fl(8, 3, 2.4, P.fire2); fl(8, 5, 1.2, P.fire3); cv.set(4, 6, P.fire1); cv.set(12, 5, P.fire1); cv.set(11, 3, P.fire2, 200);
  cv.outline('#7a2a14');
  // bowl
  cv.rect(3, 9, 10, 1, P.c1); cv.rect(3, 10, 10, 1, P.c2); for (let y = 11; y < 13; y++) cv.rect(4 + (y - 11), y, 8 - (y - 11) * 2, 1, y === 11 ? P.c2 : P.c3); cv.rect(5, 12, 6, 1, P.c4);
  cv.rect(7, 13, 2, 1, P.c4); cv.rect(4, 14, 8, 1, P.c3); cv.rect(4, 15, 8, 1, P.c4); cv.rect(5, 14, 1, 1, P.c2);
  cv.rect(3, 9, 1, 1, OL); cv.rect(12, 9, 1, 1, OL);
  // outline bowl only
  for (let x = 2; x <= 13; x++) { cv.set(x, 8, x >= 4 && x <= 11 ? P.fire1 : OL); }
  cv.set(2, 9, OL); cv.set(13, 9, OL); cv.set(2, 10, OL); cv.set(13, 10, OL); cv.set(3, 11, OL); cv.set(12, 11, OL); cv.set(4, 12, OL); cv.set(11, 12, OL); cv.set(3, 14, OL); cv.set(12, 14, OL); cv.set(3, 15, OL); cv.set(12, 15, OL);
  for (let x = 4; x < 12; x++) { cv.set(x, 16 - 1, P.c4); }
  for (let x = 4; x <= 11; x++) cv.set(x, 8, P.fire2);
  return cv;
}

function column(part, seed) {
  const r = mulberry32(seed), cv = new Cv();
  const shaft = (y0, y1, x0 = 3, x1 = 12) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const t = (x - x0) / (x1 - x0); cv.set(x, y, t < 0.18 ? P.s1 : t < 0.55 ? P.s2 : t < 0.85 ? P.s3 : P.s4); }
    for (let y = y0; y <= y1; y++) { if ((y + seed) % 5 !== 0) { cv.set(x0 + 3, y, P.s3); cv.set(x0 + 6, y, P.s4); } }
    for (let i = 0; i < 4; i++) { const mx = x0 + Math.floor(r() * (x1 - x0)), my = y0 + Math.floor(r() * (y1 - y0 + 1)); cv.set(mx, my, r() < 0.5 ? P.m1 : P.m2); if (r() < 0.6) cv.set(mx + 1, my, P.m1); }
  };
  const slab = (y0, y1, x0 = 1, x1 = 14) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cv.set(x, y, y === y0 ? P.s1 : y === y1 ? P.s4 : x > x1 - 3 ? P.s3 : P.s2); };
  if (part === 'cap') { slab(1, 4); shaft(5, 15); cv.rect(2, 5, 12, 1, P.s4, 120); }
  else if (part === 'shaft') shaft(0, 15);
  else if (part === 'base') { shaft(0, 9); slab(10, 14); cv.rect(2, 14, 12, 1, P.s5); }
  else if (part === 'broken') { // shaft with a jagged broken top
    const tops = [5, 3, 6, 2, 7, 4, 5, 8, 3, 6]; for (let x = 3; x <= 12; x++) { const t = tops[(x + seed) % tops.length]; for (let y = t; y <= 15; y++) { const q = (x - 3) / 9; cv.set(x, y, q < 0.18 ? P.s1 : q < 0.55 ? P.s2 : q < 0.85 ? P.s3 : P.s4); } cv.set(x, t, P.s1); }
    for (let y = 6; y <= 15; y += 3) { cv.set(6, y, P.s3); cv.set(9, y, P.s4); } cv.set(5, 11, P.m1); cv.set(6, 11, P.m2); cv.set(10, 8, P.m1);
  } else if (part === 'stub') { // base with a stump
    const tops = [9, 7, 8, 6, 9, 7, 8, 10, 7, 9]; for (let x = 3; x <= 12; x++) { const t = tops[(x + seed) % tops.length]; for (let y = t; y <= 10; y++) { const q = (x - 3) / 9; cv.set(x, y, q < 0.18 ? P.s1 : q < 0.55 ? P.s2 : q < 0.85 ? P.s3 : P.s4); } cv.set(x, t, P.s1); }
    slab(11, 14); cv.rect(2, 14, 12, 1, P.s5); cv.set(5, 9, P.m1); cv.set(6, 9, P.m2); cv.set(10, 12, P.m1);
  }
  cv.outline();
  return cv;
}
function fallenColumn() { // 2 tiles wide, lying down
  const cv = new Cv(32, 16);
  for (let x = 3; x < 31; x++) for (let y = 5; y <= 12; y++) { const t = (y - 5) / 7; cv.set(x, y, t < 0.2 ? P.s1 : t < 0.5 ? P.s2 : t < 0.8 ? P.s3 : P.s4); if (x % 6 === 0 && y > 5 && y < 12) cv.set(x, y, P.s4); }
  for (let y = 3; y <= 14; y++) cv.set(2, y, y === 3 || y === 14 ? P.s4 : P.s2), cv.set(3, y, y === 3 || y === 14 ? P.s4 : P.s1);
  for (let y = 5; y <= 12; y++) { const cut = (y * 7) % 4; for (let x = 27 + cut; x < 32; x++) cv.clear(x, y); }
  for (const [mx, my] of [[8, 5], [9, 5], [15, 6], [16, 5], [22, 5], [23, 6], [24, 5]]) cv.set(mx, my, mx % 2 ? P.m2 : P.m1);
  cv.outline(); for (let x = 3; x < 28; x++) cv.over(x, 14, OL, 60);
  return cv;
}

function archSheet(collapsed) { // 5x4 tiles: two piers + a stone ring over a 3-tile passage
  const Wd = 80, Ht = 64, cv = new Cv(Wd, Ht), cx = 40, cy = 44, Ro = 38, Ri = 27;
  for (let y = 0; y < Ht; y++) for (let x = 0; x < Wd; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    let inside = false, shade = 0;
    if (y <= cy && d <= Ro && d >= Ri) { inside = true; shade = (x + 0.5 - cx) / 40 + (y + 0.5 - cy) / 60; }
    if (y > cy - 6 && ((x >= 3 && x <= 14) || (x >= 65 && x <= 76)) && y < 63) { inside = true; shade = x < 40 ? (x - 3) / 11 - 0.3 : (x - 65) / 11 - 0.3; }
    if (inside) cv.set(x, y, shade < -0.5 ? P.s1 : shade < 0.15 ? P.s2 : shade < 0.6 ? P.s3 : P.s4);
  }
  // voussoir joints on the ring
  for (let a = 0; a < 11; a++) { const ang = Math.PI + (a + 0.5) * (Math.PI / 11); for (let t = Ri; t < Ro; t += 0.5) cv.set(cx + Math.cos(ang) * t, cy + Math.sin(ang) * t, P.s4); }
  // keystone
  cv.rect(37, 5, 6, 12, P.s1); cv.rect(37, 5, 1, 12, P.s2); cv.rect(42, 5, 1, 12, P.s3); cv.rect(38, 15, 4, 1, P.s4);
  // pier plinths + capitals
  for (const x0 of [2, 64]) { cv.rect(x0, 58, 14, 5, P.s2); cv.rect(x0, 58, 14, 1, P.s1); cv.rect(x0, 62, 14, 1, P.s5); cv.rect(x0, cy - 5, 14, 3, P.s1); cv.rect(x0, cy - 3, 14, 1, P.s4); }
  for (let y = 48; y < 58; y += 4) { cv.set(7, y, P.s3); cv.set(10, y + 1, P.s4); cv.set(69, y, P.s3); cv.set(72, y + 1, P.s4); }
  if (collapsed) { // the right half of the ring has fallen, the right pier is a broken stump
    for (let y = 0; y < Ht; y++) for (let x = 44; x < Wd; x++) { const lim = 30 + ((x * 5 + y * 3) % 6) + (x - 44) * 0.4; if (y < lim) cv.clear(x, y); }
    for (let y = 30; y < 50; y++) for (let x = 62; x < 79; x++) if (y < 40 + ((x * 7) % 5)) cv.clear(x, y);
  }
  for (const [mx, my] of [[5, 52], [6, 53], [7, 52], [30, 12], [31, 11], [14, 30], [66, 56], [67, 57], [10, 40], [20, 18], [72, 52]]) if (cv.solid(mx, my)) cv.set(mx, my, mx % 2 ? P.m1 : P.m2);
  for (const [mx, my] of [[8, 36], [9, 36], [10, 37], [6, 44], [26, 22], [27, 21]]) if (cv.solid(mx, my)) cv.set(mx, my, P.m2);
  cv.outline();
  for (let x = 0; x < Wd; x++) for (let y = 56; y < Ht; y++) if (cv.solid(x, y) && !cv.solid(x, y + 1) && y + 1 < Ht) cv.over(x, y + 1, OL, 60);
  return cv;
}

function totem(variant) {
  const cv = new Cv(16, 32);
  cv.rect(6, 12, 4, 19, P.w3); cv.rect(6, 12, 1, 19, P.w2); cv.rect(9, 12, 1, 19, P.w4); for (let y = 15; y < 30; y += 4) { cv.set(7, y, P.w5); cv.set(8, y + 1, P.w5); }
  cv.rect(4, 26, 8, 3, P.w4); cv.rect(4, 26, 8, 1, P.w2); // base blocks
  // cloth
  cv.rect(3, 16, 10, 3, P.red); cv.rect(3, 16, 10, 1, '#ef7a5a'); cv.set(3, 19, P.red); cv.set(4, 19, P.red2); cv.set(12, 19, P.red2); cv.set(8, 19, P.red); cv.set(7, 20, P.red2); cv.set(13, 18, P.red2);
  // skull
  cv.ell(8, 7, 4.5, 4.2, P.bone); cv.rect(5, 10, 6, 3, P.bone2); cv.rect(7, 12, 2, 1, P.bone2);
  cv.rect(5, 6, 2, 2, OL); cv.rect(9, 6, 2, 2, OL); cv.set(8, 9, OL); cv.set(7, 11, OL); cv.set(9, 11, OL);
  cv.set(5, 3, P.bone2); cv.set(6, 2, P.bone);
  // horns / feathers
  if (variant === 0) { cv.line(4, 5, 1, 1, P.bone2); cv.line(11, 5, 14, 1, P.bone2); cv.set(1, 1, P.bone); cv.set(14, 1, P.bone); }
  else { for (const [fx, c] of [[3, P.red], [13, '#d6a030'], [1, P.g3], [15, P.red2]]) cv.line(fx < 8 ? 4 : 11, 5, fx, 0, c); }
  cv.outline();
  for (let x = 3; x < 13; x++) cv.over(x, 31, OL, 80);
  return cv;
}
function banner(c1, c2, emblem) {
  const cv = new Cv(16, 32);
  cv.rect(2, 3, 12, 2, P.w3); cv.rect(2, 3, 12, 1, P.w2); cv.rect(1, 2, 2, 4, P.w4); cv.rect(13, 2, 2, 4, P.w4); // crossbar
  cv.rect(7, 5, 2, 25, P.w4); cv.rect(7, 5, 1, 25, P.w3);
  for (let y = 6; y <= 24; y++) { const tail = y > 20 ? (y - 20) : 0; for (let x = 3 + (y > 20 ? 0 : 0); x <= 12; x++) { const inV = y > 20 && x >= 7 - (y - 20) * 0 && false; if (y > 20 && Math.abs(x - 7.5) < (y - 20) * 0.9 && y > 21) continue; cv.set(x, y, x === 3 || x === 12 || y === 6 ? c2 : c1); } }
  cv.rect(3, 6, 10, 1, c2);
  // emblem
  if (emblem === 'skull') { cv.ell(8, 12, 2.4, 2.2, P.bone); cv.set(7, 12, OL); cv.set(9, 12, OL); cv.rect(7, 14, 3, 1, P.bone2); }
  else { cv.line(6, 10, 10, 15, c2); cv.line(10, 10, 6, 15, c2); cv.set(8, 12, P.fire2); }
  cv.rect(6, 25, 4, 1, c2);
  cv.rect(7, 28, 2, 3, P.w4); cv.rect(5, 29, 6, 2, P.w4); cv.rect(5, 29, 6, 1, P.w3);
  cv.outline(); for (let x = 5; x < 11; x++) cv.over(x, 31, OL, 80);
  return cv;
}

function cobweb(flip) {
  const cv = new Cv(), a = 200, c = '#f4f0f4';
  const L = (x0, y0, x1, y1) => cv.line(flip ? 15 - x0 : x0, y0, flip ? 15 - x1 : x1, y1, c, a);
  L(0, 0, 15, 1); L(0, 0, 14, 7); L(0, 0, 9, 12); L(0, 0, 3, 15); L(0, 0, 0, 15);
  L(5, 0, 3, 3); L(3, 3, 0, 5); L(9, 0, 6, 6); L(6, 6, 0, 9); L(13, 1, 9, 9); L(9, 9, 1, 13);
  cv.glow(0, 0, 3, '#ffffff', 40);
  return cv;
}
function cobwebHang() { // dangling strands in the middle of a wall top
  const cv = new Cv(), c = '#f4f0f4'; for (const [x, l] of [[3, 5], [5, 8], [8, 6], [11, 9], [13, 4]]) { cv.line(x, 0, x + (x % 2 ? 1 : -1), l, c, 190); }
  cv.line(3, 3, 13, 3, c, 150); cv.line(2, 6, 12, 7, c, 120); return cv;
}

function sarcophagus() {
  const cv = new Cv(32, 16);
  for (let y = 2; y <= 12; y++) for (let x = 2; x <= 29; x++) { const edge = y === 2 || x === 2; cv.set(x, y, edge ? P.c1 : y > 10 || x > 27 ? P.c3 : P.c2); }
  cv.rect(4, 4, 24, 7, P.c2); cv.rect(4, 4, 24, 1, P.c1); cv.rect(5, 5, 22, 5, '#9aa58a'); // lid
  cv.rect(14, 5, 4, 5, P.c3); cv.rect(15, 6, 2, 3, P.c2); cv.rect(15, 4, 2, 7, P.c3, 0);
  cv.rect(7, 7, 5, 1, P.c3); cv.rect(20, 7, 5, 1, P.c3);
  for (const [mx, my] of [[6, 5], [7, 5], [24, 9], [25, 9], [22, 5]]) cv.set(mx, my, P.m2);
  cv.outline(); for (let x = 2; x < 30; x++) cv.over(x, 14, OL, 70);
  return cv;
}

function mausTop() { // 5x2 tiles: gabled pediment with a skull in the tympanum, over the crypt mausoleum front
  const cv = new Cv(80, 32);
  for (let y = 24; y < 32; y++) for (let x = 0; x < 80; x++) cv.set(x, y, y === 24 ? P.c1 : y > 29 ? P.c4 : y > 27 ? P.c3 : P.c2);
  for (let y = 4; y < 24; y++) { const hw = Math.min(39, (y - 3) * 2.1); for (let x = Math.ceil(40 - hw); x < 40 + hw; x++) { const edge = x - (40 - hw) < 3 || (40 + hw) - x < 3; cv.set(x, y, edge ? (x < 40 ? P.c1 : P.c3) : y < 6 ? P.c1 : P.c2); } }
  for (let y = 9; y < 24; y++) { const hw = Math.min(33, (y - 7) * 1.9); for (let x = Math.ceil(40 - hw); x < 40 + hw; x++) cv.set(x, y, P.c3); }
  for (let y = 23; y < 24; y++) for (let x = 6; x < 74; x++) cv.set(x, y, P.c4);
  cv.ell(40, 17, 5, 4.6, P.c1); cv.rect(37, 20, 6, 3, '#bfbfae'); cv.rect(36, 15, 3, 3, OL); cv.rect(42, 15, 3, 3, OL); cv.set(40, 19, OL); cv.set(39, 22, OL); cv.set(41, 22, OL);
  cv.rect(38, 0, 4, 4, P.c2); cv.rect(38, 0, 4, 1, P.c1); cv.rect(39, 4, 2, 1, P.c3);
  for (const [mx, my] of [[10, 25], [11, 25], [12, 25], [60, 25], [61, 26], [30, 25], [14, 22], [66, 21], [22, 26], [50, 25], [51, 25]]) cv.set(mx, my, mx % 2 ? P.m2 : P.m1);
  cv.outline();
  return cv;
}

function crackStone(seed) {
  const r = mulberry32(seed), cv = new Cv(); let x = 1 + Math.floor(r() * 5), y = 0;
  const pts = []; while (y < 16 && x > 0 && x < 15) { pts.push([x, y]); y++; x += Math.floor(r() * 3) - 1; if (r() < 0.12) { /* fork */ let fx = x, fy = y; for (let k = 0; k < 4; k++) { fx += r() < 0.5 ? 1 : -1; fy++; if (fx > 0 && fx < 15 && fy < 16) pts.push([fx, fy]); } } }
  for (const [px, py] of pts) { cv.set(px, py, '#3f3a38', 220); cv.over(px + 1, py, '#ffffff', 25); }
  return cv;
}
function crackLava(seed) {
  const r = mulberry32(seed), cv = new Cv(); let x = 2 + Math.floor(r() * 4), y = 0; const pts = [];
  while (y < 16 && x > 0 && x < 15) { pts.push([x, y]); y++; x += Math.floor(r() * 3) - 1; if (r() < 0.2) pts.push([x + 1, y]); }
  cv.glow(8, 8, 9, '#ff7a2a', 50);
  for (const [px, py] of pts) { cv.set(px - 1, py, '#2b1812', 230); cv.set(px + 1, py, '#2b1812', 230); }
  for (const [px, py] of pts) cv.set(px, py, (px + py) % 3 === 0 ? P.fire3 : P.fire2);
  return cv;
}

function flagstonePx(x, y, v) {
  // brick-ish flags (period 16 x 8), returns [r,g,b]
  const row = Math.floor(y / 8), off = row % 2 ? 8 : 0, lx = (x + off) % 16, ly = y % 8;
  if (ly === 7 || lx === 15 || (lx === 0 && false)) return hexc('#8a7457');
  if (ly === 0 || lx === 0) return hexc('#e2cd9c');
  const h = hashf(Math.floor((x + off) / 16), row, 31 + v);
  const base = h < 0.34 ? '#cfb683' : h < 0.7 ? '#c7ad79' : '#d6bf8e';
  return hexc(base);
}

// ===================================================================== registry
export function createLemon(ts) {
  const set = new LemonSet();
  const t = ts.addDynamic('TilesetLemon', 'lemon-terrain.png', set);
  const gidOf = (id) => t.firstgid + id;
  const L = { set, ts, t, Cv };
  const tile = (key, draw, props) => gidOf(set.add(key, draw, props));
  L.tile = tile;
  const sheet = (key, cv, wt, ht, props) => { const rows = []; for (let j = 0; j < ht; j++) { const row = []; for (let i = 0; i < wt; i++) { const sl = cv.slice(i, j); let any = false; for (let k = 3; k < sl.d.length; k += 4) if (sl.d[k] > 0) { any = true; break; } row.push(any ? tile(`${key}:${i},${j}`, () => sl, props) : 0); } rows.push(row); } return rows; };
  L.sheet = sheet;

  const S = {};
  S.reed = [1, 2, 3, 4, 5].map((s) => tile('reed' + s, () => reed(900 + s * 17)));
  S.lilyPad = [1, 2, 3].map((s) => tile('lily' + s, () => lily(70 + s * 5, false)));
  S.lilyFlower = [1, 2].map((s) => tile('lilyf' + s, () => lily(300 + s * 11, true)));
  S.glow = {};
  for (const k of Object.keys(GLOW)) S.glow[k] = [1, 2].map((s) => tile(`glow_${k}${s}`, () => glowShroom(k, 40 + s * 9)));
  S.shroomRed = [1, 2, 3].map((s) => tile('shroomr' + s, () => shroom('red', 50 + s * 13)));
  S.shroomBrown = [1, 2].map((s) => tile('shroomb' + s, () => shroom('brown', 80 + s * 7)));
  S.darkTuft = [1, 2, 3, 4].map((s) => tile('dtuft' + s, () => darkTuft(11 * s)));
  for (const d of ['h', 'v']) { S['plank_' + d] = [1, 2].map((s) => tile(`plank_${d}${s}`, () => planks(d, 'mid', s * 5), { speed: 90, terrain: 'floor' })); S['plankPost_' + d] = tile('plankPost_' + d, () => plankPost(d), { speed: 90, terrain: 'floor' }); S['plankA_' + d] = tile(`plankA_${d}`, () => planks(d, 'cap1', 4), { speed: 90, terrain: 'floor' }); S['plankB_' + d] = tile(`plankB_${d}`, () => planks(d, 'cap2', 4), { speed: 90, terrain: 'floor' }); }
  S.logH = sheet('log', logPieces(12), 2, 1);
  S.logH2 = sheet('log2', logPieces(27), 2, 1);
  S.bone = ['skull', 'ribs', 'mix', 'mix2'].map((k, i) => tile('bone_' + k, () => bone(5 + i * 3, k === 'mix2' ? 'mix' : k)));
  S.rubbleTan = [1, 2, 3, 4].map((s) => tile('rubT' + s, () => rubble(10 + s * 3, [P.s1, P.s2, P.s3, P.s4])));
  S.rubbleGray = [1, 2, 3, 4].map((s) => tile('rubG' + s, () => rubble(60 + s * 3, [P.c1, P.c2, P.c3, P.c4])));
  S.stalag = [1, 2, 3].map((s) => tile('stalag' + s, () => stalagmite(20 + s, false)));
  S.stalagTall = [1, 2].map((s) => sheet('stalagT' + s, stalagmite(40 + s, true), 1, 2));
  S.crystal = {}; for (const k of ['cyan', 'violet', 'lime', 'amber']) S.crystal[k] = [1, 2].map((s) => tile(`cryst_${k}${s}`, () => crystal(k, 20 + s)));
  S.candle = { one: tile('candle1', () => candle('one')), three: tile('candle3', () => candle('three')), stand: tile('candlestand', () => candle('stand')) };
  S.brazier = tile('brazier', brazier);
  S.col = { cap: [1, 2].map((s) => tile('col_cap' + s, () => column('cap', s))), shaft: [1, 2, 3].map((s) => tile('col_shaft' + s, () => column('shaft', s))), base: [1, 2].map((s) => tile('col_base' + s, () => column('base', s))), broken: [1, 2, 3].map((s) => tile('col_broken' + s, () => column('broken', s))), stub: [1, 2, 3].map((s) => tile('col_stub' + s, () => column('stub', s))) };
  S.fallenCol = sheet('colfall', fallenColumn(), 2, 1);
  S.arch = sheet('arch', archSheet(false), 5, 4);
  S.archBroken = sheet('archb', archSheet(true), 5, 4);
  S.totem = [0, 1].map((v) => sheet('totem' + v, totem(v), 1, 2));
  S.bannerRed = sheet('banR', banner(P.red2, P.red, 'skull'), 1, 2);
  S.bannerGreen = sheet('banG', banner('#2f5a3c', '#4a7f4b', 'x'), 1, 2);
  S.bannerBlack = sheet('banK', banner('#2b2630', '#4e484a', 'skull'), 1, 2);
  S.cobweb = [tile('web0', () => cobweb(false)), tile('web1', () => cobweb(true))];
  S.cobwebHang = tile('webh', cobwebHang);
  S.mausTop = sheet('mausTop', mausTop(), 5, 2);
  S.sarcophagus =sheet('sarc', sarcophagus(), 2, 1);
  S.crackStone = [1, 2, 3, 4, 5].map((s) => tile('crackS' + s, () => crackStone(s * 13)));
  S.crackLava = [1, 2, 3].map((s) => tile('crackL' + s, () => crackLava(s * 29)));
  L.S = S;

  // ---------------------------------------------------------------- pixel specs for blends
  const noise = (x, y, s) => hashf(x, y, s);
  const flat = (hex, speck) => (x, y, v) => { const c = hexc(hex); if (speck && noise(x, y, v + 9) < speck[1]) return hexc(speck[0]); return c; };
  const fromTile = (gid) => { const loc = ts.locate(gid); return (x, y) => { const i = (((loc.row * 16 + y) * loc.t.imagewidth) + loc.col * 16 + x) * 4; return [loc.t.png.data[i], loc.t.png.data[i + 1], loc.t.png.data[i + 2]]; }; };
  const flagstone = (x, y, v) => { const c = flagstonePx(x, y, v); if (noise(x, y, 77 + v) < 0.035) return hexc('#a8a129'); return c; };
  L.px = { flat, fromTile, flagstone, hexc };

  /** blob tile: base pixels with `over` pixels inside a smooth mask of neighbours. mask8 = [n,ne,e,se,s,sw,w,nw] 0/1 string (canonical, as blobMask). */
  L.blob = (famKey, basePx, overPx, mask8, variant = 0, props) => {
    const key = `blob:${famKey}:${mask8}:${variant}`;
    return tile(key, () => {
      const m = [...mask8].map((c) => c === '1');
      const cells = [[0, 0]]; const dirs = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
      dirs.forEach(([dx, dy], i) => { if (m[i]) cells.push([dx, dy]); });
      const cv = new Cv();
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const u = (x + 0.5) / 16, w = (y + 0.5) / 16; let f = 0;
        for (const [dx, dy] of cells) { const d = Math.hypot(u - (dx + 0.5), w - (dy + 0.5)); f += Math.max(0, 1 - d / 0.9); }
        const thr = 0.5 + (((x + y) & 1) ? 0.07 : -0.07);
        const inside = f > thr;
        const [r, g, b] = inside ? overPx(x, y, variant) : basePx(x, y, variant);
        cv.set(x, y, [r, g, b]);
      }
      return cv;
    }, props);
  };

  /** copy of a pack tile with an overlay drawn on top (moss, vines, torches...) */
  L.overlay = (gid, kind, variant, draw) => tile(`ov:${kind}:${variant}:${gid}`, () => {
    const loc = ts.locate(gid); const cv = new Cv();
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const i = (((loc.row * 16 + y) * loc.t.imagewidth) + loc.col * 16 + x) * 4; if (loc.t.png.data[i + 3]) cv.set(x, y, [loc.t.png.data[i], loc.t.png.data[i + 1], loc.t.png.data[i + 2]], loc.t.png.data[i + 3]); }
    draw(cv, mulberry32(variant * 977 + gid));
    return cv;
  });
  L.draw = {
    // grey-green moss strands hanging from the lower edge of a canopy / branches
    moss(cv, r) { for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) { if (cv.solid(x, y) && !cv.solid(x, y + 1) && r() < 0.42) { const len = 2 + Math.floor(r() * 5); for (let k = 1; k <= len; k++) { if (cv.solid(x, y + k)) break; cv.set(x, y + k, k === len ? '#a9b48f' : k % 2 ? '#8fa077' : '#6f8a62'); } } } },
    // green vines creeping down from the top edge of a wall
    vine(cv, r) { const n = 3 + Math.floor(r() * 3); for (let i = 0; i < n; i++) { const x = 1 + Math.floor(r() * 14), len = 5 + Math.floor(r() * 9); for (let k = 0; k < len; k++) { const xx = x + (k > 3 && r() < 0.25 ? (r() < 0.5 ? -1 : 1) : 0); cv.set(xx, k, k % 4 === 3 ? P.g2 : P.g3); if (k % 3 === 2) { cv.set(xx + 1, k, P.g2); cv.set(xx - 1, k, P.g3); } } } for (let x = 0; x < 16; x++) if (r() < 0.5) { cv.set(x, 0, P.g3); if (r() < 0.5) cv.set(x, 1, P.g2); } },
    // vines growing up from the bottom edge
    vineUp(cv, r) { const n = 2 + Math.floor(r() * 3); for (let i = 0; i < n; i++) { const x = 1 + Math.floor(r() * 14), len = 3 + Math.floor(r() * 6); for (let k = 0; k < len; k++) { cv.set(x + (k > 2 && r() < 0.3 ? 1 : 0), 15 - k, k % 3 === 2 ? P.g2 : P.g3); if (k % 3 === 1) cv.set(x + 1, 15 - k, P.g2); } } for (let x = 0; x < 16; x++) if (r() < 0.45) cv.set(x, 15, P.g3); },
    sconce(cv) { cv.glow(8, 7, 9, '#ff9a3c', 70); cv.rect(7, 8, 2, 5, P.c4); cv.rect(5, 12, 6, 1, P.c4); cv.rect(6, 7, 4, 1, P.c3); for (let y = 2; y < 8; y++) { const t = (y - 2) / 6, hw = Math.round(0.4 + t * 2); for (let x = 8 - hw; x < 8 + hw; x++) cv.set(x, y, y < 4 ? P.fire1 : y < 6 ? P.fire2 : P.fire3); } cv.set(8, 1, P.fire1); },
    skullRelief(cv) { cv.ell(8, 8, 3.6, 3.4, P.c1); cv.rect(6, 10, 4, 2, P.c2); cv.rect(5, 7, 2, 2, OL); cv.rect(9, 7, 2, 2, OL); cv.set(8, 10, OL); },
    crackWall(cv, r) { let x = 4 + Math.floor(r() * 8), y = 0; while (y < 16) { cv.set(x, y, '#2f3b36', 230); y++; x += Math.floor(r() * 3) - 1; x = Math.max(1, Math.min(14, x)); } },
    web(cv, flip) { for (let i = 0; i < 1; i++) cv.paste(S_web(flip), 0, 0); },
  };
  const S_web = (flip) => { const cvw = cobweb(flip); return cvw; };
  return L;
}
