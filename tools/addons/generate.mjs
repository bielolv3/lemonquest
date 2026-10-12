// Gera os overlays de addon (assets/addons/*.png) a partir do catálogo shared/src/data/outfits.ts.
// Determinístico (sem aleatoriedade): mesma entrada → mesmos bytes.
//
//   node tools/addons/generate.mjs            gera sheets + manifest + preview
//
// Cada addon é desenhado frame a frame com ÂNCORAS calculadas da sheet base da roupa
// (topo da cabeça, centro, extensões da cabeça/corpo, pescoço), então o chapéu acompanha o
// balanço da caminhada e capas seguem o corpo nos 4 lados. Saída por addon:
//   <id>.png       camada da FRENTE (desenhada por cima da base)
//   <id>_back.png  camada de TRÁS (desenhada atrás da base) — só se o addon tiver algo atrás
// Layout = o das sheets do pack (4 colunas = baixo/cima/esquerda/direita, 7 linhas), com frames 32x32
// e o frame 16x16 da base posicionado em (OX, OY).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const require = createRequire(join(root, "package.json"));
const { PNG } = require("pngjs");
const { OUTFIT_LIST, ADDON_FRAME: FW, ADDON_OFFSET_X: OX, ADDON_OFFSET_Y: OY } =
  await import(pathToFileURL(join(root, "packages/shared/src/data/outfits.ts")).href);
import { computeAnchors, readSheet } from "./anchors.mjs";

const FH = FW;
const COLS = 4, ROWS = 7;
const FACINGS = ["down", "up", "left", "right"];
const OUT_DIR = join(root, "assets", "addons");

// ---------------------------------------------------------------- paleta (do próprio pack + poucos tons novos)
const OUTLINE = [0x14, 0x1b, 0x1b];
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/** material → [claro, médio, escuro] (ou 1 cor = plano). outline:false = sem contorno. */
const MATS = {
  gold: { c: ["#f1c471", "#d78b4a", "#965340"] },
  brightgold: { c: ["#fce2ca", "#f1c471", "#d78b4a"] },
  red: { c: ["#e0394c", "#d14b34", "#8f3e56"] },
  wine: { c: ["#d14b34", "#8f3e56", "#5a2a3e"] },
  steel: { c: ["#e3f1f5", "#9ba7aa", "#5f7160"] },
  iron: { c: ["#8d977f", "#5f7160", "#4e484a"] },
  wood: { c: ["#d78b4a", "#965340", "#5c3a33"] },
  leather: { c: ["#c8966b", "#965340", "#5c3a33"] },
  felt: { c: ["#965340", "#6e4236", "#4a2c2b"] },
  green: { c: ["#a8a129", "#56864c", "#3d5c3e"] },
  leaf: { c: ["#c7cf4f", "#8fb04a", "#56864c"] },
  white: { c: ["#f2eaf1", "#d6d8dc", "#9ba7aa"] },
  bone: { c: ["#f2eaf1", "#fce2ca", "#c8966b"] },
  cloth: { c: ["#4e484a", "#3b3643", "#262330"] },
  indigo: { c: ["#6b7aa6", "#4a5270", "#353a57"] },
  purple: { c: ["#8a6fb0", "#634c86", "#43345e"] },
  blue: { c: ["#79b8ce", "#548789", "#4a5270"] },
  beige: { c: ["#fce2ca", "#e2c29a", "#c8966b"] },
  parrot: { c: ["#e0394c", "#d14b34", "#8f3e56"] },
  // planos / brilhos
  star: { c: ["#fff6c8"] },
  orbcore: { c: ["#ffffff"], outline: false },
  orbcyan: { c: ["#bff3ff", "#79b8ce", "#548789"] },
  orbviolet: { c: ["#e7c8ff", "#b07ee0", "#6f4aa0"] },
  orbgreen: { c: ["#e6ffb0", "#a8d84a", "#56864c"] },
  ruby: { c: ["#ff8a9a", "#e0394c", "#8f3e56"] },
  emerald: { c: ["#b6f0b0", "#56b04c", "#2f6a3a"] },
  sparkle: { c: ["#fff6c8"], outline: false },
  sparkleV: { c: ["#e7c8ff"], outline: false },
  beak: { c: ["#f1c471"] },
  eye: { c: ["#141b1b"], outline: false },
  out: { c: ["#141b1b"], outline: false },
};
const MAT_NAMES = Object.keys(MATS);
const MAT_ID = Object.fromEntries(MAT_NAMES.map((n, i) => [n, i + 1]));
const MAT_RGB = MAT_NAMES.map((n) => MATS[n].c.map(hex));

// ---------------------------------------------------------------- canvas de um frame (2 camadas)
class Layer {
  constructor() { this.mat = new Uint8Array(FW * FH); this.shade = new Uint8Array(FW * FH); }
  /** (x,y) em coordenadas do frame BASE (0..15); pode sair do 16x16 (folga do overlay). */
  set(x, y, mat, shade = 0) {
    const X = Math.round(x) + OX, Y = Math.round(y) + OY;
    if (X < 0 || Y < 0 || X >= FW || Y >= FH) return;
    this.mat[Y * FW + X] = MAT_ID[mat]; this.shade[Y * FW + X] = shade;
  }
  get(x, y) { const X = x + OX, Y = y + OY; return X < 0 || Y < 0 || X >= FW || Y >= FH ? 0 : this.mat[Y * FW + X]; }
  clear(x, y) { const X = x + OX, Y = y + OY; if (X >= 0 && Y >= 0 && X < FW && Y < FH) this.mat[Y * FW + X] = 0; }
  h(y, x0, x1, mat, shade = 0) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, mat, shade); }
  v(x, y0, y1, mat, shade = 0) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, mat, shade); }
  line(x0, y0, x1, y1, mat, shade = 0) {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (;;) { this.set(x0, y0, mat, shade); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  /** Desenha um "stamp" ASCII: cada char → material (map), '.' = vazio. (x,y) = canto superior esquerdo. flip = espelha. */
  stamp(x, y, rows, map, flip = false) {
    const w = Math.max(...rows.map((r) => r.length));
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const ch = r[i]; if (ch === "." || ch === " ") continue; const m = map[ch]; if (!m) continue; const [mat, sh] = Array.isArray(m) ? m : [m, 0]; this.set(flip ? x + (w - 1 - i) : x + i, y + j, mat, sh); } });
  }
  any() { return this.mat.some((v) => v !== 0); }
}

