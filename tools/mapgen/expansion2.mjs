// Costa Esmeralda: a segunda expansão a LESTE (depois das Terras Selvagens), com hunts nostálgicas do Tibia e quests de baú.
//
// Mesmo esquema de expansion.mjs: o mapa anterior (280 colunas) é copiado tile a tile para um mapa mais largo (as
// coordenadas não mudam) e a região nova é desenhada nas colunas x >= OLD_W. Mudanças no mapa anterior: três passagens
// abertas na borda leste das Terras Selvagens e a Cidadela de Ferumbras, cavada no subterrâneo vazio abaixo do
// Labirinto e do Abismo. Objetos novos entram DEPOIS dos antigos (ids antigos ficam estáveis).
//
// Superfície (y < OW_H):
//   Ilha Gelada          (N)    Acampamento Nórdico (PZ) .... lobos do inverno, bárbaros, bruxas do gelo (lv 50-62)
//   Selva de Banuta      (meio) ruínas + boca do templo ...... sibangs, kongras, tarântulas, merlkins, crocodilos, carniphilas (lv 25-40)
//   Porto Esperança      (L)    vila protegida na costa: loja, depósito, barco, missões
//   Praia                (L)    boca da Caverna dos Piratas
//   Vulcão de Goroma     (SE)   elementais de magma, cães infernais (lv 86-95); cratera murada (porta lv 80) com baú e
//                               a boca da Cidadela
// Subterrâneo:
//   Caverna dos Piratas (lv 30-42, Barba-Ruiva, Tesouro: porta lv 35, 4 baús) · Templo de Banuta (lv 26-45, Rei Kongra,
//   Santuário: porta lv 40, ídolo) · Caverna do Yeti (lv 50-70, Yeti, 3 baús) + Ninho dos Dragões de Gelo (porta: missão
//   "O Yeti") · Caverna dos Heróis (porta lv 60; heróis, necromantes; 4 baús) · Cidadela de Ferumbras (porta lv 100;
//   colossos, cães, demônios, Ferumbras; Aniquilação: 4 placas + alavanca → sala dos demônios → 4 baús).
import { GameMap, mulberry32, noise2, fbm, blobTable, blobMask, bfs } from './lib.mjs';

export const NEW_W2 = 400;

