// Gera o favicon do The Lemon Quest (limão pixel-art no estilo Ninja Adventure).
// Uso: node tools/favicon/generate.mjs  -> assets/favicon/*
// Determinístico: nenhum aleatório/relógio; mesma saída a cada execução.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = join(root, "assets", "favicon");

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255, 255];
const C = {
  outline: hex(0x3b2a12),
  y0: hex(0xfff7a8), // brilho
  y1: hex(0xffe14a), // luz
  y2: hex(0xf2b91c), // base
  y3: hex(0xc98a10), // sombra
  y4: hex(0x93610f), // sombra funda
  leaf0: hex(0x9be35f),
  leaf1: hex(0x4aa53a),
  stem: hex(0x6b4423),
  spark: hex(0xffffff),
  bg0: hex(0x2a3042),
  bg1: hex(0x1b1f2a),
};

class Canvas {
  constructor(n) { this.n = n; this.px = new Array(n * n).fill(null); }
  set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.n && y < this.n) this.px[y * this.n + x] = c; }
  get(x, y) { return x < 0 || y < 0 || x >= this.n || y >= this.n ? null : this.px[y * this.n + x]; }
  toPng() {
    const p = new PNG({ width: this.n, height: this.n });
    this.px.forEach((c, i) => { const o = i * 4; const v = c ?? [0, 0, 0, 0]; p.data[o] = v[0]; p.data[o + 1] = v[1]; p.data[o + 2] = v[2]; p.data[o + 3] = v[3]; });
    return p;
  }
}

/**
 * Desenha o limão num canvas n x n (16, 32 ou 48). Contorno sempre de 1 px.
 * Eixo maior na diagonal (baixo-esquerda -> cima-direita); folha e talo na ponta de cima.
 */
function drawLemon(n, { sparkle = n >= 32 } = {}) {
  const cv = new Canvas(n);
  const s = n / 32;
  const cx = n * 0.45, cy = n * 0.62;
  const ang = (-38 * Math.PI) / 180;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const a = n * 0.35, b = n * 0.26; // semi-eixos do corpo
  const nub = Math.max(1.0, n * 0.052); // raio do bico

  const info = new Map();
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    const u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    const t = u / a;
    let r = null;
    if (Math.abs(t) <= 1) {
      const w = b * Math.pow(1 - Math.pow(Math.abs(t), 2.4), 0.5);
      if (Math.abs(v) <= w) r = { v, t, w };
    }
    if (!r && Math.abs(u) > a * 0.8) {
      const tip = Math.sign(u) * (a + nub * 0.6);
      if (Math.hypot(u - tip, v) <= nub) r = { v, t: Math.sign(u) * 0.97, w: nub * 1.3 };
    }
    if (r) info.set(y * n + x, r);
  }

  // Sombreamento: normal de elipsoide + luz de cima-esquerda, quantizado em 4-5 tons.
  const L = [-0.55, -0.65, 0.52];
  const ll = Math.hypot(...L);
  for (let i = 0; i < 3; i++) L[i] /= ll;
  for (const [k, r] of info) {
    const x = k % n, y = (k / n) | 0;
    const rv = Math.min(1, Math.abs(r.v) / r.w), rt = Math.min(1, Math.abs(r.t));
    const rad = Math.min(1, Math.hypot(rv, rt * 0.6));
    const nz = Math.sqrt(Math.max(0, 1 - rad * rad));
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, dl = Math.hypot(dx, dy) || 1;
    const lum = (dx / dl) * rad * L[0] + (dy / dl) * rad * L[1] + nz * L[2];
    let c = lum > 0.84 ? C.y0 : lum > 0.58 ? C.y1 : lum > 0.28 ? C.y2 : lum > 0.0 ? C.y3 : C.y4;
    if (n <= 16) c = lum > 0.7 ? C.y1 : lum > 0.28 ? C.y2 : C.y3;
    cv.set(x, y, c);
  }

  // Folha + talo na ponta superior-direita.
  const topX = cx + (a + nub * 0.6) * ca, topY = cy + (a + nub * 0.6) * sa;
  const leafSet = new Map();
  const la = Math.max(2.6, n * 0.15), lb = Math.max(1.3, n * 0.075);
  const lang = (-52 * Math.PI) / 180, lca = Math.cos(lang), lsa = Math.sin(lang);
  const lcx = topX + lca * la * 0.8, lcy = topY - 0.5 * s + lsa * la * 0.8;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (info.has(y * n + x)) continue;
    const dx = x + 0.5 - lcx, dy = y + 0.5 - lcy;
    const u = dx * lca + dy * lsa, v = -dx * lsa + dy * lca;
    if ((u / la) ** 2 + (v / lb) ** 2 <= 1) leafSet.set(y * n + x, v < 0 ? C.leaf0 : C.leaf1);
  }
  const stem = new Set();
  const sx = Math.floor(topX), sy = Math.floor(topY);
  for (let i = 0; i < Math.max(1, Math.round(1.5 * s)); i++) { const k = (sy - 1 - i) * n + sx; if (!info.has(k) && !leafSet.has(k)) stem.add(k); }

  // Contorno 1 px (4-vizinhança).
  const solid = new Set([...info.keys(), ...leafSet.keys(), ...stem]);
  const outline = new Set();
  for (const k of solid) {
    const x = k % n, y = (k / n) | 0;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + ox, Y = y + oy;
      if (X >= 0 && Y >= 0 && X < n && Y < n && !solid.has(Y * n + X)) outline.add(Y * n + X);
    }
  }
  for (const [k, c] of leafSet) cv.set(k % n, (k / n) | 0, c);
  for (const k of stem) cv.set(k % n, (k / n) | 0, C.stem);
  for (const k of outline) cv.set(k % n, (k / n) | 0, C.outline);

  // Brilho especular no alto à esquerda do corpo.
  const hu = -a * 0.4, hv = -b * 0.5;
  const hx = cx + hu * ca - hv * sa, hy = cy + hu * sa + hv * ca;
  cv.set(hx, hy, C.y0);
  if (n >= 32) cv.set(hx + 1, hy, C.y0);

  if (sparkle) {
    const px = Math.round(n * 0.13), py = Math.round(n * 0.2), r = Math.max(1, Math.round(2 * s));
    cv.set(px, py, C.spark);
    for (let i = 1; i <= r; i++) { cv.set(px + i, py, C.spark); cv.set(px - i, py, C.spark); cv.set(px, py + i, C.spark); cv.set(px, py - i, C.spark); }
  }
  return cv;
}