/** Renderiza uma camada: sombreamento automático (luz de cima-esquerda) + contorno escuro de 1 px. */
function renderLayer(L) {
  const rgba = new Uint8Array(FW * FH * 4);
  const filled = (x, y) => x >= 0 && y >= 0 && x < FW && y < FH && L.mat[y * FW + x] !== 0;
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const m = L.mat[y * FW + x]; if (!m) continue;
    const cols = MAT_RGB[m - 1];
    let s = L.shade[y * FW + x];
    if (!s) {
      const lit = !filled(x, y - 1) || !filled(x - 1, y);
      const dark = !filled(x, y + 1) || !filled(x + 1, y);
      s = lit && !dark ? 1 : dark && !lit ? 3 : 2;
    }
    const c = cols[Math.min(cols.length, s) - 1] ?? cols[0];
    const i = (y * FW + x) * 4; rgba[i] = c[0]; rgba[i + 1] = c[1]; rgba[i + 2] = c[2]; rgba[i + 3] = 255;
  }
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    if (L.mat[y * FW + x]) continue;
    let o = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Y = y + dy;
      if (!filled(X, Y)) continue;
      const m = L.mat[Y * FW + X];
      if (MATS[MAT_NAMES[m - 1]].outline !== false) { o = true; break; }
    }
    if (o) { const i = (y * FW + x) * 4; rgba[i] = OUTLINE[0]; rgba[i + 1] = OUTLINE[1]; rgba[i + 2] = OUTLINE[2]; rgba[i + 3] = 255; }
  }
  return rgba;
}

// ---------------------------------------------------------------- utilidades de forma
/** Faixa centrada num centro "dobrado" c2 (= minx+maxx) com largura w. */
const spanC = (c2, w) => { const l = Math.round((c2 + 1 - w) / 2); return [l, l + w - 1]; };
const front = (a) => (a.facing === "left" ? -1 : 1);   // sentido "para frente" nas vistas de lado
const side = (a) => a.facing === "left" || a.facing === "right";

/** Cobre a cabeça da base nas linhas [y0..y1] com o material (garante que nada da base "vaze" por cima do chapéu). */
function coverHead(L, a, y0, y1, mat, pad = 0) {
  for (let y = y0; y <= y1; y++) { const e = a.ext[y]; if (e) L.h(y, e[0] - pad, e[1] + pad, mat); }
}

/** Pena: sobe a partir de (x, y) curvando para o lado d (±1); 2 px de largura, ponta `tip`. */
function feather(L, x, y, d, len, mat, tip, fluffy = false) {
  for (let i = 0; i < len; i++) {
    const off = Math.round((i * i) / (len * 1.4)) * d;
    const w = i === len - 1 ? 1 : fluffy && i > 0 && i < len - 2 ? 3 : 2;
    const m = i >= len - 2 ? tip : mat;
    const x0 = x + off;
    for (let k = 0; k < w; k++) {
      const kk = w > 2 ? k - 1 : k;
      // nervura central mais escura nas penas largas
      L.set(d > 0 ? x0 + kk : x0 - kk, y - i, m, w > 2 ? (kk === 0 ? 3 : kk < 0 ? 1 : 2) : 0);
    }
  }
  L.set(x + Math.round(((len - 1) * (len - 1)) / (len * 1.4)) * d + d, y - len + 1, tip); // ponta caída
}

/** Haste vertical segurada ao lado do corpo. Devolve {x, top} da ponta. */
function heldPole(L, a, len, mat = "wood") {
  let x;
  if (a.facing === "down") x = a.maxR + 1;
  else if (a.facing === "up") x = a.maxL - 1;
  else x = a.facing === "left" ? a.headL - 1 : a.headR + 1;
  const y1 = a.bottom - 1, y0 = y1 - len + 1;
  L.v(x, y0, y1, mat);
  return { x, top: y0, out: a.facing === "down" ? 1 : a.facing === "up" ? -1 : front(a) };
}

