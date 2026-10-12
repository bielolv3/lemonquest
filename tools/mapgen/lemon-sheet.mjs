// usage: node tools/mapgen/lemon-sheet.mjs [scale=4] [firstRow=0] [rows=12] -> tools/mapgen/_v/lemon.png (static art of TilesetLemon on a checker, for review)
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { Tilesets, here } from './lib.mjs';
import { createLemon } from './lemon.mjs';
const [sc = 4, r0 = 0, nr = 12] = process.argv.slice(2).map(Number);
const ts = new Tilesets(); const L = createLemon(ts);
const png = L.set.croppedPng(); const rows = Math.min(nr, png.height / 16 - r0), W = png.width, S = sc;
const out = new PNG({ width: W * S, height: rows * 16 * S });
for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
  const ck = ((x >> 5) + (y >> 5)) & 1, bg = ck ? 96 : 120; let r = bg, g = bg + 8, b = bg;
  const si = (((r0 * 16) + Math.floor(y / S)) * W + Math.floor(x / S)) * 4, a = png.data[si + 3] / 255;
  if (a) { r = png.data[si] * a + r * (1 - a); g = png.data[si + 1] * a + g * (1 - a); b = png.data[si + 2] * a + b * (1 - a); }
  if (x % (16 * S) === 0 || y % (16 * S) === 0) { r = 200; g = 40; b = 40; }
  out.data.set([r, g, b, 255], (y * out.width + x) * 4);
}
fs.mkdirSync(path.join(here, '_v'), { recursive: true });
fs.writeFileSync(path.join(here, '_v/lemon.png'), PNG.sync.write(out));
console.log('tiles used', L.set.used, 'rows', png.height / 16);