export function expand2({ old, ts, S, L, OW_H, spawnTile }) {
  const OLD_W = old.w, W = NEW_W2, H = old.h;
  const map = new GameMap(W, H, ts);
  for (const k of Object.keys(map.layers)) for (let y = 0; y < H; y++) for (let x = 0; x < OLD_W; x++) map.layers[k][y * W + x] = old.layers[k][y * OLD_W + x];
  for (let y = 0; y < H; y++) for (let x = 0; x < OLD_W; x++) map.occ[y * W + x] = old.occ[y * OLD_W + x];
  map.objects = old.objects.slice();
  map.nextId = old.nextId;
  // portais existentes (BFS da validação)
  const prop = (o, n) => o.properties?.find((p) => p.name === n)?.value;
  const oldPortals = old.objects.filter((o) => o.type === 'portal').map((o) => [o.x / 16, o.y / 16, prop(o, 'toX'), prop(o, 'toY')]);

  const rng = mulberry32(20261020);
  const rnd = (a, b) => a + rng() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const pickW = (pairs) => { let t = pairs.reduce((s, p) => s + p[1], 0), r = rng() * t; for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; } return pairs[0][0]; };
  const blob = blobTable();
  const idx = (x, y) => y * W + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

  // ================================================================== regiões da superfície
  const PORT = { x0: 360, y0: 52, x1: 386, y1: 70 };
  const CAMP = { x0: 328, y0: 16, x1: 342, y1: 27 };
  const CRATER = { x0: 362, y0: 96, x1: 382, y1: 112 };
  const inR = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  function regionAt(x, y) {
    if (x < OLD_W || y >= OW_H) return 'void';
    if (inR(PORT, x, y)) return 'port';
    if (inR(CAMP, x, y)) return 'camp';
    const w = (fbm(x, y, 12, 311) - 0.5) * 10;
    if (x >= 393 + Math.round(w * 0.4)) return 'sea';
    if (y < 40 + w) return 'glacier';
    if (x >= 387 + Math.round(w * 0.4)) return 'beach';
    if (inR(CRATER, x, y) || (y > 86 + w && x > 330 + w)) return 'volcano';
    return 'jungle';
  }
  const region = new Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) region[idx(x, y)] = regionAt(x, y);
  const reg = (x, y) => (inb(x, y) ? region[idx(x, y)] : 'void');
  const isLand = (x, y) => reg(x, y) !== 'void';
  const band = new Uint8Array(W * H);
  for (let y = 0; y < OW_H; y++) for (let x = OLD_W; x < W; x++) {
    if (reg(x, y) === 'sea') continue;
    outer: for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (!isLand(x + i, y + j)) { band[idx(x, y)] = 1; break outer; }
  }

  const dirt = new Uint8Array(W * H), water = new Uint8Array(W * H), pave = new Uint8Array(W * H);
  const roadPts = [];
  function disc(cx, cy, r, fn) {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      if (inb(x, y) && (x - cx) ** 2 + (y - cy) ** 2 <= r * r) fn(x, y);
    }
  }
  function road(points, width = 3, { wobble = 2.2, record = true, seed = 9 } = {}) {
    for (let s = 0; s < points.length - 1; s++) {
      const [ax, ay] = points[s], [bx, by] = points[s + 1];
      const len = Math.hypot(bx - ax, by - ay);
      const nx = -(by - ay) / (len || 1), ny = (bx - ax) / (len || 1);
      const steps = Math.ceil(len * 1.5);
      for (let k = 0; k <= steps; k++) {
        const t = k / steps, env = Math.sin(Math.PI * t) ** 0.5;
        const off = (noise2(ax + t * (bx - ax) + 500, ay + t * (by - ay) + 500, 7, seed) - 0.5) * 2 * wobble * (0.4 + env);
        const px = ax + (bx - ax) * t + nx * off, py = ay + (by - ay) * t + ny * off;
        disc(px, py, width / 2, (x, y) => { if (isLand(x, y) && !band[idx(x, y)] && reg(x, y) !== 'sea') dirt[idx(x, y)] = 1; });
        disc(px, py, width / 2 + 1.2, (x, y) => { if (x >= OLD_W) map.reserve(x, y); });
        if (record && k % 3 === 0) roadPts.push([Math.round(px), Math.round(py)]);
      }
    }
  }
  function lake(cx, cy, rx, ry, seed) {
    const r0 = reg(Math.round(cx), Math.round(cy));
    for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y++) for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) {
      if (!inb(x, y) || band[idx(x, y)] || reg(x, y) !== r0) continue;
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2, n = (noise2(x, y, 4, seed) - 0.5) * 0.7;
      if (d + n < 1 && map.occ[idx(x, y)] === 0) water[idx(x, y)] = 1;
    }
  }

  // ================================================================== estradas
  // passagens: corredores horizontais atravessando a borda leste das Terras Selvagens (y = 24, 69, 94)
  // `snow`: trilha de neve (a passagem norte cruza os Picos Gelados); as outras, terra escura
  const PASSAGES = [{ y: 24, x0: 256, x1: 285, snow: true }, { y: 69, x0: 262, x1: 285 }, { y: 94, x0: 252, x1: 285 }];
  const CAMP_W = [CAMP.x0, 22], CAMP_E = [CAMP.x1, 22];
  const PORT_W = [PORT.x0, 61], PORT_N = [373, PORT.y0], PORT_S = [373, PORT.y1], PORT_E = [PORT.x1, 61];
  const MOUTH = { pirate: [386, 40], temple: [343, 70], yeti: [290, 8], hero: [314, 82], citadel: [371, 104] }; // canto sup. esq. (3x3)
  road([[284, 24], [298, 23], [314, 22], CAMP_W], 3);
  road([CAMP_E, [350, 27], [358, 36], [366, 46], PORT_N], 3);
  road([[284, 69], [300, 68], [318, 64], [338, 62], PORT_W], 3);
  road([[284, 94], [298, 92], [312, 90], [326, 92], [340, 94], [356, 92], [372, 90], [372, 94]], 3);
  road([PORT_S, [372, 80], [372, 90]], 3);
  road([PORT_E, [390, 61]], 2, { record: false });
  road([[318, 64], [314, 74], [315, 84]], 2);                       // boca da Caverna dos Heróis
  road([[338, 62], [344, 68], [344, 72]], 2);                       // ruínas do templo
  road([[366, 46], [378, 44], [387, 43]], 2);                       // boca da Caverna dos Piratas
  road([[298, 23], [294, 14], [291, 11]], 2);                       // boca da Caverna do Yeti
  road([[372, 94], [372, 95]], 2, { record: false });               // porta da cratera

  // ================================================================== spawns da superfície (antes da vegetação)
  const spawns = [
    // Ilha Gelada (lv 50-62)
    ['winter_wolf', 4, 5, 50, 300, 32], ['winter_wolf', 4, 5, 50, 314, 10], ['winter_wolf', 4, 5, 50, 352, 34],
    ['barbarian', 4, 5, 55, 362, 10], ['barbarian', 4, 5, 55, 378, 24],
    ['ice_witch', 3, 4, 62, 300, 16], ['ice_witch', 3, 4, 62, 384, 8],
    // Selva de Banuta (lv 26-40)
    ['sibang', 4, 5, 26, 296, 50], ['sibang', 4, 5, 26, 312, 56],
    ['kongra', 4, 5, 28, 300, 80], ['kongra', 4, 5, 28, 330, 50],
    ['tarantula', 4, 5, 30, 348, 46], ['tarantula', 3, 5, 30, 328, 80],
    ['merlkin', 3, 4, 32, 334, 74], ['merlkin', 3, 4, 32, 354, 78],
    ['crocodile', 3, 4, 36, 300, 100], ['crocodile', 3, 4, 36, 322, 104],
    ['carniphila', 3, 4, 40, 308, 88], ['carniphila', 3, 4, 40, 344, 56],
    // Vulcão de Goroma (lv 86-95)
    ['magma_elemental', 3, 5, 86, 344, 102], ['magma_elemental', 3, 4, 86, 352, 114], ['magma_elemental', 3, 4, 86, 388, 92],
    ['hellhound', 2, 4, 95, 360, 90], ['hellhound', 2, 4, 95, 388, 110],
  ];
  for (const [, , r, , x, y] of spawns) { const rr = Math.max(2, r - 2); map.reserve(x - rr, y - rr, rr * 2 + 1, rr * 2 + 1); }
  const nearestRoad = (x, y) => { let best = null, bd = 1e9; for (const p of roadPts) { const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; best = p; } } return best; };
  for (const [, , , , x, y] of spawns) { const rp = nearestRoad(x, y); if (rp && (rp[0] - x) ** 2 + (rp[1] - y) ** 2 > 36) road([[x, y], rp], 2, { record: false, wobble: 3 }); }

  // ================================================================== água
  lake(302, 93, 5, 3, 401);     // lagos dos crocodilos (sudoeste da selva)
  lake(322, 110, 6, 3, 402);
  lake(356, 14, 5, 3, 403);     // lago congelado
  lake(336, 84, 3, 2, 404);
  for (const r of [PORT, CAMP, CRATER]) for (let y = r.y0 - 2; y <= r.y1 + 2; y++) for (let x = r.x0 - 2; x <= r.x1 + 2; x++) if (inb(x, y)) water[idx(x, y)] = 0;
  for (let y = 0; y < OW_H; y++) for (let x = OLD_W; x < W; x++) if (reg(x, y) === 'sea') water[idx(x, y)] = 1;
  for (let y = 0; y < H; y++) for (let x = OLD_W; x < W; x++) {
    if (!dirt[idx(x, y)]) continue;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (inb(x + i, y + j) && water[idx(x + i, y + j)]) dirt[idx(x, y)] = 0;
  }
  // chão de terra no acampamento e na cratera; praças calçadas no porto
  for (let y = CAMP.y0 + 1; y < CAMP.y1; y++) for (let x = CAMP.x0 + 1; x < CAMP.x1; x++) dirt[idx(x, y)] = 1;
  for (let y = CRATER.y0 + 1; y < CRATER.y1; y++) for (let x = CRATER.x0 + 1; x < CRATER.x1; x++) dirt[idx(x, y)] = 1;
  for (let y = 59; y <= 66; y++) for (let x = 364; x <= 382; x++) pave[idx(x, y)] = 1;
  map.reserve(CRATER.x0 - 1, CRATER.y0 - 1, CRATER.x1 - CRATER.x0 + 3, CRATER.y1 - CRATER.y0 + 3);
  map.reserve(351, 68, 5, 5); // esconderijo da selva (baú em 353,70)

  // ================================================================== chão
  const STYLE = {
    glacier: { grass: [0, 19], tufts: [[1, 19], [2, 19], [3, 19], [4, 19]], dirt: ['F', 0, 7], water: ['W', 13, -7] },
    camp: { grass: [0, 19], tufts: [[1, 19], [2, 19]], dirt: ['F', 0, 7], water: ['W', 13, -7] },
    jungle: { grass: [11, 12], tufts: [[12, 12], [13, 12], [14, 12], [15, 12]], dirt: ['F', 11, 0], water: ['W', 0, -1] },
    beach: { grass: [0, 5], tufts: [[1, 5], [2, 5], [3, 5], [4, 5]], dirt: ['F', 0, -7], water: ['W', 0, -7] },
    sea: { grass: [0, 5], tufts: [[0, 5]], dirt: ['F', 0, -7], water: ['W', 0, -7] },
    port: { grass: [0, 12], tufts: [[1, 12], [2, 12], [3, 12], [4, 12]], dirt: ['F', 0, 0], water: ['W', 0, -1] },
    volcano: null, // pedra vulcânica (piso de caverna, velocidade normal) + rachaduras de lava
  };
  const volcanoGround = (x, y) => { const [c, r] = rng() < 0.08 ? pick([[11, 18], [12, 18]]) : [12, 15]; map.put('ground', x, y, 'C', c, r); };
  for (let y = 0; y < OW_H; y++) for (let x = OLD_W; x < W; x++) {
    const r = reg(x, y);
    if (r === 'void') { map.put('ground', x, y, 'O', 1, 1); map.block(x, y); continue; }
    if (r === 'volcano') {
      volcanoGround(x, y);
      if (dirt[idx(x, y)] && inR(CRATER, x, y)) { const [c, rr] = pick([[20, 14], [21, 14], [20, 15], [21, 15]]); map.put('ground', x, y, 'I', c, rr); }
      continue;
    }
    const st = STYLE[r];
    const [gc, gr] = rng() < 0.16 ? pick(st.tufts) : st.grass;
    map.put('ground', x, y, 'F', gc, gr);
    if (water[idx(x, y)]) {
      const [t, dc, dr] = st.water;
      const [c, rr] = blob[blobMask((a, b) => !inb(a, b) || a >= W - 1 ? true : water[idx(a, b)] === 1, x, y)];
      map.put('ground', x, y, t, c + dc, rr + dr); map.block(x, y);
    } else if (pave[idx(x, y)]) {
      const inP = (a, b) => inb(a, b) && pave[idx(a, b)] === 1;
      const top = !inP(x, y - 1), bot = !inP(x, y + 1), lef = !inP(x - 1, y), rig = !inP(x + 1, y);
      map.put('ground', x, y, 'I', lef ? 0 : rig ? 2 : 1, top ? 12 : bot ? 15 : 13);
    } else if (dirt[idx(x, y)]) {
      const [t, dc, dr] = st.dirt;
      const mask = blobMask((a, b) => !inb(a, b) ? false : (dirt[idx(a, b)] === 1 || pave[idx(a, b)] === 1) && reg(a, b) === r, x, y);
      const [c, rr] = blob[mask];
      map.put('ground', x, y, t, c + dc, rr + dr);
    }
  }

  // ================================================================== colocação
  const walkableGround = (x, y) => inb(x, y) && isLand(x, y) && !band[idx(x, y)] && !dirt[idx(x, y)] && !water[idx(x, y)] && !pave[idx(x, y)];
  function place(name, x, y, { check = true } = {}) {
    const [t, c, r, w, h, o = {}] = S[name];
    if (check) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!walkableGround(x + i, y + j) || map.occ[idx(x + i, y + j)]) return false;
    map.stamp(t, c, r, w, h, x, y, o);
    return true;
  }
  const put1 = (x, y, t, c, r, { block = false, layer = 'deco' } = {}) => { map.put(layer, x, y, t, c, r); if (block) map.block(x, y); };
  const lights = [];
  const light = (x, y, radius, color, flicker) => lights.push([x, y, radius, color, flicker]);
  const brazier = (x, y, color = '#ff9a3c') => { map.layers.deco[idx(x, y)] = L.S.brazier; map.block(x, y); light(x, y, 6, color, true); };
  function fenceH(y, x0, x1, gaps) { for (let x = x0; x <= x1; x++) { if (gaps.some(([a, b]) => x >= a && x <= b)) continue; map.layers.deco[idx(x, y)] = ts.gid('H', x % 2 ? 11 : 12, 5); map.block(x, y); map.reserve(x, y); } }
  function fenceV(x, y0, y1, gaps) { for (let y = y0; y <= y1; y++) { if (gaps.some(([a, b]) => y >= a && y <= b)) continue; map.layers.deco[idx(x, y)] = ts.gid('H', 11, 6); map.block(x, y); map.reserve(x, y); } }

  // ---- Porto Esperança (zona de proteção): paliçada, loja, templo, depósito, praça
  fenceH(PORT.y0, PORT.x0, PORT.x1, [[371, 374]]);
  fenceH(PORT.y1, PORT.x0, PORT.x1, [[371, 374]]);
  fenceV(PORT.x0, PORT.y0, PORT.y1, [[59, 62]]);
  fenceV(PORT.x1, PORT.y0, PORT.y1, [[59, 62]]);
  place('shopBlue', 363, 54, { check: false });     // loja, porta (364,56)
  place('houseBeige', 368, 53, { check: false });   // capela, porta (369,55)
  place('inn', 377, 54, { check: false });          // depósito, porta (379,56)
  place('houseOrange', 362, 67, { check: false });  // casas do porto (decoração)
  place('houseRed', 379, 67, { check: false });
  place('well', 376, 62, { check: false });
  for (const [x, y] of [[364, 59], [382, 59], [364, 66], [382, 66]]) { place('lamp', x, y - 1, { check: false }); light(x, y, 5, '#ffc060', true); }
  for (const [x, y] of [[383, 54], [383, 57]]) place('barrel', x, y, { check: false });
  map.reserve(PORT.x0, PORT.y0, PORT.x1 - PORT.x0 + 1, PORT.y1 - PORT.y0 + 1);

  // ---- Acampamento Nórdico (zona de proteção): paliçada, tendas, fogueira
  fenceH(CAMP.y0, CAMP.x0, CAMP.x1, []);
  fenceH(CAMP.y1, CAMP.x0, CAMP.x1, []);
  fenceV(CAMP.x0, CAMP.y0, CAMP.y1, [[21, 23]]);
  fenceV(CAMP.x1, CAMP.y0, CAMP.y1, [[21, 23]]);
  place('yurt', 330, 17, { check: false });
  place('yurt', 337, 17, { check: false });
  brazier(335, 25, '#ffb050');
  map.reserve(CAMP.x0, CAMP.y0, CAMP.x1 - CAMP.x0 + 1, CAMP.y1 - CAMP.y0 + 1);

  const npcs = [
    ['port_trader', 364, 57], ['port_priest', 369, 56], ['port_depot', 379, 57], ['explorer_jairo', 366, 64],
    ['sage_ignis', 380, 64], ['port_captain', 384, 61], ['jarl_haakon', 336, 21], ['camp_trader', 331, 22],
  ];

  // ---- Cratera do Vulcão: muralha de pedra; porta de level 80 ao norte (entra) e saída ao lado
  const CRATER_DOOR = [372, CRATER.y0], CRATER_EXIT = [374, CRATER.y0];
  for (let x = CRATER.x0; x <= CRATER.x1; x++) for (const y of [CRATER.y0, CRATER.y1]) { map.put('deco', x, y, 'R', x === CRATER.x0 ? 4 : x === CRATER.x1 ? 6 : 5, y === CRATER.y0 ? 0 : 2); map.block(x, y); }
  for (let y = CRATER.y0 + 1; y < CRATER.y1; y++) for (const x of [CRATER.x0, CRATER.x1]) { map.put('deco', x, y, 'R', x === CRATER.x0 ? 4 : 6, 1); map.block(x, y); }
  map.put('deco', CRATER_DOOR[0], CRATER_DOOR[1], 'G', 0, 0); map.block(CRATER_DOOR[0], CRATER_DOOR[1], false);
  map.put('deco', CRATER_EXIT[0], CRATER_EXIT[1], 'D', 1, 0); map.block(CRATER_EXIT[0], CRATER_EXIT[1], false);
  for (const [x, y] of [[365, 99], [379, 99], [365, 109], [379, 109]]) brazier(x, y, '#ff5a2a');

  // ---- bocas de caverna
  for (const [k, [x, y]] of Object.entries(MOUTH)) {
    place('caveMouthGray', x, y, { check: false });
    map.reserve(x - 2, y - 2, 7, 7);
    if (k === 'citadel') for (const [lx, ly] of [[x - 1, y + 2], [x + 3, y + 2]]) light(lx, ly, 4, '#ff4020', true);
  }

  // ---- Ruínas de Banuta (ao redor da boca do templo) + esconderijo (baú)
  for (const [n, x, y] of [['ruinHouse', 334, 64], ['ruinWall', 350, 66], ['ruinStatue', 336, 76], ['ruinHouse2', 350, 74]]) place(n, x, y);
  for (const [x, y] of [[340, 68], [348, 68]]) { const t = L.S.totem[(x / 4) & 1]; if (!map.blocked(x, y) && !map.blocked(x, y - 1)) { map.layers.above[idx(x, y - 1)] = t[0][0]; map.layers.deco[idx(x, y)] = t[1][0]; map.block(x, y); } }
  const BANUTA_CACHE = [353, 70];

  // ---- praia: barcos? não há arte; barris e pedras na areia
  for (let k = 0; k < 10; k++) { const x = ri(387, 391), y = ri(42, 110); if (reg(x, y) === 'beach' && walkableGround(x, y) && !map.occ[idx(x, y)]) place(pick(['barrel', 'rockSmallBrown']), x, y); }

  // ================================================================== vegetação e pedras
  const TREES = {
    glacier: { dense: [['treePine4', 3], ['rockGray4', 1]], mid: [['treePine2', 4], ['rockGrayA', 1], ['boulderGray', 1]], small: [['rockSmallGray', 1]] },
    jungle: { dense: [['treeOliveB4', 3], ['treeSwamp4', 2], ['treeBig3Olive', 2]], mid: [['treeOliveB2', 3], ['treeSwamp2', 2], ['treeRound2', 2], ['bushA', 2]], small: [['bushA', 1]] },
    beach: { dense: [['rockBrownA', 1]], mid: [['rockSmallBrown', 1]], small: [['rockSmallBrown', 1]] },
    volcano: { dense: [['rockGray4', 2], ['treeDead4', 1]], mid: [['rockGrayA', 2], ['rockGrayB', 2], ['treeDead2', 1], ['boulderGray', 1]], small: [['rockSmallGray', 1]] },
  };
  const volcanoFree = (x, y) => inb(x, y) && reg(x, y) === 'volcano' && !band[idx(x, y)] && !dirt[idx(x, y)] && !map.occ[idx(x, y)] && !map.blocked(x, y);
  for (let y = 0; y < OW_H; y++) for (let x = OLD_W; x < W; x++) {
    const r = reg(x, y), set = TREES[r];
    if (!set || band[idx(x, y)]) continue;
    const n = fbm(x, y, 15, 541);
    const dense = r === 'jungle' ? 0.44 : r === 'glacier' ? 0.52 : 0.56, mid = dense - 0.1;
    let p, pool;
    if (n > dense) { p = r === 'beach' ? 0.05 : r === 'jungle' ? 0.55 : 0.4; pool = set.dense.concat(set.mid.map(([a, b]) => [a, b * 0.4])); }
    else if (n > mid) { p = r === 'jungle' ? 0.16 : 0.1; pool = set.mid; }
    else { p = r === 'jungle' ? 0.03 : 0.01; pool = set.small; }
    if (rng() >= p) continue;
    const name = pickW(pool);
    if (r === 'volcano') {
      const [, , , w, h] = S[name];
      let ok = true; for (let j = 0; j < h && ok; j++) for (let i = 0; i < w; i++) if (!volcanoFree(x + i, y + j)) { ok = false; break; }
      if (ok) place(name, x, y, { check: false });
    } else place(name, x, y);
  }
  // decoração de chão
  for (let y = 0; y < OW_H; y++) for (let x = OLD_W; x < W; x++) {
    const r = reg(x, y);
    if (r === 'volcano') {
      if (!volcanoFree(x, y) || map.layers.deco[idx(x, y)] || map.layers.above[idx(x, y)]) continue;
      if (rng() < 0.035) { map.layers.deco[idx(x, y)] = pick(L.S.crackLava); if (rng() < 0.3) light(x, y, 3, '#ff6020', true); }
      else if (rng() < 0.02) map.layers.deco[idx(x, y)] = pick(L.S.rubbleGray);
      continue;
    }
    if (!walkableGround(x, y) || map.occ[idx(x, y)] || map.layers.deco[idx(x, y)] || map.layers.above[idx(x, y)]) continue;
    if (r === 'jungle' && rng() < 0.05) put1(x, y, 'FD', pick([0, 1, 2, 3, 4]), 2);
    else if (r === 'jungle' && rng() < 0.012) map.layers.deco[idx(x, y)] = pick(L.S.shroomRed);
    else if (r === 'glacier' && rng() < 0.01) put1(x, y, 'FD', pick([14, 15]), 0);
    else if (r === 'beach' && rng() < 0.02) put1(x, y, 'FD', pick([14, 15, 5]), 0);
  }
  // cratera: rachaduras de lava e ossos
  for (let y = CRATER.y0 + 2; y < CRATER.y1 - 1; y++) for (let x = CRATER.x0 + 2; x < CRATER.x1 - 1; x++) {
    if (map.blocked(x, y) || map.layers.deco[idx(x, y)] || map.layers.above[idx(x, y)] || map.occ[idx(x, y)]) continue;
    if (rng() < 0.06) { map.layers.deco[idx(x, y)] = pick(L.S.crackLava); light(x, y, 3, '#ff6020', true); }
  }

  // ---- borda: árvores/pedras densas (tudo bloqueado)
  for (let y = 0; y < OW_H; y++) for (let x = OLD_W; x < W; x++) if (band[idx(x, y)]) map.block(x, y);
  const BAND = { glacier: ['treePine4', 'rockGray4'], jungle: ['treeOliveB4', 'treeSwamp4'], beach: ['rockBrown4'], volcano: ['rockGray4'], port: ['treeOliveB4'], camp: ['treePine4'] };
  const BAND2 = { glacier: ['treePine2', 'rockGrayA'], jungle: ['treeOliveB2', 'treeSwamp2'], beach: ['rockBrownA'], volcano: ['rockGrayA', 'treeDead2'], port: ['treeOliveB2'], camp: ['treePine2'] };
  for (const pass of [BAND, BAND2]) for (let y = 0; y < OW_H; y++) for (let x = OLD_W; x < W; x++) {
    if (!band[idx(x, y)] || map.layers.deco[idx(x, y)] || map.layers.above[idx(x, y)]) continue;
    const [t, c, rr, w, h] = S[pick(pass[reg(x, y)] ?? pass.jungle)];
    let ok = true;
    for (let j = 0; j < h && ok; j++) for (let i = 0; i < w; i++) { const a = x + i, b = y + j; if (!inb(a, b) || !isLand(a, b) || reg(a, b) === 'sea' || map.occ[idx(a, b)] || dirt[idx(a, b)] || water[idx(a, b)] || map.layers.deco[idx(a, b)]) { ok = false; break; } }
    if (ok) map.stamp(t, c, rr, w, h, x, y, { baseRows: 1 });
  }
  for (let y = 0; y < OW_H; y++) for (let x = OLD_W; x < W; x++) {
    if (!band[idx(x, y)] || map.layers.deco[idx(x, y)] || map.layers.above[idx(x, y)] || water[idx(x, y)] || dirt[idx(x, y)]) continue;
    const r = reg(x, y);
    put1(x, y, 'N', r === 'glacier' || r === 'volcano' ? pick([6, 7, 8]) : pick([0, 1, 2, 3, 5, 8]), r === 'glacier' || r === 'volcano' ? 12 : 10, { block: true });
  }

  // ================================================================== passagens na borda leste das Terras Selvagens
  const passages = [];
  function passage({ y, x0, x1, snow = false }) {
    const [c0, r0] = blob['11111111'], [c, r] = snow ? [c0, r0 + 7] : [c0 + 11, r0];
    for (let x = x0; x <= x1; x++) {
      for (let yy = y - 4; yy <= y + 1; yy++) map.layers.above[idx(x, yy)] = 0;
      for (let yy = y - 1; yy <= y + 1; yy++) {
        const i = idx(x, yy);
        map.layers.deco[i] = 0; map.layers.collision[i] = 0;
        map.put('ground', x, yy, 'F', c, r);
      }
      for (const yy of [y - 2, y + 2]) { const i = idx(x, yy); if (map.layers.collision[i] && !map.layers.deco[i]) map.put('deco', x, yy, 'N', pick([6, 7, 8]), 12); }
    }
    passages.push([x0, y, x1]);
  }
  for (const p of PASSAGES) passage(p);
  for (const p of PASSAGES) for (const dy of [-2, 2]) brazier(OLD_W + 5, p.y + dy, '#ffb050');

  // ================================================================== SUBTERRÂNEO
  // floor: 0 = nada, 1 = caverna, 2 = gelo, 3 = templo (pedra verde), 4 = cidadela (pedra escura)
  const floorG = new Uint8Array(W * H);
  const carve = (x0, y0, x1, y1, style, chamfer = 0) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (chamfer) { const dx = Math.min(x - x0, x1 - x), dy = Math.min(y - y0, y1 - y); if (dx + dy < chamfer) continue; }
      floorG[idx(x, y)] = style;
    }
  };
  const CAVE = 1, ICE = 2, TEMPLE = 3, DARK = 4;
  // ---- Caverna dos Piratas
  carve(286, 130, 296, 137, CAVE, 1);   // P0 entrada
  carve(290, 138, 292, 141, CAVE);
  carve(284, 142, 306, 156, CAVE, 2);   // P1 saqueadores
  carve(305, 142, 313, 144, CAVE);
  carve(312, 128, 330, 146, CAVE, 2);   // P2 corsários
  carve(320, 147, 322, 152, CAVE);
  carve(308, 153, 334, 168, CAVE, 2);   // P3 bucaneiros
  carve(335, 159, 338, 161, CAVE);
  carve(339, 152, 352, 166, CAVE, 2);   // P4 Barba-Ruiva
  carve(358, 154, 368, 164, CAVE, 1);   // P5 tesouro (isolado; porta lv 35)
  // ---- Templo de Banuta
  carve(376, 128, 386, 135, TEMPLE, 1); // T0 entrada
  carve(380, 136, 382, 139, TEMPLE);
  carve(372, 140, 396, 154, TEMPLE, 2); // T1 kongras + tarântulas
  carve(383, 155, 385, 158, TEMPLE);
  carve(372, 159, 396, 170, TEMPLE, 2); // T2 merlkins
  carve(374, 178, 394, 190, TEMPLE, 2); // T3 santuário (isolado; porta lv 40)
  // ---- Caverna do Yeti + Ninho dos Dragões de Gelo
  carve(286, 180, 296, 187, ICE, 1);    // Y0 entrada
  carve(290, 188, 292, 191, ICE);
  carve(284, 192, 306, 204, ICE, 2);    // Y1 lobos
  carve(307, 197, 311, 199, ICE);
  carve(312, 188, 330, 206, ICE, 2);    // Y2 bruxas
  carve(320, 207, 322, 211, ICE);
  carve(310, 212, 334, 226, ICE, 3);    // Y3 covil do Yeti + baús
  carve(342, 192, 368, 214, ICE, 3);    // N ninho (isolado; porta: missão "O Yeti")
  // ---- Caverna dos Heróis
  carve(286, 234, 296, 241, CAVE, 1);   // H0 antessala (porta lv 60 ao sul)
  carve(286, 250, 300, 258, CAVE, 1);   // H1 entrada (isolada)
  carve(301, 253, 305, 255, CAVE);
  carve(306, 244, 330, 262, CAVE, 2);   // H2 heróis
  carve(331, 252, 335, 254, CAVE);
  carve(336, 240, 360, 262, CAVE, 2);   // H3 necromantes + heróis
  carve(347, 263, 349, 267, CAVE);
  carve(338, 268, 358, 278, CAVE, 2);   // H4 tesouro
  // ---- Cidadela de Ferumbras (subterrâneo vazio abaixo do Labirinto e do Abismo, x 160-279)
  carve(214, 212, 226, 220, DARK, 1);   // C0 antessala (porta lv 100 ao sul)
  carve(212, 228, 228, 236, DARK, 1);   // C1 saguão (isolado)
  carve(204, 231, 211, 233, DARK);
  carve(170, 224, 203, 244, DARK, 2);   // C2 colossos + cães
  carve(229, 231, 236, 233, DARK);
  carve(237, 224, 270, 244, DARK, 2);   // C3 demônios + cães
  carve(219, 237, 221, 248, DARK);
  carve(204, 249, 236, 268, DARK, 3);   // C4 trono de Ferumbras
  carve(185, 245, 187, 250, DARK);
  carve(176, 251, 196, 257, DARK, 1);   // L sala da alavanca (4 placas)
  carve(166, 272, 196, 282, DARK, 1);   // A arena da Aniquilação (só por alavanca)
  carve(204, 274, 214, 282, DARK, 1);   // R tesouro da Aniquilação (só pela arena)
  // pilares de rocha
  for (const [px, py] of [[290, 146], [300, 152], [318, 134], [324, 140], [316, 160], [326, 162], [378, 145], [390, 149], [378, 164], [390, 165],
    [292, 197], [300, 199], [318, 194], [324, 200], [180, 230], [194, 238], [246, 230], [262, 238], [212, 255], [228, 255], [212, 262], [228, 262],
    [314, 250], [322, 256], [344, 246], [352, 256]]) floorG[idx(px, py)] = 0;

  const isFloor = (x, y) => inb(x, y) && floorG[idx(x, y)] !== 0;
  const inDungeonArea = (x, y) => y >= OW_H && x >= 160;
  const wall = new Uint8Array(W * H);
  for (let y = OW_H; y < H; y++) for (let x = 160; x < W; x++) {
    if (isFloor(x, y)) continue;
    let w = false;
    for (let j = -1; j <= 1 && !w; j++) for (let i = -1; i <= 1; i++) if (isFloor(x + i, y + j)) { w = true; break; }
    if (!w && isFloor(x, y + 2)) w = true;
    if (w) wall[idx(x, y)] = 1;
  }
  const isWall = (x, y) => inb(x, y) && wall[idx(x, y)] === 1;
  // o subterrâneo novo não pode encostar no antigo (Labirinto, Abismo): confere antes de desenhar
  for (let y = OW_H; y < H; y++) for (let x = 160; x < OLD_W; x++) {
    if ((isFloor(x, y) || isWall(x, y)) && (old.layers.collision[y * OLD_W + x] === 0 || old.layers.deco[y * OLD_W + x] !== 0)) {
      throw new Error(`EXPANSION2: cidadela encosta no subterrâneo antigo em ${x},${y}`);
    }
  }
  for (let y = OW_H; y < H; y++) for (let x = 160; x < W; x++) {
    if (!inDungeonArea(x, y)) continue;
    const f = floorG[idx(x, y)];
    if (f) {
      map.layers.deco[idx(x, y)] = 0; map.layers.above[idx(x, y)] = 0;
      map.block(x, y, false);
      if (f === DARK) { const [c, r] = pick([[20, 14], [21, 14], [20, 15], [21, 15]]); map.put('ground', x, y, 'I', c, r); }
      else if (f === ICE) map.put('ground', x, y, 'F', 1, 22);
      else if (f === TEMPLE) map.put('ground', x, y, 'I', 15 + (x & 3), 6 + (y & 3));
      else { let [c, r] = [12, 15]; if (rng() < 0.05) [c, r] = pick([[11, 18], [12, 18]]); map.put('ground', x, y, 'C', c, r); }
    } else if (isWall(x, y)) {
      const above = isWall(x, y - 1), below = isWall(x, y + 1), left = isWall(x - 1, y), right = isWall(x + 1, y);
      const row = isFloor(x, y + 1) ? 2 : !above ? 0 : !below ? 2 : 1;
      map.layers.above[idx(x, y)] = 0;
      if (x >= OLD_W) map.put('ground', x, y, 'O', 1, 1);
      map.put('deco', x, y, 'R', !left ? 4 : !right ? 6 : 5, row); map.block(x, y);
    } else if (x >= OLD_W) { map.put('ground', x, y, 'O', 1, 1); map.block(x, y); }
  }

  // ---- portas: [tile da porta (parede), destino, props extras, arte]
  const mouthDoor = (k) => [MOUTH[k][0] + 1, MOUTH[k][1] + 2];
  const below = ([x, y]) => [x, y + 1];
  const doorDefs = [
    // entradas das cavernas (boca → sala de entrada) e saídas (porta da parede norte → abaixo da boca)
    { at: mouthDoor('pirate'), to: [291, 133] }, { at: [291, 129], to: below(mouthDoor('pirate')), art: ['D', 1, 0] },
    { at: mouthDoor('temple'), to: [381, 131] }, { at: [381, 127], to: below(mouthDoor('temple')), art: ['D', 1, 0] },
    { at: mouthDoor('yeti'), to: [291, 183] }, { at: [291, 179], to: below(mouthDoor('yeti')), art: ['D', 1, 0] },
    { at: mouthDoor('hero'), to: [291, 237] }, { at: [291, 233], to: below(mouthDoor('hero')), art: ['D', 1, 0] },
    { at: mouthDoor('citadel'), to: [220, 215] }, { at: [220, 211], to: below(mouthDoor('citadel')), art: ['D', 2, 0] },
    // portas de quest (a arte da fechadura) e as saídas de volta
    { at: [353, 159], to: [360, 159], req: { minLevel: 35 }, art: ['G', 0, 0] }, { at: [357, 159], to: [351, 159], art: ['D', 1, 0] },
    { at: [384, 171], to: [384, 180], req: { minLevel: 40 }, art: ['G', 0, 0] }, { at: [384, 177], to: [384, 169], art: ['D', 1, 0] },
    { at: [335, 219], to: [345, 203], req: { quest: 'yeti_hunt' }, art: ['G', 1, 0] }, { at: [341, 203], to: [333, 219], art: ['D', 1, 0] },
    { at: [291, 242], to: [291, 252], req: { minLevel: 60 }, art: ['G', 0, 0] }, { at: [291, 249], to: [291, 240], art: ['D', 1, 0] },
    { at: [220, 221], to: [220, 230], req: { minLevel: 100 }, art: ['G', 1, 0] }, { at: [220, 227], to: [220, 219], art: ['D', 2, 0] },
    { at: CRATER_DOOR, to: [372, CRATER.y0 + 2], req: { minLevel: 80 } }, { at: CRATER_EXIT, to: [374, CRATER.y0 - 1] },
    // Aniquilação: arena → tesouro (sem volta) e tesouro → antessala da cidadela
    { at: [197, 277], to: [206, 278], art: ['G', 1, 0] }, { at: [209, 273], to: [220, 216], art: ['D', 2, 0] },
  ];
  for (const d of doorDefs) if (d.art) { map.put('deco', d.at[0], d.at[1], ...d.art); map.block(d.at[0], d.at[1], false); }

  // ---- baús de quest (tile bloqueado com a arte do baú) e Aniquilação (placas + alavanca)
  const chests = [
    ['banuta_cache', ...BANUTA_CACHE],
    ['pirate_saber', 366, 156], ['pirate_bow', 366, 158], ['pirate_wand', 366, 160], ['pirate_rod', 366, 162],
    ['banuta_idol', 384, 188],
    ['frost_ring', 318, 225], ['frost_might', 322, 225], ['frost_amulet', 326, 225],
    ['hero_sword', 342, 276], ['hero_bow', 346, 276], ['hero_wand', 350, 276], ['hero_rod', 354, 276],
    ['volcano_summit', 378, 100],
    ['anni_armor', 212, 275], ['anni_sword', 212, 277], ['anni_axe', 212, 279], ['anni_bear', 212, 281],
  ];
  for (const [, x, y] of chests) { map.layers.above[idx(x, y)] = 0; map.put('deco', x, y, 'E', 3, 1); map.block(x, y); }
  const ANNI = {
    lever: [187, 253],
    plates: [[180, 254], [182, 254], [184, 254], [186, 254]],
    dests: [[168, 275], [168, 277], [168, 279], [168, 281]],
    room: [166, 272, 196, 282],
    spawns: [[186, 274], [188, 278], [186, 281], [192, 274], [193, 278], [192, 281]],
  };
  for (const [x, y] of ANNI.plates) map.put('deco', x, y, 'G', 0, 1);
  map.put('deco', ANNI.lever[0], ANNI.lever[1], 'G', 3, 3); map.block(ANNI.lever[0], ANNI.lever[1]);

  // ---- spawns do subterrâneo
  const dungeonSpawns = [
    // Caverna dos Piratas
    ['pirate_marauder', 4, 5, 30, 292, 149], ['pirate_marauder', 3, 4, 30, 302, 145],
    ['pirate_corsair', 4, 5, 35, 321, 137], ['pirate_marauder', 2, 4, 30, 316, 131],
    ['pirate_buccaneer', 4, 5, 38, 320, 162], ['pirate_corsair', 2, 4, 35, 330, 156],
    ['captain_redbeard', 1, 3, 42, 346, 159],
    // Templo de Banuta
    ['kongra', 3, 4, 28, 378, 148], ['tarantula', 3, 4, 30, 390, 145], ['sibang', 3, 4, 26, 384, 151],
    ['merlkin', 4, 5, 32, 384, 165], ['tarantula', 2, 4, 30, 376, 163],
    ['kongra_king', 1, 3, 45, 384, 184],
    // Caverna do Yeti + ninho
    ['winter_wolf', 4, 5, 50, 295, 198], ['ice_witch', 3, 4, 62, 321, 196], ['winter_wolf', 2, 4, 50, 318, 203],
    ['yeti', 1, 3, 70, 322, 218],
    ['frost_dragon', 3, 5, 80, 352, 200], ['frost_dragon', 3, 5, 80, 360, 208],
    // Caverna dos Heróis
    ['hero', 4, 5, 72, 318, 252], ['hero', 3, 4, 72, 342, 252], ['necromancer', 3, 5, 68, 352, 248], ['necromancer', 2, 4, 68, 348, 258],
    // Cidadela de Ferumbras
    ['juggernaut', 3, 5, 110, 186, 232], ['hellhound', 3, 5, 95, 194, 240],
    ['demon', 3, 5, 100, 252, 232], ['hellhound', 2, 4, 95, 260, 240],
    ['ferumbras', 1, 3, 140, 220, 260],
  ];
  // decoração do subterrâneo (só em células com os 8 vizinhos abertos e longe de portas, baús e placas)
  const protect = new Set(dungeonSpawns.map((s) => `${s[4]},${s[5]}`)
    .concat(doorDefs.flatMap((d) => [d.to.join(), d.at.join()]))
    .concat(chests.flatMap(([, x, y]) => [`${x},${y}`, `${x - 1},${y}`, `${x + 1},${y}`, `${x},${y - 1}`, `${x},${y + 1}`]))
    .concat(ANNI.plates.map((p) => p.join()), ANNI.dests.map((p) => p.join()), ANNI.spawns.map((p) => p.join()), [ANNI.lever.join()]));
  const nearProtected = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (protect.has(`${x + i},${y + j}`)) return true; return false; };
  for (let y = OW_H; y < H; y++) for (let x = 160; x < W; x++) {
    const f = isFloor(x, y) ? floorG[idx(x, y)] : 0;
    if (!f || map.layers.deco[idx(x, y)] || nearProtected(x, y)) continue;
    let open = true; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (!isFloor(x + i, y + j)) open = false;
    if (!open) continue;
    if (f === DARK) {
      if (rng() < 0.02) { map.layers.deco[idx(x, y)] = pick(L.S.crackLava); light(x, y, 3, '#ff4020', true); }
      else if (rng() < 0.02) put1(x, y, 'FD', pick([14, 15, 5, 6]), 0);
    } else if (f === ICE) {
      if (rng() < 0.02) { map.layers.deco[idx(x, y)] = pick(L.S.crystal.cyan); map.block(x, y); light(x, y, 4, '#7fe8ff', false); }
    } else if (f === TEMPLE) {
      if (rng() < 0.015) map.layers.deco[idx(x, y)] = pick(L.S.bone);
      else if (rng() < 0.01) map.layers.deco[idx(x, y)] = pick(L.S.cobweb);
    } else if (rng() < 0.02) put1(x, y, 'FD', pick([5, 6, 7, 14, 15]), 0);
    else if (rng() < 0.012) { map.layers.deco[idx(x, y)] = pick(L.S.stalag); map.block(x, y); }
  }
  // braseiros nas salas especiais
  for (const [x, y] of [[341, 154], [350, 154], [341, 164], [350, 164], [360, 156], [360, 162]]) brazier(x, y, '#ffb050');          // Barba-Ruiva + tesouro
  for (const [x, y] of [[377, 181], [391, 181], [377, 187], [391, 187]]) brazier(x, y, '#9aff70');                                  // santuário
  for (const [x, y] of [[314, 216], [330, 216], [314, 222], [330, 222]]) brazier(x, y, '#7fe8ff');                                  // covil do Yeti
  for (const [x, y] of [[340, 272], [356, 272], [288, 236], [294, 236]]) brazier(x, y, '#ffb050');                                  // heróis
  for (const [x, y] of [[208, 252], [232, 252], [208, 265], [232, 265], [178, 252], [194, 252], [170, 274], [170, 280], [206, 276], [206, 280], [216, 214], [224, 214]]) brazier(x, y, '#ff3020');

  // ================================================================== OBJETOS (depois de todos os antigos)
  const allSpawns = spawns.concat(dungeonSpawns);
  for (const [id, x, y] of npcs) map.tileObj('npc', x, y, { npcId: id }, id);
  for (const d of doorDefs) map.tileObj('portal', d.at[0], d.at[1], { toX: d.to[0], toY: d.to[1], ...(d.req ?? {}) }, d.req ? 'quest_door' : 'portal');
  for (const [m, count, radius, level, x, y] of allSpawns) map.tileObj('monster_spawn', x, y, { monster: m, count, radius, level }, m);
  for (const [id, x, y] of chests) map.tileObj('quest_chest', x, y, { chestId: id }, id);
  const pts = (a) => a.map((p) => p.join(',')).join(';');
  map.tileObj('quest_lever', ANNI.lever[0], ANNI.lever[1], { leverId: 'annihilator', plates: pts(ANNI.plates), dests: pts(ANNI.dests), room: ANNI.room.join(','), spawns: pts(ANNI.spawns) }, 'annihilator');
  const zones = [
    ['Ilha Gelada', 280, 0, 120, 44, false],
    ['Selva de Banuta', 280, 36, 108, 56, false],
    ['Vulcão de Goroma', 326, 84, 74, 36, false],
    ['Selva de Banuta', 280, 92, 50, 28, false],
    ['Porto Esperança', PORT.x0, PORT.y0, PORT.x1 - PORT.x0 + 1, PORT.y1 - PORT.y0 + 1, true, '36 - Village.ogg'],
    ['Acampamento Nórdico', CAMP.x0, CAMP.y0, CAMP.x1 - CAMP.x0 + 1, CAMP.y1 - CAMP.y0 + 1, true, '36 - Village.ogg'],
    ['Caverna dos Piratas', 282, 126, 90, 44, false],
    ['Templo de Banuta', 370, 126, 30, 68, false],
    ['Caverna do Yeti', 282, 178, 56, 52, false],
    ['Ninho dos Dragões de Gelo', 340, 190, 31, 27, false],
    ['Caverna dos Heróis', 282, 232, 80, 50, false],
    ['Cidadela de Ferumbras', 164, 210, 110, 76, false],
  ];
  for (const [name, x, y, w, h, pz, music] of zones) map.addObject({ type: 'zone', name, x: x * 16, y: y * 16, width: w * 16, height: h * 16, rect: true, props: { music: music ?? '30 - Ruins.ogg', ...(pz ? { pz: true } : {}) } });
  for (const [x, y, radius, color, flicker] of lights) map.tileObj('light', x, y, { radius, color, flicker }, 'light');

  // ================================================================== VALIDAÇÃO (mapa inteiro, a partir do spawn)
  const fail = (msg) => { throw new Error('EXPANSION2 VALIDATION FAILED: ' + msg); };
  const newPortals = doorDefs.map((d) => [d.at[0], d.at[1], d.to[0], d.to[1]]);
  const portalMap = new Map(oldPortals.concat(newPortals).map(([x, y, tx, ty]) => [x + ',' + y, [tx, ty]]));
  for (const [id, x, y] of npcs) if (map.blocked(x, y)) fail(`npc ${id} at ${x},${y} blocked`);
  const reach = bfs(map, spawnTile[0], spawnTile[1], portalMap);
  const R = (x, y) => reach[idx(x, y)] === 1;
  for (const [id, x, y] of npcs) if (!R(x, y)) fail(`npc ${id} at ${x},${y} unreachable`);
  for (const [m, , , , x, y] of allSpawns) { if (map.blocked(x, y)) fail(`spawn ${m} at ${x},${y} blocked`); if (!R(x, y)) fail(`spawn ${m} at ${x},${y} unreachable`); }
  for (const [x, y, tx, ty] of newPortals) {
    if (map.blocked(x, y) || map.blocked(tx, ty)) fail(`portal ${x},${y} -> ${tx},${ty} blocked`);
    if (portalMap.has(tx + ',' + ty)) fail(`portal target ${tx},${ty} is itself a portal`);
  }
  // a arena da Aniquilação só se alcança pela alavanca: BFS extra a partir dos destinos
  const anniRoom = (x, y) => x >= ANNI.room[0] && x <= ANNI.room[2] && y >= ANNI.room[1] && y <= ANNI.room[3];
  for (let y = ANNI.room[1]; y <= ANNI.room[3]; y++) for (let x = ANNI.room[0]; x <= ANNI.room[2]; x++) if (R(x, y)) fail(`annihilator arena reachable by walking at ${x},${y}`);
  const reachA = bfs(map, ANNI.dests[0][0], ANNI.dests[0][1], portalMap);
  const RA = (x, y) => reachA[idx(x, y)] === 1 || R(x, y);
  for (let i = 0; i < W * H; i++) if (reachA[i] && !reach[i]) { const x = i % W, y = (i / W) | 0; if (!anniRoom(x, y) && !(x >= 204 && x <= 214 && y >= 273 && y <= 282) && !(x === 197 && y === 277)) fail(`annihilator arena leaks at ${x},${y}`); }
  for (const [x, y] of ANNI.dests.concat(ANNI.spawns)) { if (map.blocked(x, y)) fail(`annihilator tile ${x},${y} blocked`); if (!anniRoom(x, y) || !reachA[idx(x, y)]) fail(`annihilator tile ${x},${y} outside the arena`); }
  for (const [x, y] of ANNI.plates) { if (map.blocked(x, y) || !R(x, y)) fail(`annihilator plate ${x},${y} unreachable`); }
  if (!ANNI.plates.some(([x, y]) => Math.max(Math.abs(x - ANNI.lever[0]), Math.abs(y - ANNI.lever[1])) <= 1)) fail('annihilator lever not next to a plate');
  for (const [x, y] of newPortals.map((p) => [p[0], p[1]])) if (!RA(x, y)) fail(`portal ${x},${y} unreachable`);
  // baús: bloqueados, com um vizinho andável alcançável (ou pela arena)
  const nb8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (const [id, x, y] of chests) {
    if (!map.blocked(x, y)) fail(`chest ${id} at ${x},${y} not blocked`);
    if (!nb8.some(([a, b]) => !map.blocked(x + a, y + b) && RA(x + a, y + b))) fail(`chest ${id} at ${x},${y} has no reachable neighbour`);
  }
  // zonas protegidas: nenhum spawn a menos de 10 tiles
  for (const [m, , , , x, y] of spawns) for (const r of [PORT, CAMP]) {
    const dx = Math.max(r.x0 - x, 0, x - r.x1), dy = Math.max(r.y0 - y, 0, y - r.y1);
    if (Math.hypot(dx, dy) < 10) fail(`spawn ${m} at ${x},${y} too close to a safe zone`);
  }
  // chegada da carroça/barco em Porto Esperança (shared/data/npcs.ts PORT_ARRIVAL)
  if (map.blocked(372, 64) || !R(372, 64)) fail('port arrival 372,64 blocked/unreachable');
  for (const [id, x, y] of npcs) map.block(x, y);
  let newWalk = 0, newReach = 0;
  for (let y = 0; y < H; y++) for (let x = OLD_W; x < W; x++) { const i = idx(x, y); if (!map.layers.collision[i]) { newWalk++; if (reach[i] || reachA[i]) newReach++; } }
  console.log(`expansion2: ${W}x${H}, ${allSpawns.length} spawns, ${npcs.length} npcs, ${newPortals.length} portals, ${chests.length} chests; new area ${newReach}/${newWalk} walkable tiles reachable`);
  if (newReach / newWalk < 0.9) fail(`too many unreachable tiles in the new area (${newReach}/${newWalk})`);
  return { map, lights };
}