// ---------------------------------------------------------------- desenhos dos addons
// Assinatura: (F, B, a) → F = camada da frente, B = camada de trás, a = âncoras do frame.
const DRAW = {
  // ---------- Mago
  mago_chapeu(F, B, a) {
    const t = a.top, brim = t + 3;
    const hw = a.headR - a.headL + 1;
    // cone: de (hw-2) na linha t+1 até a ponta (2 px) em t-7, ponta dobrada
    const rows = [];
    for (let y = brim - 1; y >= t - 7; y--) {
      const k = (brim - 1 - y) / (brim - 1 - (t - 7));
      let w = Math.max(2, Math.round((hw - 2) * (1 - k) + 2 * k));
      rows.push([y, w, k]);
    }
    const bendDir = a.facing === "down" ? 1 : a.facing === "up" ? -1 : -front(a);
    const shiftC = side(a) ? -front(a) : 0; // nas vistas de lado o cone fica um pouco para trás
    for (const [y, w, k] of rows) {
      const bend = k > 0.62 ? Math.round((k - 0.62) * 8) * bendDir : 0;
      const [l, r] = spanC(a.c2 + 2 * shiftC + 2 * bend, w);
      F.h(y, l, r, "indigo");
    }
    coverHead(F, a, t, brim - 1, "indigo");
    // faixa dourada
    const eb = a.ext[brim - 1] ?? [a.headL, a.headR];
    F.h(brim - 1, eb[0], eb[1], "gold");
    // aba larga
    if (side(a)) {
      const f = front(a);
      const l = f < 0 ? a.headL - 3 : a.headL - 1, r = f < 0 ? a.headR + 1 : a.headR + 3;
      F.h(brim, l, r, "indigo");
    } else F.h(brim, a.headL - 2, a.headR + 2, "indigo");
    // estrela
    if (a.facing !== "up") {
      const cx = side(a) ? (a.c2 >> 1) + front(a) * 1 : (a.c2 >> 1);
      const sy = t - 1;
      F.set(cx, sy, "star", 1); F.set(cx, sy - 1, "star", 1); F.set(cx - 1, sy, "star", 1); F.set(cx + 1, sy, "star", 1); F.set(cx, sy + 1, "star", 1);
    }
  },
  mago_cajado(F, B, a) {
    const p = heldPole(F, a, 11, "wood");
    F.set(p.x, a.bottom - 6, "gold"); // anel
    // orbe 2x3 brilhante no topo, com "garras"
    const ox = p.x, oy = p.top - 3;
    F.set(ox - 1, oy + 2, "gold"); F.set(ox + 1, oy + 2, "gold");
    F.h(oy, ox - 1, ox + 1, "orbcyan"); F.h(oy + 1, ox - 1, ox + 1, "orbcyan"); F.set(ox, oy - 1, "orbcyan");
    F.set(ox - 1, oy, "orbcore", 1);
    F.set(ox, oy + 2, "gold");
    // brilho que pisca com a caminhada
    if (a.row % 2 === 0) F.set(ox + 2 * p.out, oy - 2, "sparkle", 1);
  },

  // ---------- Cidadão
  cidadao_chapeu(F, B, a) {
    const t = a.top, brim = t + 3;
    coverHead(F, a, t - 1, brim - 1, "felt");
    const e = a.ext[t] ?? [a.headL + 2, a.headR - 2];
    F.h(t - 1, e[0] + 1, e[1] - 1, "felt");
    const eb = a.ext[brim - 1] ?? [a.headL, a.headR];
    F.h(brim - 1, eb[0], eb[1], "red");
    if (side(a)) { const f = front(a); F.h(brim, f < 0 ? a.headL - 2 : a.headL, f < 0 ? a.headR : a.headR + 2, "felt"); }
    else F.h(brim, a.headL - 1, a.headR + 1, "felt");
    // pena (sai da faixa, sobe para trás)
    const d = a.facing === "down" ? 1 : a.facing === "up" ? -1 : -front(a);
    const bx = d > 0 ? eb[1] - 2 : eb[0] + 2;
    feather(F, bx, brim - 1, d, 5, "white", "red", true);
  },
  cidadao_mochila(F, B, a) {
    const n = a.neck, b = a.bottom;
    if (a.facing === "up") {
      const [l, r] = spanC(a.c2, 8);
      for (let y = n - 1; y <= b - 2; y++) F.h(y, l, r, "leather");
      F.h(n - 1, l, r, "felt"); F.h(n, l + 1, r - 1, "felt"); F.set((a.c2 >> 1), n + 1, "gold");
      F.h(n - 2, l - 1, r + 1, "beige"); F.h(n - 3, l, r, "beige");     // saco de dormir
    } else if (a.facing === "down") {
      const [l, r] = spanC(a.c2, 12);
      B.h(n - 2, l - 1, r + 1, "beige"); B.h(n - 3, l, r, "beige");    // pontas do saco de dormir atrás
      F.v(a.bodyL + 2, n + 1, b - 2, "leather"); F.v(a.bodyR - 2, n + 1, b - 2, "leather"); // alças
    } else {
      const f = front(a), back = f < 0 ? a.bodyR : a.bodyL;
      const x0 = back + f * 1, x1 = back - f * 2;
      for (let y = n; y <= b - 1; y++) F.h(y, x0, x1, "leather");
      F.h(n, x0, x1, "felt"); F.set(x1, n + 1, "gold");
      F.h(n - 1, x0, x1 - f, "beige");
      F.v(back + f * 3, n + 1, b - 2, "leather"); // alça
    }
  },

  // ---------- Caçador
  cacador_chapeu(F, B, a) {
    const t = a.top, brim = t + 3;
    coverHead(F, a, t - 1, brim, "green");
    const e = a.ext[t] ?? [a.headL + 2, a.headR - 2];
    // copa pontuda estilo "Robin Hood", ponta para trás
    const d = a.facing === "down" ? -1 : a.facing === "up" ? 1 : -front(a);
    F.h(t - 1, e[0], e[1], "green");
    const pk = d > 0 ? e[1] : e[0];
    F.h(t - 2, Math.min(pk, pk - d * 3), Math.max(pk, pk - d * 3), "green");
    F.h(t - 3, Math.min(pk, pk - d * 1), Math.max(pk, pk - d * 1), "green");
    if (side(a)) { const f = front(a); F.h(brim, f < 0 ? a.headL - 2 : a.headL, f < 0 ? a.headR : a.headR + 2, "green"); }
    else F.h(brim, a.headL - 1, a.headR + 1, "green");
    const eb = a.ext[brim] ? [a.ext[brim][0], a.ext[brim][1]] : [a.headL, a.headR];
    // pena vermelha longa
    const fx = d > 0 ? eb[1] - 3 : eb[0] + 3;
    feather(F, fx, brim - 1, d, 6, "red", "white");
  },
  cacador_aljava(F, B, a) {
    const n = a.neck, b = a.bottom;
    if (a.facing === "up") {
      // aljava em diagonal nas costas: de baixo-direita até cima-esquerda; flechas saem pelo ombro
      F.line(a.bodyR - 2, b - 1, a.headL + 2, n - 4, "leather");
      F.line(a.bodyR - 1, b - 1, a.headL + 3, n - 4, "leather");
      F.set(a.headL + 1, n - 5, "wood"); F.set(a.headL + 2, n - 6, "wood");
      F.set(a.headL, n - 6, "white"); F.set(a.headL + 1, n - 7, "red"); F.set(a.headL + 2, n - 8, "white"); F.set(a.headL + 3, n - 7, "red");
    } else if (a.facing === "down") {
      // penas das flechas aparecem por trás do ombro direito; alça cruzando o peito
      B.set(a.headR + 1, n - 6, "white"); B.set(a.headR + 2, n - 7, "red"); B.set(a.headR, n - 7, "red"); B.set(a.headR + 1, n - 8, "white");
      B.line(a.headR - 1, n - 3, a.headR + 1, n - 5, "leather");
      F.line(a.bodyL + 1, n + 1, a.bodyR - 1, b - 2, "leather", 3);
    } else {
      const f = front(a), back = f < 0 ? a.headR : a.headL;
      F.line(back - f * 1, b - 1, back + f * 1, n - 4, "leather");
      F.line(back - f * 0, b - 1, back + f * 2, n - 4, "leather");
      F.set(back + f * 1, n - 5, "wood");
      F.set(back + f * 1, n - 6, "white"); F.set(back + f * 2, n - 7, "red"); F.set(back, n - 7, "red"); F.set(back + f * 1, n - 8, "white");
    }
  },

  // ---------- Cavaleiro
  cavaleiro_pluma(F, B, a) {
    const t = a.top;
    if (side(a)) {
      const f = front(a), c = a.c2 >> 1;
      // crina: sobe no topo e cai para trás
      F.h(t - 1, c - f, c + f, "red"); F.h(t - 2, c, c - f * 2, "red"); F.h(t - 3, c - f, c - f * 3, "red");
      F.set(c - f * 4, t - 2, "red"); F.set(c - f * 5, t - 1, "red"); F.set(c - f * 5, t, "red"); F.set(c - f * 6, t + 1 + (a.row % 2), "red");
      F.set(c - f * 4, t - 1, "red"); F.set(c - f * 5, t - 2 + 1, "red");
    } else {
      const [l, r] = spanC(a.c2, 2);
      for (let y = t - 4; y <= t; y++) F.h(y, l, r, "red");
      F.h(t - 5, l, r, "red");
      F.set(l - 1, t - 4, "red"); F.set(r + 1, t - 4, "red"); F.set(l - 1, t - 3, "red"); F.set(r + 1, t - 3, "red");
      F.h(t + 1, l, r, "gold");
    }
  },
  cavaleiro_escudo(F, B, a) {
    const n = a.neck, b = a.bottom;
    const M = { s: "steel", R: "red", g: "gold", G: ["gold", 1] };
    if (a.facing === "up") {
      const rows = [
        ".sssssss.",
        "sRRRgRRRs",
        "sRRRgRRRs",
        "sggggGggs",
        "sRRRgRRRs",
        ".sRRgRRs.",
        "..sRgRs..",
        "...sss...",
      ];
      const [l] = spanC(a.c2, 9);
      F.stamp(l, b - rows.length, rows, M);
    } else if (a.facing === "down") {
      F.line(a.bodyL + 2, n + 1, a.bodyR - 2, b - 2, "leather", 3); // alça cruzando o peito
      B.h(n - 1, a.maxR, a.maxR + 1, "steel"); B.set(a.maxR + 1, n, "red"); B.set(a.maxR + 1, n + 1, "steel"); // borda do escudo atrás do ombro
    } else {
      const f = front(a), back = f < 0 ? a.bodyR : a.bodyL;
      const rows = ["s.", "Rs", "Rs", "gs", "Rs", "Rs", "s."];
      // borda do escudo de perfil, saindo das costas
      F.stamp(f < 0 ? back + 1 : back - 2, b - rows.length, rows, M, f > 0);
    }
  },

  // ---------- Nobre
  nobre_capa(F, B, a) { cape(F, B, a, { mat: "red", trim: "gold", collar: "white" }); },
  nobre_pena(F, B, a) {
    const t = a.top, d = a.facing === "down" ? 1 : a.facing === "up" ? -1 : -front(a);
    const e = a.ext[t + 3] ?? [a.headL, a.headR];
    const bx = d > 0 ? e[1] - 3 : e[0] + 3, y = t + 3;
    feather(F, bx, y - 1, d, 7, "white", "ruby", true);
    F.set(bx, y, "ruby", 1);
  },

  // ---------- Invocador
  invocador_diadema(F, B, a) {
    const y = a.top + 2;
    const e = a.ext[y] ?? [a.headL, a.headR];
    F.h(y, e[0] + 1, e[1] - 1, "gold");
    if (!side(a)) {
      const c2 = a.c2; const [l, r] = spanC(c2, 2);
      F.h(y - 1, l, r, "gold"); F.h(y - 2, l, r, "gold"); F.set(l, y - 3, "gold"); F.set(r, y - 3, "gold");
      F.set(e[0] + 2, y - 1, "gold"); F.set(e[1] - 2, y - 1, "gold");
      if (a.facing === "down") { F.set(l, y - 1, "orbviolet", 1); F.set(r, y - 1, "orbviolet", 2); F.set(l, y - 2, "orbviolet", 1); F.set(r, y - 2, "orbviolet", 3); }
    } else {
      const f = front(a), fx = f < 0 ? e[0] + 2 : e[1] - 2;
      F.v(fx, y - 3, y - 1, "gold"); F.v(fx - f, y - 2, y - 1, "gold"); F.set(fx, y - 1, "orbviolet", 1); F.set(fx, y - 2, "orbviolet", 2);
      F.set(fx - f * 4, y - 1, "gold");
    }
  },
  invocador_orbe(F, B, a) {
    const bob = [0, -1, 0, 1][a.row % 4];
    let x;
    if (a.facing === "down") x = a.maxR + 2; else if (a.facing === "up") x = a.maxL - 4; else x = front(a) < 0 ? a.headR + 2 : a.headL - 4;
    const y = a.top + 4 + bob;
    const L = a.facing === "up" || side(a) ? F : F;
    L.h(y, x, x + 2, "orbviolet"); L.h(y + 1, x, x + 2, "orbviolet"); L.h(y - 1, x + 1, x + 1, "orbviolet"); L.set(x + 1, y + 2, "orbviolet");
    L.set(x, y, "orbcore", 1);
    L.set(x - 1, y + 4 - bob, "sparkleV", 1); L.set(x + 3, y + 5 + bob, "sparkleV", 1);
  },

  // ---------- Guerreiro
  guerreiro_asas(F, B, a) {
    const t = a.top;
    const M = { w: ["white", 1], s: ["white", 2], d: ["white", 3] };
    // asa direita (aponta para +x); espelhada para a esquerda
    const wing = ["....w", "...ww", "..wws", ".wwsd", "wwsd.", "wsd.."];
    if (side(a)) {
      const f = front(a), c = a.c2 >> 1;
      // asa do lado de cá, abrindo para trás
      F.stamp(f < 0 ? c - 1 : c - 4, t - 2, wing, M, f > 0);
      B.stamp(f < 0 ? c + 1 : c - 6, t - 3, ["....w", "...ww", "..ww."], M, f > 0);
    } else {
      F.stamp(a.headR - 2, t - 2, wing, M);
      F.stamp(a.headL - 2, t - 2, wing, M, true);
    }
  },
  guerreiro_machado(F, B, a) {
    const p = heldPole(F, a, 10, "wood");
    const o = p.out, y = p.top;
    // lâmina dupla de aço
    F.v(p.x + o, y, y + 3, "steel"); F.v(p.x + o * 2, y - 1, y + 4, "steel"); F.v(p.x + o * 3, y - 1, y + 4, "steel");
    F.v(p.x - o, y + 1, y + 2, "steel"); F.set(p.x, y - 1, "steel");
  },

  // ---------- Bárbaro
  barbaro_elmo(F, B, a) {
    const t = a.top, rim = t + 3;
    coverHead(F, a, t, rim - 1, "iron");
    const er = a.ext[rim] ?? [a.headL, a.headR];
    F.h(rim, er[0], er[1], "leather");
    F.set(a.c2 >> 1, t - 1, "iron");
    for (let x = er[0] + 1; x < er[1]; x += 3) F.set(x, rim, "gold", 2);
    const horn = (L, x, d) => { // d = para fora
      L.set(x + d, rim - 1, "bone"); L.set(x + d * 2, rim - 1, "bone"); L.set(x + d * 2, rim - 2, "bone"); L.set(x + d * 3, rim - 2, "bone");
      L.set(x + d * 3, rim - 3, "bone"); L.set(x + d * 3, rim - 4, "bone", 1); L.set(x + d * 2, rim - 5, "bone", 1);
    };
    if (side(a)) {
      const f = front(a);
      horn(F, f < 0 ? er[0] + 3 : er[1] - 3, f);
      horn(B, f < 0 ? er[1] - 1 : er[0] + 1, -f);
    } else { horn(F, er[0], -1); horn(F, er[1], 1); }
  },
  barbaro_clava(F, B, a) {
    const p = heldPole(F, a, 8, "wood");
    const y = p.top;
    for (let i = 0; i < 4; i++) F.h(y - i, p.x - 1, p.x + 1, "wood");
    F.h(y - 4, p.x - 1, p.x + 1, "wood"); F.set(p.x, y - 5, "wood");
    F.set(p.x - 2, y - 1, "steel", 1); F.set(p.x + 2, y - 2, "steel", 1); F.set(p.x - 2, y - 3, "steel", 1); F.set(p.x + 2, y - 4, "steel", 1); F.set(p.x, y - 6, "steel", 1);
  },

  // ---------- Druida
  druida_coroa(F, B, a) {
    const y = a.top + 2;
    const e = a.ext[y] ?? [a.headL, a.headR];
    F.h(y, e[0], e[1], "green");
    for (let x = e[0], i = 0; x <= e[1]; x++, i++) {
      if (i % 3 === 0) { F.set(x, y - 1, "leaf", 1); F.set(x + 1, y - 1, "leaf", 2); F.set(x, y, "leaf", 1); }
    }
    const flower = (x) => { F.set(x, y - 1, "white", 1); F.set(x, y, "ruby", 1); };
    if (!side(a)) { flower((a.c2 >> 1) - 3); flower((a.c2 >> 1) + 4); }
    else flower(front(a) < 0 ? e[0] + 2 : e[1] - 2);
  },
  druida_cajado(F, B, a) {
    const p = heldPole(F, a, 11, "wood");
    const o = p.out, y = p.top;
    // ponta curvada (gancho) com folhas e uma gema verde
    F.set(p.x + o, y - 1, "wood"); F.set(p.x + o, y - 2, "wood"); F.set(p.x, y - 3, "wood"); F.set(p.x - o, y - 2, "wood");
    F.set(p.x, y - 1, "orbgreen", 1);
    F.set(p.x - o, y + 1, "leaf"); F.set(p.x - o * 2, y + 2, "leaf", 1); F.set(p.x + o * 2, y, "leaf", 1);
    F.set(p.x - o, y + 4, "leaf", 1);
  },

  // ---------- Bruxo
  bruxo_manto(F, B, a) { cape(F, B, a, { mat: "purple", trim: "wine", collar: "spikes" }); },
  bruxo_cajado(F, B, a) {
    const p = heldPole(F, a, 10, "cloth");
    const y = p.top;
    const M = { b: "bone", E: "eye" };
    const skull = a.facing === "up" ? [".bbb.", "bbbbb", "bbbbb", ".bbb."] : [".bbb.", "bbbbb", "bEbEb", ".bbb."];
    F.stamp(p.x - 2, y - 4, skull, M);
    F.set(p.x - 1, y, "bone"); F.set(p.x + 1, y, "bone");
    if (a.row % 2 === 1) F.set(p.x + 3 * p.out, y - 5, "orbgreen", 1);
    else F.set(p.x + 2 * p.out, y - 6, "orbgreen", 1);
  },

  // ---------- Oriental
  oriental_joia(F, B, a) {
    const t = a.top;
    const d = a.facing === "down" ? 1 : a.facing === "up" ? -1 : -front(a);
    let gx;
    if (side(a)) { const e = a.ext[t + 3] ?? [a.headL, a.headR]; gx = front(a) < 0 ? e[0] + 1 : e[1] - 1; }
    else gx = a.c2 >> 1;
    const gy = t + 3;
    if (a.facing !== "up") { F.set(gx, gy, "ruby", 1); F.set(gx + 1, gy, "ruby", 3); F.set(gx, gy + 1, "ruby", 3); F.set(gx + 1, gy + 1, "ruby", 3); F.set(gx, gy - 1, "gold"); F.set(gx + 1, gy - 1, "gold"); }
    // pluma
    F.v(gx + (d > 0 ? 1 : 0), t - 1, gy - 2, "white");
    F.set(gx + (d > 0 ? 1 : 0) + d, t - 2, "white"); F.set(gx + (d > 0 ? 1 : 0) + d * 2, t - 3, "red"); F.set(gx + (d > 0 ? 1 : 0) + d, t - 3, "white");
  },
  oriental_cimitarra(F, B, a) {
    let x, o;
    if (a.facing === "down") { x = a.maxR + 1; o = 1; } else if (a.facing === "up") { x = a.maxL - 1; o = -1; } else { o = front(a); x = o < 0 ? a.headL - 1 : a.headR + 1; }
    const hy = a.bottom - 2;
    F.v(x, hy - 1, hy + 1, "wood"); F.h(hy - 2, x - 1, x + 1, "gold");
    // lâmina curva para fora
    F.v(x, hy - 6, hy - 3, "steel"); F.v(x + o, hy - 8, hy - 4, "steel"); F.set(x + o * 2, hy - 9, "steel"); F.set(x + o * 2, hy - 8, "steel");
  },

  // ---------- Pirata
  pirata_chapeu(F, B, a) {
    const t = a.top, brim = t + 3;
    coverHead(F, a, t - 1, brim - 1, "cloth");
    const e = a.ext[t] ?? [a.headL + 2, a.headR - 2];
    F.h(t - 1, e[0], e[1], "cloth");
    if (side(a)) {
      const f = front(a);
      F.h(brim, a.headL - 1, a.headR + 1, "cloth");
      F.h(brim - 1, a.headL - 1, a.headR + 1, "cloth");
      // bico na frente e atrás, levantados
      F.set(f < 0 ? a.headL - 2 : a.headR + 2, brim - 1, "cloth"); F.set(f < 0 ? a.headL - 2 : a.headR + 2, brim - 2, "cloth");
      F.set(f < 0 ? a.headR + 2 : a.headL - 2, brim - 2, "cloth"); F.set(f < 0 ? a.headR + 2 : a.headL - 2, brim - 3, "cloth");
      F.h(brim, a.headL - 1, a.headR + 1, "gold");
    } else {
      F.h(brim, a.headL - 1, a.headR + 1, "gold");
      F.h(brim - 1, a.headL - 1, a.headR + 1, "cloth");
      F.v(a.headL - 2, brim - 3, brim - 1, "cloth"); F.v(a.headR + 2, brim - 3, brim - 1, "cloth");
      F.set(a.headL - 1, brim - 2, "cloth"); F.set(a.headR + 1, brim - 2, "cloth");
      if (a.facing === "down") {
        const cx = a.c2 >> 1;
        F.h(t, cx - 1, cx + 1, "white", 1); F.set(cx - 1, t + 1, "white", 1); F.set(cx + 1, t + 1, "white", 1); F.set(cx, t + 1, "eye");
      }
    }
  },
  pirata_papagaio(F, B, a) {
    const n = a.neck;
    const M = { R: "parrot", G: "green", B: "blue", Y: ["beak", 1], E: "eye" };
    const front6 = [".RR.", ".REY", "GGG.", "BGG.", "BGG.", ".B.."];
    const back6 = [".RR.", ".RR.", "GGG.", "GGB.", "GGB.", "..B."];
    // pousado no ombro, do lado de fora da cabeça; olha para "frente" do personagem
    if (a.facing === "down") F.stamp(a.maxL - 3, n - 7, front6, M);
    else if (a.facing === "up") F.stamp(a.maxR, n - 7, back6, M);
    else {
      const f = front(a);
      F.stamp(f < 0 ? a.maxR - 1 : a.maxL - 2, n - 7, front6, M, f < 0);
    }
  },

  // ---------- Assassino
  assassino_cachecol(F, B, a) {
    const n = a.neck, b = a.bottom;
    const flt = a.row % 2;
    const en = a.ext[n] ?? [a.bodyL, a.bodyR];
    F.h(n, en[0], en[1], "red"); F.h(n - 1, en[0] + 1, en[1] - 1, "red");
    if (a.facing === "down") {
      const x = (a.c2 >> 1) + 2;
      F.v(x, n + 1, n + 3, "red"); F.v(x + 1, n + 1, n + 2 + flt, "red");
    } else if (a.facing === "up") {
      const x = (a.c2 >> 1) - 1;
      F.v(x, n + 1, b - 1 + flt, "red"); F.v(x + 2, n + 1, b - flt, "red");
    } else {
      const f = front(a), back = f < 0 ? en[1] : en[0];
      // pontas esvoaçando para trás
      F.h(n + 1, back, back - f * (3 + flt), "red"); F.h(n + 2 + flt, back - f * 2, back - f * (5 + flt), "red");
      B.h(n, back, back - f * 2, "red");
    }
  },
  assassino_katana(F, B, a) {
    const n = a.neck, b = a.bottom;
    if (a.facing === "up") {
      F.line(a.bodyL + 1, b - 1, a.headR - 2, n - 3, "cloth");
      F.line(a.bodyL + 2, b - 1, a.headR - 1, n - 3, "cloth");
      F.h(n - 4, a.headR - 3, a.headR, "gold");
      F.line(a.headR - 1, n - 5, a.headR + 1, n - 7, "white"); F.set(a.headR, n - 5, "red");
    } else if (a.facing === "down") {
      B.set(a.headL - 1, n - 4, "gold"); B.line(a.headL - 1, n - 5, a.headL - 2, n - 7, "white"); B.set(a.headL - 2, n - 6, "red");
      B.set(a.bodyR + 1, b - 1, "cloth"); B.set(a.bodyR + 1, b - 2, "cloth");
    } else {
      const f = front(a), back = f < 0 ? a.headR : a.headL;
      F.line(back - f * 2, b - 1, back + f * 0, n - 3, "cloth");
      F.set(back + f * 0, n - 4, "gold"); F.set(back - f * 1, n - 4, "gold");
      F.line(back + f * 0, n - 5, back + f * 1, n - 7, "white"); F.set(back + f * 1, n - 6, "red");
    }
  },
};

