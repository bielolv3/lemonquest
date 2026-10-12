// usage: node tools/mapgen/sheet.mjs <TilesetFile.png> [col0 row0 cols rows scale] -> tools/mapgen/_v/sheet.png  (labelled contact sheet for picking tiles)
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { TILESET_DIR, here } from './lib.mjs';
const [file, c0 = 0, r0 = 0, nc = 99, nr = 99, sc = 3] = process.argv.slice(2);
const src = PNG.sync.read(fs.readFileSync(path.join(TILESET_DIR, file)));
const C = Math.min(+nc, Math.floor(src.width / 16) - +c0), R = Math.min(+nr, Math.floor(src.height / 16) - +r0), S = +sc, T = 16 * S, M = 14;
const out = new PNG({ width: M + C * T, height: M + R * T });
for (let i = 0; i < out.width * out.height; i++) { const x = i % out.width, y = (i / out.width) | 0; const ck = (((x - M) >> 3) + ((y - M) >> 3)) & 1; const v = x < M || y < M ? 255 : ck ? 90 : 110; out.data.set([v, v, v, 255], i * 4); }
for (let y = 0; y < R * T; y++) for (let x = 0; x < C * T; x++) {
  const sx = (+c0) * 16 + Math.floor(x / S), sy = (+r0) * 16 + Math.floor(y / S); const si = (sy * src.width + sx) * 4; const a = src.data[si + 3] / 255; if (!a) continue;
  const di = ((M + y) * out.width + M + x) * 4; for (let k = 0; k < 3; k++) out.data[di + k] = src.data[si + k] * a + out.data[di + k] * (1 - a);
}
for (let c = 0; c <= C; c++) for (let y = M; y < out.height; y++) { const x = M + c * T; if (x < out.width) { const di = (y * out.width + x) * 4; out.data[di] = 255; out.data[di + 1] = 0; out.data[di + 2] = 0; } }
for (let r = 0; r <= R; r++) for (let x = M; x < out.width; x++) { const y = M + r * T; if (y < out.height) { const di = (y * out.width + x) * 4; out.data[di] = 255; out.data[di + 1] = 0; out.data[di + 2] = 0; } }
const F = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111' };
const txt = (s, ox, oy) => { [...String(s)].forEach((ch, n) => { for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (F[ch][j * 3 + i] === '1') { const di = ((oy + j * 2) * out.width + ox + n * 8 + i * 2) * 4; out.data.set([0, 0, 0, 255], di); out.data.set([0, 0, 0, 255], di + 4); out.data.set([0, 0, 0, 255], di + out.width * 4); out.data.set([0, 0, 0, 255], di + out.width * 4 + 4); } }); };
for (let c = 0; c < C; c++) txt(+c0 + c, M + c * T + 2, 2);
for (let r = 0; r < R; r++) txt(+r0 + r, 0, M + r * T + 2);
fs.mkdirSync(path.join(here, '_v'), { recursive: true });
fs.writeFileSync(path.join(here, '_v/sheet.png'), PNG.sync.write(out));
