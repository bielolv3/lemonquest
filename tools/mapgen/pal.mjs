// usage: node tools/mapgen/pal.mjs <TilesetFile.png> col row [w h]  -> prints the colours (hex, count) of a tile rect
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { TILESET_DIR } from './lib.mjs';
const [file, c, r, w = 1, h = 1] = process.argv.slice(2);
const src = PNG.sync.read(fs.readFileSync(path.join(TILESET_DIR, file)));
const m = new Map();
for (let y = +r * 16; y < (+r + +h) * 16; y++) for (let x = +c * 16; x < (+c + +w) * 16; x++) {
  const i = (y * src.width + x) * 4; if (src.data[i + 3] < 128) continue;
  const k = [0, 1, 2].map((j) => src.data[i + j].toString(16).padStart(2, '0')).join('');
  m.set(k, (m.get(k) ?? 0) + 1);
}
console.log([...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `#${k}:${n}`).join(' '));