/** Capa genérica (nobre/bruxo). Vista de costas cobre o corpo; de frente só as bordas aparecem (camada de trás). */
function cape(F, B, a, { mat, trim, collar }) {
  const n = a.neck, b = a.bottom, flt = a.row % 2;
  if (a.facing === "up") {
    for (let y = n - 1; y <= b; y++) {
      const e = a.ext[Math.min(y, b - 1)] ?? [a.bodyL, a.bodyR];
      const grow = y >= b - 1 ? 1 : 0;
      F.h(y, e[0] - grow, e[1] + grow, mat);
    }
    // barra com ondulação que alterna na caminhada
    const e = a.ext[b - 1] ?? [a.bodyL, a.bodyR];
    for (let x = e[0] - 1; x <= e[1] + 1; x++) F.set(x, b, ((x + flt) % 3 === 0) ? mat : trim);
    F.v((a.c2 >> 1), n + 1, b - 1, mat, 3); // dobra
    if (collar === "white") { const ec = a.ext[n - 1] ?? [a.bodyL, a.bodyR]; F.h(n - 1, ec[0], ec[1], "white"); }
    if (collar === "spikes") { F.set(a.headL + 1, n - 2, mat); F.set(a.headL + 1, n - 3, mat); F.set(a.headR - 1, n - 2, mat); F.set(a.headR - 1, n - 3, mat); F.h(n - 1, a.headL + 1, a.headR - 1, mat); }
  } else if (a.facing === "down") {
    for (let y = n - 1; y <= b; y++) B.h(y, a.bodyL - 1, a.bodyR + 1, mat);
    B.h(b, a.bodyL - 1, a.bodyR + 1, trim);
    if (flt) { B.set(a.bodyL - 2, b, mat); B.set(a.bodyR + 2, b, mat); }
    if (collar === "white") { F.h(n, a.bodyL, a.bodyL + 1, "white"); F.h(n, a.bodyR - 1, a.bodyR, "white"); F.set((a.c2 >> 1), n, "gold", 1); }
    if (collar === "spikes") { B.v(a.headL, n - 4, n - 1, mat); B.v(a.headR, n - 4, n - 1, mat); B.set(a.headL - 1, n - 5, mat); B.set(a.headR + 1, n - 5, mat); }
  } else {
    const f = front(a), back = f < 0 ? a.bodyR : a.bodyL;
    // atrás do corpo, esvoaçando
    for (let y = n - 1; y <= b; y++) { const k = y - (n - 1); B.h(y, back, back - f * (2 + Math.floor(k * 0.6) + flt), mat); }
    B.h(b, back - f * 1, back - f * (5 + flt), trim);
    // por cima: cobre a metade de trás do tronco
    for (let y = n; y <= b - 1; y++) F.h(y, back, back + f * 2, mat);
    if (collar === "white") F.h(n - 1, back, back + f * 3, "white");
    if (collar === "spikes") { F.v(back + f, n - 4, n - 1, mat); F.set(back, n - 5, mat); }
  }
}

