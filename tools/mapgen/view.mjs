// Dev helper: crop a tileset region, upscale, draw tile grid with col/row labels.
// usage: node tools/mapgen/view.mjs <png> <out.png> [c0 r0 cols rows] [scale=3]
import fs from 'node:fs';
import { PNG } from 'pngjs';

const [, , inp, outp, c0 = 0, r0 = 0, nc = 99, nr = 99, sc = 3] = process.argv;
const img = PNG.sync.read(fs.readFileSync(inp));
const C0 = +c0, R0 = +r0, S = +sc;
const cols = Math.min(+nc, Math.floor(img.width / 16) - C0);
const rows = Math.min(+nr, Math.ceil(img.height / 16) - R0);
const M = 14; // margin for labels
const W = M + cols * 16 * S, H = M + rows * 16 * S;
const out = new PNG({ width: W, height: H });
const set = (x, y, r, g, b, a = 255) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = a; };
// checker bg
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const k = ((x >> 3) + (y >> 3)) & 1; set(x, y, k ? 200 : 170, k ? 200 : 170, k ? 200 : 170); }
for (let y = 0; y < H; y++) for (let x = 0; x < M; x++) set(x, y, 255, 255, 255);
for (let y = 0; y < M; y++) for (let x = 0; x < W; x++) set(x, y, 255, 255, 255);
for (let y = 0; y < rows * 16 * S; y++) for (let x = 0; x < cols * 16 * S; x++) {
  const sx = C0 * 16 + Math.floor(x / S), sy = R0 * 16 + Math.floor(y / S);
  if (sx >= img.width || sy >= img.height) continue;
  const i = (sy * img.width + sx) * 4; const a = img.data[i + 3];
  if (a === 0) continue;
  set(M + x, M + y, img.data[i], img.data[i + 1], img.data[i + 2]);
}
for (let c = 0; c <= cols; c++) for (let y = 0; y < rows * 16 * S; y++) set(M + c * 16 * S, M + y, 255, 0, 255, 255);
for (let r = 0; r <= rows; r++) for (let x = 0; x < cols * 16 * S; x++) set(M + x, M + r * 16 * S, 255, 0, 255, 255);
// tiny 3x5 digits
const D = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
const digit = (d, x, y) => { for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (D[d][j * 3 + i] === '1') set(x + i, y + j, 0, 0, 0); };
const num = (n, x, y) => { String(n).split('').forEach((ch, k) => digit(+ch, x + k * 4, y)); };
for (let c = 0; c < cols; c++) num(C0 + c, M + c * 16 * S + 2, 4);
for (let r = 0; r < rows; r++) num(R0 + r, 1, M + r * 16 * S + 4);
fs.writeFileSync(outp, PNG.sync.write(out));
console.log(outp, W, H);
