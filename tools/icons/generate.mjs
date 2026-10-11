// Gera assets/icons/gear.png (atlas 16x16), gear.json (nome -> frame) e gear-preview.png (4x, com grade).
// Uso: node tools/icons/generate.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { MASKS } from "./masks.mjs";

const OUT = fileURLToPath(new URL("../../assets/icons/", import.meta.url));
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 255];

// outline, dark, mid, light, highlight, accent
const TIERS = {
  leather: ["#2b1a12", "#6b4226", "#9c6a3a", "#c48d52", "#e8b878", "#d8c890"],
  bronze: ["#2e1c10", "#7a4a22", "#b0702f", "#d99a4a", "#f5c880", "#8a2a2a"],
  iron: ["#20242c", "#4a5260", "#7a8494", "#a8b2c0", "#d8e0ea", "#6b4226"],
  steel: ["#1c2430", "#4f6a8a", "#7fa0c0", "#b0d0e8", "#eef8ff", "#c8a84a"],
  gold: ["#3a2408", "#a8741a", "#e0a828", "#f8d450", "#fff4a0", "#b02828"],
  mithril: ["#0c2a2c", "#1f7a78", "#38b8b0", "#78e8d8", "#d0fff8", "#f0f0ff"],
  dragon: ["#2c0c10", "#8a1c24", "#c83434", "#f06848", "#ffc0a0", "#f0c040"],
  arcane: ["#1c0c2c", "#5a2a90", "#8a4ad0", "#b890f0", "#f0e0ff", "#40e0f0"],
};
const ROLE = { o: 0, d: 1, m: 2, l: 3, h: 4, a: 5 };

// gema: media, brilho, escura
const GEMS = {
  ruby: ["#e03a4a", "#ff9aa0", "#8a1428"],
  emerald: ["#3ac860", "#a8ffb8", "#14783a"],
  sapphire: ["#3a7ae0", "#a8d0ff", "#1a3a90"],
  amethyst: ["#a85ae0", "#e6b8ff", "#5a2890"],
  topaz: ["#f0c030", "#fff0a0", "#a07810"],
  aqua: ["#38d8d0", "#c0fff8", "#16807c"],
  diamond: ["#e8f0f8", "#ffffff", "#8aa0c0"],
  onyx: ["#4a4a5a", "#9a9ab0", "#16161e"],
};
const GEM_ORDER = Object.keys(GEMS);

function parse(name, rows) {
  const w = Math.max(...rows.map((r) => r.length));
  if (!parse.seen) parse.seen = new Set();
  rows.forEach((r, i) => { if (r.length !== w && !parse.seen.has(name + i)) { parse.seen.add(name + i); console.warn(`aviso: ${name} linha ${i} tem ${r.length} (esperado ${w})`); } });
  if (w > 16 || rows.length > 16) throw new Error(`${name} maior que 16x16`);
  const ox = Math.floor((16 - w) / 2), oy = Math.floor((16 - rows.length) / 2) + (rows.length <= 10 ? 0 : 0);
  const px = [];
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== ".") px.push([x + ox, y + oy, c]); }));
  return px;
}

const frames = []; // { name, px: Uint8 16*16*4 }
function addIcon(name, maskName, tier, gem) {
  const pal = TIERS[tier].map(hex);
  const g = gem ? GEMS[gem].map(hex) : null;
  const buf = new Uint8Array(16 * 16 * 4);
  for (const [x, y, c] of parse(maskName, MASKS[maskName])) {
    let col;
    if (c === "g") col = g[0]; else if (c === "G") col = g[1]; else if (c === "e") col = g[2];
    else col = pal[ROLE[c]];
    buf.set(col, (y * 16 + x) * 4);
  }
  frames.push({ name, buf });
}

const tierNames = Object.keys(TIERS);
for (const [shape, mask] of [["helmet_cap", "helmet_cap"], ["helmet_full", "helmet_full"], ["helmet_horned", "helmet_horned"], ["helmet_wizard", "helmet_wizard"],
  ["armor_vest", "armor_vest"], ["armor_plate", "armor_plate"], ["armor_robe", "armor_robe"],
  ["legs_pants", "legs_pants"], ["legs_greaves", "legs_greaves"], ["boots", "boots"],
  ["shield_round", "shield_round"], ["shield_kite", "shield_kite"], ["shield_tower", "shield_tower"]]) {
  for (const t of tierNames) addIcon(`${shape}_${t}`, mask, t);
}
// aneis e amuletos: banda da tier x gema (diagonal + algumas combinacoes uteis)
tierNames.forEach((t, i) => { addIcon(`ring_${t}`, "ring", t, GEM_ORDER[i]); addIcon(`amulet_${t}`, "amulet", t, GEM_ORDER[(i + 3) % GEM_ORDER.length]); });

const COLS = 12;
const rows = Math.ceil(frames.length / COLS);
const atlas = new PNG({ width: COLS * 16, height: rows * 16 });
const meta = { frameWidth: 16, frameHeight: 16, columns: COLS, count: frames.length, frames: {} };
frames.forEach((f, i) => {
  const fx = (i % COLS) * 16, fy = Math.floor(i / COLS) * 16;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const s = (y * 16 + x) * 4, d = ((fy + y) * atlas.width + fx + x) * 4;
    for (let k = 0; k < 4; k++) atlas.data[d + k] = f.buf[s + k];
  }
  meta.frames[f.name] = i;
});

// preview 4x com fundo xadrez escuro e grade
const S = 4, W = atlas.width * S, H = atlas.height * S;
const prev = new PNG({ width: W, height: H });
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const ax = (x / S) | 0, ay = (y / S) | 0;
  const i = (ay * atlas.width + ax) * 4;
  const edge = x % 64 === 0 || y % 64 === 0;
  const bg = ((((ax >> 1) + (ay >> 1)) & 1) ? 0x3a : 0x30);
  const d = (y * W + x) * 4;
  const a = atlas.data[i + 3] / 255;
  for (let k = 0; k < 3; k++) prev.data[d + k] = edge ? 0x70 : Math.round(atlas.data[i + k] * a + bg * (1 - a));
  prev.data[d + 3] = 255;
}
mkdirSync(OUT, { recursive: true });
writeFileSync(OUT + "gear.png", PNG.sync.write(atlas));
writeFileSync(OUT + "gear-preview.png", PNG.sync.write(prev));
writeFileSync(OUT + "gear.json", JSON.stringify(meta, null, 1) + "\n");
console.log(`gear.png ${atlas.width}x${atlas.height}, ${frames.length} icones`);