// ---------------------------------------------------------------- bases geradas (roupa com sheet própria)
// Algumas roupas usam uma sheet do pack recolorida + detalhes PERMANENTES (não são addons), gravados
// numa sheet 64x112 no mesmo layout do pack. Ex.: Mago = Master com túnica azul-violeta e barba longa.
const rgbHex = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
const HAIR_WHITE = "#f2eaf1";

/** Barba longa do mago (desenhada sobre a base, segue as âncoras de cada frame). */
function drawBeard(L, a) {
  const n = a.neck, b = a.bottom, c2 = a.c2, sway = a.row % 2 === 1 ? 1 : 0;
  // fios verticais: borda clara à esquerda, escura à direita, mechas médias a cada 3 colunas
  const strand = (x, y, l, r) => (x === l ? 1 : x === r ? 3 : (x - l) % 3 === 2 ? 2 : 1);
  if (a.facing === "down") {
    const widths = [9, 9, 8, 7, 5, 3];
    widths.forEach((w, i) => {
      const y = n - 2 + i; if (y > b) return;
      const [l, r] = spanC(c2, w);
      for (let x = l; x <= r; x++) L.set(x, y, "beard", strand(x, y, l, r));
    });
    // ponta dupla ondulando com o passo
    const [l, r] = spanC(c2, 3);
    L.set(l + (sway ? 1 : 0), n + 4, "beard", 2);
    L.set(r - (sway ? 0 : 1), n + 4, "beard", 3);
  } else if (a.facing === "up") {
    // de costas: só as pontas da barba aparecem dos lados do pescoço
    const e = a.ext[n] ?? [a.bodyL, a.bodyR];
    for (const [x, d] of [[e[0] - 1, -1], [e[1] + 1, 1]]) {
      L.set(x, n - 1, "beard", 2); L.set(x, n, "beard", 2); L.set(x + d * 0, n + 1, "beard", 3);
    }
  } else {
    const f = front(a);
    const e = a.ext[n - 2] ?? [a.headL, a.headR];
    const fx = f < 0 ? e[0] + 1 : e[1] - 1; // queixo (frente do rosto)
    const widths = [6, 6, 6, 5, 4, 3];
    widths.forEach((w, i) => {
      const y = n - 2 + i; if (y > b) return;
      const shift = i >= 4 ? sway : 0;
      const lead = i >= 1 && i <= 3 ? 1 : 0; // barriga da barba sai um pouco à frente do rosto
      const x0 = fx + f * (lead - shift), x1 = fx - f * (w - 1 - lead + shift);
      const l = Math.min(x0, x1), r = Math.max(x0, x1);
      for (let x = l; x <= r; x++) L.set(x, y, "beard", strand(x, y, l, r));
    });
  }
}