/** Ícone de app: limão 32 px (nearest-neighbor) sobre fundo escuro arredondado. */
function appIcon(size) {
  const base = drawLemon(32);
  const out = new PNG({ width: size, height: size });
  const rad = size * 0.2, m = 0.84, off = (1 - m) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const o = (y * size + x) * 4;
    const ex = Math.max(rad - x - 0.5, 0, x + 0.5 - (size - rad)), ey = Math.max(rad - y - 0.5, 0, y + 0.5 - (size - rad));
    if (Math.hypot(ex, ey) > rad) { out.data[o + 3] = 0; continue; }
    const t = y / size;
    const bg = [0, 1, 2].map((i) => Math.round(C.bg0[i] + (C.bg1[i] - C.bg0[i]) * t));
    const c = base.get(Math.floor(((x / size - off) / m) * 32), Math.floor(((y / size - off) / m) * 32));
    const v = c ?? [...bg, 255];
    out.data[o] = v[0]; out.data[o + 1] = v[1]; out.data[o + 2] = v[2]; out.data[o + 3] = 255;
  }
  return out;
}

function upscale(png, f) {
  const out = new PNG({ width: png.width * f, height: png.height * f });
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
    const s = (((y / f) | 0) * png.width + ((x / f) | 0)) * 4, o = (y * out.width + x) * 4;
    for (let i = 0; i < 4; i++) out.data[o + i] = png.data[s + i];
  }
  return out;
}

const enc = (png) => PNG.sync.write(png, { deflateLevel: 9 });

/** ICO com PNGs embutidos (ICONDIR + ICONDIRENTRY[] + dados). */
function makeIco(entries) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(entries.length, 4);
  let offset = 6 + 16 * entries.length;
  const dir = [], data = [];
  for (const { size, buf } of entries) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8); e.writeUInt32LE(offset, 12);
    dir.push(e); data.push(buf); offset += buf.length;
  }
  return Buffer.concat([head, ...dir, ...data]);
}

mkdirSync(OUT, { recursive: true });
const f16 = drawLemon(16).toPng(), f32 = drawLemon(32).toPng(), f48 = drawLemon(48).toPng();
const files = {
  "favicon-16.png": enc(f16),
  "favicon-32.png": enc(f32),
  "favicon-48.png": enc(f48),
  "apple-touch-icon.png": enc(appIcon(180)),
  "icon-192.png": enc(appIcon(192)),
  "icon-512.png": enc(appIcon(512)),
};
files["favicon.ico"] = makeIco([
  { size: 16, buf: files["favicon-16.png"] }, { size: 32, buf: files["favicon-32.png"] }, { size: 48, buf: files["favicon-48.png"] },
]);

// Preview 8x: 16/32/48 sobre fundo claro e escuro + ícone de app.
{
  const cells = [f16, f32, f48].flatMap((p) => [[p, [235, 235, 235]], [p, [30, 33, 42]]]);
  const f = 8, pad = 16;
  const app = upscale(appIcon(32), 8);
  const w = cells.reduce((acc, [p]) => acc + p.width * f + pad, pad) + app.width + pad;
  const h = Math.max(48 * f, app.height) + pad * 2;
  const out = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) { out.data[i * 4] = 90; out.data[i * 4 + 1] = 90; out.data[i * 4 + 2] = 98; out.data[i * 4 + 3] = 255; }
  const blit = (img, bx, by, bg) => {
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      const s = (y * img.width + x) * 4, o = ((by + y) * w + bx + x) * 4, al = img.data[s + 3] / 255;
      for (let i = 0; i < 3; i++) out.data[o + i] = Math.round(img.data[s + i] * al + (bg ? bg[i] : out.data[o + i]) * (1 - al));
    }
  };
  let x = pad;
  for (const [p, bg] of cells) {
    const up = upscale(p, f);
    for (let yy = 0; yy < up.height; yy++) for (let xx = 0; xx < up.width; xx++) {
      const o = ((pad + yy) * w + x + xx) * 4; out.data[o] = bg[0]; out.data[o + 1] = bg[1]; out.data[o + 2] = bg[2];
    }
    blit(up, x, pad, bg);
    x += up.width + pad;
  }
  blit(app, x, pad);
  files["preview.png"] = enc(out);
}

for (const [name, buf] of Object.entries(files)) writeFileSync(join(OUT, name), buf);
console.log("favicon gerado em", OUT);
