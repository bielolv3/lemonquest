// Âncoras por frame de uma sheet de personagem (16x16 por frame), usadas para encaixar os addons.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "package.json"));
const { PNG } = require("pngjs");

export const FRAME = 16;

export function readSheet(path) {
  return PNG.sync.read(readFileSync(path));
}

/**
 * Âncoras do frame (col, row):
 *  top/bottom   primeira/última linha opaca
 *  ext[y]       [minX, maxX] opaco da linha y (null se vazia)
 *  neck         linha mais estreita perto do queixo (entre cabeça e tronco)
 *  headL/headR  extensão horizontal da cabeça (linhas top..neck-1)
 *  bodyL/bodyR  extensão do tronco (linhas neck+1..bottom-1)
 *  maxL/maxR    extensão total
 *  c2           centro "dobrado" da cabeça (headL + headR), meio-pixel preciso
 */
export function computeAnchors(png, col, row) {
  const ox = col * FRAME, oy = row * FRAME;
  const ext = new Array(FRAME).fill(null);
  let top = -1, bottom = -1;
  for (let y = 0; y < FRAME; y++) {
    let l = -1, r = -1;
    for (let x = 0; x < FRAME; x++) {
      const a = png.data[((oy + y) * png.width + ox + x) * 4 + 3];
      if (a >= 128) { if (l < 0) l = x; r = x; }
    }
    if (l >= 0) { ext[y] = [l, r]; if (top < 0) top = y; bottom = y; }
  }
  if (top < 0) { top = 0; bottom = FRAME - 1; }
  // pescoço: linha mais estreita entre bottom-5 e bottom-2 (empate → a mais baixa)
  let neck = bottom - 4, nw = Infinity;
  for (let y = bottom - 5; y <= bottom - 2; y++) {
    const e = ext[y]; if (!e) continue;
    const w = e[1] - e[0];
    if (w <= nw) { nw = w; neck = y; }
  }
  const union = (y0, y1) => {
    let l = Infinity, r = -Infinity;
    for (let y = y0; y <= y1; y++) { const e = ext[y]; if (e) { l = Math.min(l, e[0]); r = Math.max(r, e[1]); } }
    return l === Infinity ? [4, 11] : [l, r];
  };
  const [headL, headR] = union(top, neck - 1);
  const [bodyL, bodyR] = union(neck + 1, bottom - 1);
  const [maxL, maxR] = union(top, bottom);
  return { top, bottom, ext, neck, headL, headR, bodyL, bodyR, maxL, maxR, c2: headL + headR };
}