const BASES = {
  mago: {
    src: "ninja/Actor/Character/Master",
    // vermelho da túnica → azul-violeta do mago do Tibia (o vermelho-escuro do rosto fica)
    recolor: { "#e0394c": "#7b86dc", "#8f3e56": "#3b3f80" },
    // abaixo do pescoço: túnica longa (mangas e barra cobrem mãos/pernas)
    recolorBody: { "#d14b34": "#5560b8", "#ef914f": "#5560b8", "#f2eaf1": "#7b86dc" },
    belt: ["#f1c471", "#d78b4a"],
    faceRecolorFromY: 26,
    faceBody: { "#d14b34": "#5560b8" },
    faceFix: { red: "#d14b34", whites: ["#f2eaf1"], brow: "#d6d8dc", skin: "#d78b4a" },
    faceFixPortrait: { red: "#d1513b", whites: ["#f2eaf1", "#8d977f"], brow: "#d6d8dc", skin: "#cf736d" },
    // barba longa no retrato (abaixo do bigode do Master)
    faceDraw(px, w, h) {
      const set = (x, y, c) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const i = (y * w + x) * 4; const v = hex(c); px[i] = v[0]; px[i + 1] = v[1]; px[i + 2] = v[2]; px[i + 3] = 255; };
      const B = MATS.beard.c;
      for (let y = 25; y < h; y++) {
        const k = Math.floor((y - 25) / 3);
        const l = 8 + k, r = 19 - k;
        if (r - l < 2) break;
        set(l - 1, y, "#141b1b"); set(r + 1, y, "#141b1b");
        for (let x = l; x <= r; x++) set(x, y, x === l ? B[0] : x === r ? B[2] : (x - l) % 3 === 2 ? B[1] : B[0]);
      }
    },
    draw: drawBeard,
  },
};
MATS.beard = { c: ["#f2eaf1", "#d6d8dc", "#9ba7aa"] };
MAT_NAMES.push("beard"); MAT_ID.beard = MAT_NAMES.length; MAT_RGB.push(MATS.beard.c.map(hex));

/** Algum vizinho (8 direções) da imagem ORIGINAL tem uma destas cores? */
function whiteNear(png, x, y, colors) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const X = x + dx, Y = y + dy;
    if (X < 0 || Y < 0 || X >= png.width || Y >= png.height) continue;
    const i = (Y * png.width + X) * 4;
    if (png.data[i + 3] >= 128 && colors.includes(rgbHex(png.data[i], png.data[i + 1], png.data[i + 2]))) return true;
  }
  return false;
}

function generateBases() {
  for (const o of OUTFIT_LIST) {
    const spec = BASES[o.id];
    if (!spec) continue;
    const src = readSheet(join(root, "assets", spec.src, "SpriteSheet.png"));
    const out = new Uint8Array(src.data);
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
      const a = { ...computeAnchors(src, col, row), facing: FACINGS[col], row };
      const px = (x, y) => ((row * 16 + y) * src.width + col * 16 + x) * 4;
      // 1) recolor
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const i = px(x, y); if (out[i + 3] < 128) continue;
        const h = rgbHex(out[i], out[i + 1], out[i + 2]);
        let to = spec.recolor[h] ?? (y > a.neck || ((y === a.neck || a.facing === "up") && h === "#d14b34") ? spec.recolorBody[h] : undefined);
        // faixa dourada na cintura (só sobre a túnica)
        if (spec.belt && y === a.bottom - 2 && (to || Object.values(spec.recolor).includes(h))) to = spec.belt[(x + row) % 3 === 0 ? 1 : 0];
        // rosto: riscos vermelhos → sobrancelhas grisalhas (encostadas no cabelo branco) ou sombra de pele
        if (!to && spec.faceFix && y < a.neck && h === spec.faceFix.red) to = whiteNear(src, col * 16 + x, row * 16 + y, spec.faceFix.whites) ? spec.faceFix.brow : spec.faceFix.skin;
        if (to) { const c = hex(to); out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; }
      }
      // 2) detalhes permanentes (contorno não risca o cabelo/barba brancos da base)
      const L = new Layer();
      spec.draw(L, a);
      const rgba = renderLayer(L);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const si = ((y + OY) * FW + x + OX) * 4; if (!rgba[si + 3]) continue;
        const i = px(x, y);
        const isOutline = rgba[si] === OUTLINE[0] && rgba[si + 1] === OUTLINE[1] && rgba[si + 2] === OUTLINE[2];
        if (isOutline && out[i + 3] >= 128 && rgbHex(out[i], out[i + 1], out[i + 2]) === HAIR_WHITE) continue;
        out[i] = rgba[si]; out[i + 1] = rgba[si + 1]; out[i + 2] = rgba[si + 2]; out[i + 3] = 255;
      }
    }
    writePng(join(root, "assets", o.sheet), src.width, src.height, out);
    // retrato: mesmo recolor (túnica), a partir de faceRecolorFromY
    if (o.faceset) {
      const face = readSheet(join(root, "assets", spec.src, "Faceset.png"));
      const fo = new Uint8Array(face.data);
      for (let y = 0; y < face.height; y++) for (let x = 0; x < face.width; x++) {
        const i = (y * face.width + x) * 4; if (fo[i + 3] < 128) continue;
        const h = rgbHex(fo[i], fo[i + 1], fo[i + 2]);
        let to = y >= spec.faceRecolorFromY ? spec.recolor[h] ?? spec.faceBody[h] : undefined;
        const ff = spec.faceFixPortrait;
        if (!to && ff && h === ff.red) to = whiteNear(face, x, y, ff.whites) ? ff.brow : ff.skin;
        if (to) { const c = hex(to); fo[i] = c[0]; fo[i + 1] = c[1]; fo[i + 2] = c[2]; }
      }
      spec.faceDraw?.(fo, face.width, face.height);
      writePng(join(root, "assets", o.faceset), face.width, face.height, fo);
    }
  }
}

// ---------------------------------------------------------------- geração
function frameAnchors(base, col, row) {
  const a = computeAnchors(base, col, row);
  return { ...a, facing: FACINGS[col], row };
}

function blitFrame(sheet, sw, rgba, col, row) {
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const si = (y * FW + x) * 4, di = ((row * FH + y) * sw + col * FW + x) * 4;
    sheet[di] = rgba[si]; sheet[di + 1] = rgba[si + 1]; sheet[di + 2] = rgba[si + 2]; sheet[di + 3] = rgba[si + 3];
  }
}

function writePng(path, w, h, data) {
  const png = new PNG({ width: w, height: h });
  png.data = Buffer.from(data);
  writeFileSync(path, PNG.sync.write(png, { colorType: 6 }));
}

export function generateAll() {
  mkdirSync(OUT_DIR, { recursive: true });
  const manifest = { frameWidth: FW, frameHeight: FH, offsetX: OX, offsetY: OY, addons: {} };
  const extraTop = {};
  const results = [];
  const mismatches = [];
  generateBases();
  for (const o of OUTFIT_LIST) {
    const base = readSheet(join(root, "assets", o.sheet));
    const outfitRes = { outfit: o, base, addons: [] };
    for (const ad of o.addons) {
      const draw = DRAW[ad.id];
      if (!draw) throw new Error(`addon sem desenho: ${ad.id}`);
      const SW = COLS * FW, SH = ROWS * FH;
      const front = new Uint8Array(SW * SH * 4), back = new Uint8Array(SW * SH * 4);
      let hasBack = false, minY = Infinity;
      const frames = [];
      for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
        const a = frameAnchors(base, col, row);
        const F = new Layer(), B = new Layer();
        draw(F, B, a);
        const fr = renderLayer(F), br = renderLayer(B);
        if (B.any()) hasBack = true;
        blitFrame(front, SW, fr, col, row); blitFrame(back, SW, br, col, row);
        if (row < 4) for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (fr[(y * FW + x) * 4 + 3] || br[(y * FW + x) * 4 + 3]) { minY = Math.min(minY, y - OY - a.top); break; }
        frames.push({ col, row, fr, br });
      }
      if (hasBack !== !!ad.backSheet) { mismatches.push(`${ad.id}: catálogo back=${!!ad.backSheet}, desenho back=${hasBack}`); continue; }
      writePng(join(root, "assets", ad.sheet), SW, SH, front);
      if (hasBack) writePng(join(root, "assets", ad.backSheet), SW, SH, back);
      extraTop[ad.id] = Math.max(0, -(Number.isFinite(minY) ? minY : 0));
      manifest.addons[ad.id] = { outfit: o.id, name: ad.name, front: ad.sheet, back: hasBack ? ad.backSheet : null, extraTop: extraTop[ad.id] };
      outfitRes.addons.push({ def: ad, front, back: hasBack ? back : null, SW });
    }
    results.push(outfitRes);
  }
  if (mismatches.length) throw new Error("Ajuste backSheet em outfits.ts:\n  " + mismatches.join("\n  "));
  writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  const ts = "// GERADO por tools/addons/generate.mjs — não edite à mão.\nexport const ADDON_EXTRA_TOP: Record<string, number> = {\n" +
    Object.entries(extraTop).map(([k, v]) => `  ${k}: ${v},`).join("\n") + "\n};\n";
  writeFileSync(join(root, "packages/shared/src/data/outfitsExtraTop.ts"), ts);
  writePreview(results, false);
  writePreview(results, true);
  writeOutfitPreview(results.find((r) => r.outfit.id === "mago"), "preview_mago.png");
  return results;
}

// ---------------------------------------------------------------- preview
/** Uma roupa em 6x: linha 1 = base/+a1/+a2/+ambos parados nos 4 lados; linha 2 = caminhada completa com os 2 addons. */
function writeOutfitPreview(r, file) {
  if (!r) return;
  const S = 6, CW = 28, CH = 30, cx0 = OX - 6, cy0 = OY - 12, GAP = 2;
  const W = (16 * CW + 3 * GAP) * S, H = 2 * CH * S;
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, k = ((x / (S * 8) | 0) + (y / (S * 8) | 0)) % 2;
    out[i] = k ? 92 : 84; out[i + 1] = k ? 138 : 128; out[i + 2] = k ? 84 : 78; out[i + 3] = 255;
  }
  const put = (X, Y, c) => { for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) { const i = ((Y * S + a) * W + X * S + b) * 4; out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; } };
  const blit = (src, sw, sx, sy, w, h, dx, dy) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = ((sy + y) * sw + sx + x) * 4; if (src[i + 3] >= 128) put(dx + x, dy + y, [src[i], src[i + 1], src[i + 2]]); }
  };
  const cell = (st, col, row, dx, dy) => {
    const on = r.addons.filter((_, i) => st & (1 << i));
    for (const ad of on) if (ad.back) blit(ad.back, ad.SW, col * FW + cx0, row * FH + cy0, CW, CH, dx, dy);
    blit(r.base.data, r.base.width, col * 16, row * 16, 16, 16, dx + (OX - cx0), dy + (OY - cy0));
    for (const ad of on) blit(ad.front, ad.SW, col * FW + cx0, row * FH + cy0, CW, CH, dx, dy);
  };
  for (let st = 0; st < 4; st++) for (let col = 0; col < 4; col++) cell(st, col, 0, (st * 4 + col) * CW + st * GAP, 0);
  for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) cell(3, col, row, (col * 4 + row) * CW + col * GAP, CH);
  writePng(join(OUT_DIR, file), W, H, out);
}

function writePreview(results, walk) {
  const S = 4, CW = 28, CH = 30;   // célula (px de base) — corta a folga do overlay
  const cx0 = OX - 6, cy0 = OY - 12;
  const states = walk ? [3] : [0, 1, 2, 3];
  const framesPer = walk ? 16 : 4; // walk: 4 lados x 4 frames
  const W = (framesPer * states.length) * CW * S + 8 * S, H = results.length * CH * S;
  const out = new Uint8Array(W * H * 4);
  // fundo xadrez verde (grama)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, k = ((x / (S * 8) | 0) + (y / (S * 8) | 0)) % 2;
    out[i] = k ? 92 : 84; out[i + 1] = k ? 138 : 128; out[i + 2] = k ? 84 : 78; out[i + 3] = 255;
  }
  const put = (X, Y, r, g, b) => { for (let a = 0; a < S; a++) for (let c = 0; c < S; c++) { const i = ((Y * S + a) * W + X * S + c) * 4; out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255; } };
  const drawRgba = (src, sw, sx, sy, w, h, dx, dy) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = ((sy + y) * sw + sx + x) * 4; if (src[i + 3] < 128) continue; put(dx + x, dy + y, src[i], src[i + 1], src[i + 2]);
    }
  };
  results.forEach((r, oi) => {
    let k = 0;
    for (const st of states) {
      const on = r.addons.filter((_, i) => st & (1 << i));
      const frames = walk ? [0, 1, 2, 3].flatMap((col) => [0, 1, 2, 3].map((row) => [col, row])) : [0, 1, 2, 3].map((col) => [col, 0]);
      for (const [col, row] of frames) {
        const dx = k * CW + (walk ? 0 : Math.floor(k / 4) * 2), dy = oi * CH;
        // atrás → base → frente
        for (const ad of on) if (ad.back) drawRgba(ad.back, ad.SW, col * FW + cx0, row * FH + cy0, CW, CH, dx, dy);
        drawRgba(r.base.data, r.base.width, col * 16, row * 16, 16, 16, dx + (OX - cx0), dy + (OY - cy0));
        for (const ad of on) drawRgba(ad.front, ad.SW, col * FW + cx0, row * FH + cy0, CW, CH, dx, dy);
        k++;
      }
    }
  });
  writePng(join(OUT_DIR, walk ? "preview_walk.png" : "preview.png"), W, H, out);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = generateAll();
  console.log(`addons: ${r.reduce((s, o) => s + o.addons.length, 0)} overlays de ${r.length} roupas → assets/addons/`);
}
