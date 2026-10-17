// Terras Selvagens: a expansão a LESTE do mapa original (fim de jogo, lv 40-120), com hunts nostálgicas do Tibia.
//
// Roda DEPOIS do mapa original estar pronto e validado, com um gerador aleatório próprio: o mapa antigo é copiado
// tile a tile para um mapa mais largo (as coordenadas não mudam, então personagens salvos continuam no mesmo lugar) e
// a expansão é desenhada nas colunas novas (x >= OLD_W). As únicas mudanças no mapa antigo são as duas passagens
// abertas na borda leste (ruínas e pântano). Os objetos novos entram DEPOIS dos antigos (ids antigos ficam estáveis).
//
// Regiões (superfície, y < OW_H):
//   Deserto de Zao      (NO)  Fortaleza Orc ............................. orcs (lv 42-44)
//   Picos Gelados       (NE)  Monte Ciclope + Cemitério dos Olhos ....... ciclopes, olhos malignos (lv 55-60)
//   Floresta Sombria    (meio) Forte Negro + boca do Labirinto ........... cavaleiros negros (lv 65)
//   Posto da Fronteira  (meio) vila protegida: loja, depósito, sacerdote
//   Vale dos Dragões    (S)   dragões, senhores dos dragões, Demodras ... (lv 70-85)
// Subterrâneo (área vazia abaixo de OW_H, como as Cavernas e a Cripta):
//   Labirinto dos Minotauros: minotauros, minotauros magos, Raposa Chifruda (lv 48-55)
//   Abismo: behemoths, demônios e Orshabaal (lv 90-120)
import { GameMap, mulberry32, noise2, fbm, blobTable, blobMask, bfs } from './lib.mjs';

export const NEW_W = 280;

export function expand({ old, ts, S, L, OW_H, spawnTile, oldPortals }) {
  const OLD_W = old.w, W = NEW_W, H = old.h;
  const map = new GameMap(W, H, ts);
  // ---- copia o mapa antigo (mesmas coordenadas)
  for (const k of Object.keys(map.layers)) for (let y = 0; y < H; y++) for (let x = 0; x < OLD_W; x++) map.layers[k][y * W + x] = old.layers[k][y * OLD_W + x];
  for (let y = 0; y < H; y++) for (let x = 0; x < OLD_W; x++) map.occ[y * W + x] = old.occ[y * OLD_W + x];
  map.objects = old.objects.slice();
  map.nextId = old.nextId;

  const rng = mulberry32(20261017);
  const rnd = (a, b) => a + rng() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const pickW = (pairs) => { let t = pairs.reduce((s, p) => s + p[1], 0), r = rng() * t; for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; } return pairs[0][0]; };
  const blob = blobTable();
  const idx = (x, y) => y * W + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

  // ================================================================== regiões
  const OUTPOST = { x0: 206, y0: 50, x1: 228, y1: 66 };
  const inR = (r, x, y) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  function regionAt(x, y) {
    if (x < OLD_W || y >= OW_H) return 'void';
    if (inR(OUTPOST, x, y)) return 'outpost';
    const w = (fbm(x, y, 12, 91) - 0.5) * 10;
    if (y < 46 + w) return x < 214 + w ? 'desert' : 'snow';
    if (y < 82 + w) return 'darkwood';
    return 'dragon';
  }
  const region = new Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) region[idx(x, y)] = regionAt(x, y);
  const reg = (x, y) => (inb(x, y) ? region[idx(x, y)] : 'void');
  const isLand = (x, y) => reg(x, y) !== 'void';
  // borda: terra a até 3 tiles de algo que não é terra nova (inclui a emenda com o mapa antigo)
  const band = new Uint8Array(W * H);
  for (let y = 0; y < OW_H; y++) for (let x = OLD_W; x < W; x++) {
    outer: for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (!isLand(x + i, y + j)) { band[idx(x, y)] = 1; break outer; }
  }

  const dirt = new Uint8Array(W * H), water = new Uint8Array(W * H), pave = new Uint8Array(W * H);
  const roadPts = [];
  function disc(cx, cy, r, fn) {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      if (inb(x, y) && (x - cx) ** 2 + (y - cy) ** 2 <= r * r) fn(x, y);
    }
  }
  function road(points, width = 3, { wobble = 2.2, record = true, seed = 5 } = {}) {
    for (let s = 0; s < points.length - 1; s++) {
      const [ax, ay] = points[s], [bx, by] = points[s + 1];
      const len = Math.hypot(bx - ax, by - ay);
      const nx = -(by - ay) / (len || 1), ny = (bx - ax) / (len || 1);
      const steps = Math.ceil(len * 1.5);
      for (let k = 0; k <= steps; k++) {
        const t = k / steps, env = Math.sin(Math.PI * t) ** 0.5;
        const off = (noise2(ax + t * (bx - ax) + 300, ay + t * (by - ay) + 300, 7, seed) - 0.5) * 2 * wobble * (0.4 + env);
        const px = ax + (bx - ax) * t + nx * off, py = ay + (by - ay) * t + ny * off;
        disc(px, py, width / 2, (x, y) => { if (isLand(x, y) && !band[idx(x, y)]) dirt[idx(x, y)] = 1; });
        disc(px, py, width / 2 + 1.2, (x, y) => { if (x >= OLD_W) map.reserve(x, y); });
        if (record && k % 3 === 0) roadPts.push([Math.round(px), Math.round(py)]);
      }
    }
  }
  function lake(cx, cy, rx, ry, seed) {
    for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y++) for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) {
      if (!inb(x, y) || !isLand(x, y) || band[idx(x, y)] || reg(x, y) === 'outpost') continue;
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2, n = (noise2(x, y, 4, seed) - 0.5) * 0.7;
      if (d + n < 1 && map.occ[idx(x, y)] === 0) water[idx(x, y)] = 1;
    }
  }

  // ================================================================== estradas
  const PASS_N = { y: 22, x0: 150, x1: 166 }, PASS_S = { y: 70, x0: 138, x1: 166 };
  const ORC = { x0: 174, y0: 10, x1: 200, y1: 32 };          // paliçada da Fortaleza Orc
  const FORT = { x0: 188, y0: 70, x1: 204, y1: 80 };         // Forte Negro (muralha de pedra)
  const LAIR = { cx: 262, cy: 106, r: 8 };                   // covil de Demodras
  const LAB_MOUTH = [176, 58], ABYSS_MOUTH = [262, 74];      // canto sup. esq. das bocas de caverna (3x3)
  road([[166, 22], [174, 21]], 3);
  road([[187, 33], [190, 42], [200, 48], [212, 52], [216, 50]], 3);
  road([[166, 70], [178, 68], [194, 62], [206, 59]], 3);
  road([[177, 68], [177, 62]], 2);
  road([[228, 59], [236, 52], [238, 42], [232, 30], [236, 18]], 3);
  road([[238, 42], [252, 36], [258, 30]], 2);
  road([[236, 18], [248, 14], [262, 16]], 2);
  road([[228, 62], [246, 68], [263, 72], [263, 77]], 3);
  road([[217, 67], [214, 80], [206, 90], [198, 100], [182, 100]], 3);
  road([[214, 80], [226, 92], [244, 98], [254, 104]], 3);
  road([[196, 66], [196, 69]], 2);
  road([[180, 32], [172, 40]], 2);
  road([[244, 98], [252, 88], [262, 88]], 2);

  // ================================================================== spawns (antes da vegetação: clareira + trilha)
  const spawns = [
    // Fortaleza Orc (lv 42-44)
    ['orc_warrior', 5, 5, 42, 184, 18], ['orc_shaman', 3, 4, 44, 194, 24], ['orc_warrior', 4, 5, 42, 186, 27],
    ['orc_warrior', 4, 5, 42, 202, 40], ['orc_shaman', 3, 5, 44, 172, 40],
    // Picos Gelados (lv 55-60)
    ['cyclops', 4, 5, 55, 232, 24], ['cyclops', 4, 5, 55, 256, 32], ['cyclops', 3, 5, 55, 244, 44],
    ['bonelord', 3, 5, 60, 252, 10], ['bonelord', 3, 4, 60, 270, 18],
    // Floresta Sombria / Forte Negro (lv 65)
    ['black_knight', 3, 4, 65, 196, 75], ['black_knight', 2, 4, 65, 184, 76], ['black_knight', 2, 4, 65, 242, 76],
    // Vale dos Dragões (lv 70-85)
    ['dragon', 3, 5, 70, 178, 98], ['dragon', 3, 5, 70, 198, 108], ['dragon', 3, 5, 70, 222, 98], ['dragon', 3, 5, 70, 236, 110],
    ['dragon_lord', 2, 5, 85, 248, 96], ['dragon_lord', 2, 5, 85, 270, 92],
    ['demodras', 1, 3, 80, LAIR.cx, LAIR.cy],
  ];
  for (const [, , r, , x, y] of spawns) { const rr = Math.max(2, r - 2); map.reserve(x - rr, y - rr, rr * 2 + 1, rr * 2 + 1); }
  const nearestRoad = (x, y) => { let best = null, bd = 1e9; for (const p of roadPts) { const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; best = p; } } return best; };
  for (const [, , , , x, y] of spawns) { const rp = nearestRoad(x, y); if (rp && (rp[0] - x) ** 2 + (rp[1] - y) ** 2 > 36) road([[x, y], rp], 2, { record: false, wobble: 3 }); }

  // ================================================================== água
  lake(196, 46, 4, 3, 201);    // oásis no deserto
  lake(250, 58, 5, 3, 202);    // lago na floresta, ao pé dos picos
  lake(176, 84, 4, 3, 203);    // poça escura na floresta
  for (const r of [ORC, FORT, OUTPOST]) for (let y = r.y0 - 2; y <= r.y1 + 2; y++) for (let x = r.x0 - 2; x <= r.x1 + 2; x++) if (inb(x, y)) water[idx(x, y)] = 0;
  for (let y = 0; y < H; y++) for (let x = OLD_W; x < W; x++) {
    if (!dirt[idx(x, y)]) continue;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (inb(x + i, y + j) && water[idx(x + i, y + j)]) dirt[idx(x, y)] = 0;
  }
  // chão de terra dentro da fortaleza orc e no covil
  for (let y = ORC.y0 + 1; y < ORC.y1; y++) for (let x = ORC.x0 + 1; x < ORC.x1; x++) dirt[idx(x, y)] = 1;
  disc(LAIR.cx, LAIR.cy, LAIR.r, (x, y) => { if (!band[idx(x, y)]) { dirt[idx(x, y)] = 1; water[idx(x, y)] = 0; } });
  map.reserve(LAIR.cx - LAIR.r - 1, LAIR.cy - LAIR.r - 1, LAIR.r * 2 + 3, LAIR.r * 2 + 3);
  // praça calçada do posto
  for (let y = 56; y <= 62; y++) for (let x = 211; x <= 223; x++) pave[idx(x, y)] = 1;

  // ================================================================== chão
  const STYLE = {
    desert: { grass: [0, 5], tufts: [[1, 5], [2, 5], [3, 5], [4, 5]], dirt: ['F', 0, -7], water: ['W', 0, -1] },
    snow: { grass: [0, 19], tufts: [[1, 19], [2, 19], [3, 19], [4, 19]], dirt: ['F', 0, 7], water: ['W', 0, -1] },
    darkwood: { grass: [11, 12], tufts: [[12, 12], [13, 12], [14, 12], [15, 12]], dirt: ['F', 11, 0], water: ['W', 0, -1] },
    dragon: { grass: [11, 19], tufts: [[12, 19], [13, 19], [14, 19], [15, 19]], dirt: ['F', 11, 0], water: ['W', 13, -1] },
    outpost: { grass: [0, 12], tufts: [[1, 12], [2, 12], [3, 12], [4, 12]], dirt: ['F', 0, 0], water: ['W', 0, -1] },
  };
  for (let y = 0; y < H; y++) for (let x = OLD_W; x < W; x++) {
    const r = reg(x, y);
    if (r === 'void') { map.put('ground', x, y, 'O', 1, 1); map.block(x, y); continue; }
    const st = STYLE[r];
    const [gc, gr] = rng() < 0.16 ? pick(st.tufts) : st.grass;
    map.put('ground', x, y, 'F', gc, gr);
    if (water[idx(x, y)]) {
      const [t, dc, dr] = st.water;
      const [c, rr] = blob[blobMask((a, b) => !inb(a, b) ? true : water[idx(a, b)] === 1, x, y)];
      map.put('ground', x, y, t, c + dc, rr + dr); map.block(x, y);
    } else if (pave[idx(x, y)]) {
      const inP = (a, b) => inb(a, b) && pave[idx(a, b)] === 1;
      const top = !inP(x, y - 1), bot = !inP(x, y + 1), lef = !inP(x - 1, y), rig = !inP(x + 1, y);
      map.put('ground', x, y, 'I', lef ? 0 : rig ? 2 : 1, top ? 12 : bot ? 15 : 13);
    } else if (dirt[idx(x, y)]) {
      const [t, dc, dr] = st.dirt;
      const mask = blobMask((a, b) => !inb(a, b) ? false : (dirt[idx(a, b)] === 1 || pave[idx(a, b)] === 1) && reg(a, b) === r, x, y);
      let [c, rr] = blob[mask];
      if (mask === '11111111' && rng() < 0.05) [c, rr] = [pick([0, 1]), 11];
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
  /** Braseiro (arte do TilesetLemon, igual ao das ruínas): bloqueia e acende. */
  const brazier = (x, y, color = '#ff9a3c') => { map.layers.deco[idx(x, y)] = L.S.brazier; map.block(x, y); light(x, y, 6, color, true); };

  // ---- Fortaleza Orc: paliçada com portões a oeste e ao sul, tendas e fogueiras
  function fenceH(y, x0, x1, gaps) { for (let x = x0; x <= x1; x++) { if (gaps.some(([a, b]) => x >= a && x <= b)) continue; map.layers.deco[idx(x, y)] = ts.gid('H', x % 2 ? 11 : 12, 5); map.block(x, y); map.reserve(x, y); } }
  function fenceV(x, y0, y1, gaps) { for (let y = y0; y <= y1; y++) { if (gaps.some(([a, b]) => y >= a && y <= b)) continue; map.layers.deco[idx(x, y)] = ts.gid('H', 11, 6); map.block(x, y); map.reserve(x, y); } }
  fenceH(ORC.y0, ORC.x0, ORC.x1, []);
  fenceH(ORC.y1, ORC.x0, ORC.x1, [[185, 189]]);
  fenceV(ORC.x0, ORC.y0, ORC.y1, [[20, 23]]);
  fenceV(ORC.x1, ORC.y0, ORC.y1, []);
  for (const [x, y] of [[177, 12], [192, 12], [177, 28], [194, 28]]) place('yurt', x, y, { check: false });
  place('board', 186, 13, { check: false });
  for (const [x, y] of [[184, 22], [191, 19]]) if (!map.blocked(x, y)) brazier(x, y);
  for (let k = 0; k < 16; k++) { const x = ri(ORC.x0 + 2, ORC.x1 - 2), y = ri(ORC.y0 + 2, ORC.y1 - 2); if (!map.blocked(x, y) && !map.layers.deco[idx(x, y)]) put1(x, y, 'FD', pick([14, 15, 5, 6]), 0); }
  map.reserve(ORC.x0 - 1, ORC.y0 - 1, ORC.x1 - ORC.x0 + 3, ORC.y1 - ORC.y0 + 3);

  // ---- Forte Negro: muralha de pedra em ruínas (portão ao norte), pilares dentro
  for (let x = FORT.x0; x <= FORT.x1; x++) for (const y of [FORT.y0, FORT.y1]) {
    if (y === FORT.y0 && x >= 195 && x <= 197) continue;
    map.put('deco', x, y, 'R', x === FORT.x0 ? 4 : x === FORT.x1 ? 6 : 5, y === FORT.y0 ? 0 : 2); map.block(x, y);
  }
  for (let y = FORT.y0 + 1; y < FORT.y1; y++) for (const x of [FORT.x0, FORT.x1]) { map.put('deco', x, y, 'R', x === FORT.x0 ? 4 : 6, 1); map.block(x, y); }
  for (const [x, y] of [[191, 72], [201, 72], [191, 77], [201, 77]]) place('pillar', x, y - 2, { check: false });
  for (const [x, y] of [[193, 69], [199, 69]]) brazier(x, y);
  map.reserve(FORT.x0 - 1, FORT.y0 - 1, FORT.x1 - FORT.x0 + 3, FORT.y1 - FORT.y0 + 3);

  // ---- Cemitério dos Olhos (picos): túmulos e estátuas cinzentas
  for (let k = 0; k < 22; k++) { const a = rnd(0, Math.PI * 2), d = rnd(3, 7); const x = Math.round(252 + Math.cos(a) * d), y = Math.round(10 + Math.sin(a) * d); if (walkableGround(x, y) && !map.occ[idx(x, y)]) place(pick(['graveA', 'graveB', 'graveCross']), x, y, { check: false }); }
  place('statueG1', 246, 5, { check: true }); place('statueG2', 257, 5, { check: true });

  // ---- covil de Demodras: pilares e ossos
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; place('pillar', Math.round(LAIR.cx + Math.cos(a) * (LAIR.r - 1)), Math.round(LAIR.cy + Math.sin(a) * (LAIR.r - 1)) - 2, { check: false }); }
  for (let k = 0; k < 20; k++) { const x = ri(LAIR.cx - LAIR.r + 2, LAIR.cx + LAIR.r - 2), y = ri(LAIR.cy - LAIR.r + 2, LAIR.cy + LAIR.r - 2); if (!map.blocked(x, y) && !map.layers.deco[idx(x, y)]) put1(x, y, 'FD', pick([14, 15, 5, 6, 7]), 0); }
  light(LAIR.cx, LAIR.cy, 8, '#ff5a2a', true);

  // ---- bocas de caverna (Labirinto e Abismo)
  place('caveMouthGray', LAB_MOUTH[0], LAB_MOUTH[1], { check: false }); map.reserve(LAB_MOUTH[0] - 2, LAB_MOUTH[1] - 2, 7, 7);
  place('caveMouthGray', ABYSS_MOUTH[0], ABYSS_MOUTH[1], { check: false }); map.reserve(ABYSS_MOUTH[0] - 2, ABYSS_MOUTH[1] - 2, 7, 7);
  for (const [x, y] of [[ABYSS_MOUTH[0] - 1, ABYSS_MOUTH[1] + 2], [ABYSS_MOUTH[0] + 3, ABYSS_MOUTH[1] + 2]]) light(x, y, 4, '#ff4020', true);

  // ---- Posto da Fronteira (zona de proteção): paliçada, templo, loja, depósito
  fenceH(OUTPOST.y0, OUTPOST.x0, OUTPOST.x1, [[215, 218]]);
  fenceH(OUTPOST.y1, OUTPOST.x0, OUTPOST.x1, [[216, 218]]);
  fenceV(OUTPOST.x0, OUTPOST.y0, OUTPOST.y1, [[58, 60]]);
  fenceV(OUTPOST.x1, OUTPOST.y0, OUTPOST.y1, [[58, 63]]);
  place('houseBeige', 215, 51, { check: false });   // templo, porta (216,53)
  place('shopBlue', 208, 53, { check: false });     // loja, porta (209,55)
  place('inn', 223, 53, { check: false });          // depósito, porta (225,55)
  place('well', 217, 59, { check: false });
  for (const [x, y] of [[211, 56], [223, 56], [211, 61], [223, 61]]) { place('lamp', x, y - 1, { check: false }); light(x, y, 5, '#ffc060', true); }
  for (const [x, y] of [[208, 64], [226, 64]]) place('treeOlive2', x, y, { check: false });
  map.reserve(OUTPOST.x0, OUTPOST.y0, OUTPOST.x1 - OUTPOST.x0 + 1, OUTPOST.y1 - OUTPOST.y0 + 1);
  const npcs = [['frontier_priest', 216, 54], ['frontier_trader', 209, 57], ['frontier_depot', 225, 57], ['frontier_scout', 216, 65]];

  // ================================================================== vegetação e pedras
  const TREES = {
    desert: { dense: [['rockBrown4', 1], ['treeDead4', 1]], mid: [['rockBrownA', 2], ['rockBrownB', 2], ['treeDead2', 2], ['boulderBrown', 1]], small: [['rockSmallBrown', 1]] },
    snow: { dense: [['treePine4', 3], ['rockGray4', 1]], mid: [['treePine2', 4], ['rockGrayA', 1], ['boulderGray', 1]], small: [['rockSmallGray', 1]] },
    darkwood: { dense: [['treePine4', 2], ['treeDead4', 2], ['treeOliveB4', 2]], mid: [['treePine2', 2], ['treeDead2', 2], ['treeOliveB2', 1], ['treeRoot2', 1]], small: [['treeDead2', 1]] },
    dragon: { dense: [['treeDead4', 2], ['rockGray4', 2]], mid: [['treeDead2', 3], ['rockGrayA', 1], ['rockGrayB', 1], ['boulderGray', 1]], small: [['rockSmallGray', 1]] },
  };
  for (let y = 0; y < OW_H; y++) for (let x = OLD_W; x < W; x++) {
    const r = reg(x, y), set = TREES[r];
    if (!set || band[idx(x, y)]) continue;
    const n = fbm(x, y, 15, 141);
    const dense = r === 'darkwood' ? 0.48 : r === 'snow' ? 0.52 : 0.56, mid = dense - 0.1;
    let p, pool;
    if (n > dense) { p = r === 'desert' ? 0.2 : 0.45; pool = set.dense.concat(set.mid.map(([a, b]) => [a, b * 0.4])); }
    else if (n > mid) { p = 0.1; pool = set.mid; }
    else { p = r === 'desert' ? 0.012 : 0.01; pool = set.small; }
    if (rng() < p) place(pickW(pool), x, y);
  }
  // decoração de chão
  for (let y = 0; y < OW_H; y++) for (let x = OLD_W; x < W; x++) {
    if (!walkableGround(x, y) || map.occ[idx(x, y)] || map.layers.deco[idx(x, y)] || map.layers.above[idx(x, y)]) continue;
    const r = reg(x, y);
    if (r === 'desert' && rng() < 0.02) put1(x, y, 'FD', pick([14, 15, 5]), 0);
    else if (r === 'dragon' && rng() < 0.03) put1(x, y, 'FD', pick([14, 15, 5, 6, 7]), 0);
    else if (r === 'darkwood' && rng() < 0.03) put1(x, y, 'FD', pick([0, 1, 2, 3, 4]), 2);
    else if (r === 'snow' && rng() < 0.01) put1(x, y, 'FD', pick([14, 15]), 0);
  }

  // ---- borda: árvores/pedras densas (tudo bloqueado)
  for (let y = 0; y < OW_H; y++) for (let x = OLD_W; x < W; x++) if (band[idx(x, y)]) map.block(x, y);
  const BAND = { desert: ['rockBrown4'], snow: ['treePine4', 'rockGray4'], darkwood: ['treePine4', 'treeOliveB4'], dragon: ['rockGray4', 'treeDead4'], outpost: ['treePine4'] };
  const BAND2 = { desert: ['rockBrownA', 'boulderBrown'], snow: ['treePine2', 'rockGrayA'], darkwood: ['treePine2', 'treeDead2'], dragon: ['rockGrayA', 'treeDead2'], outpost: ['treePine2'] };
  for (const pass of [BAND, BAND2]) for (let y = 0; y < OW_H; y++) for (let x = OLD_W; x < W; x++) {
    if (!band[idx(x, y)] || map.layers.deco[idx(x, y)] || map.layers.above[idx(x, y)]) continue;
    const [t, c, rr, w, h] = S[pick(pass[reg(x, y)] ?? pass.darkwood)];
    let ok = true;
    for (let j = 0; j < h && ok; j++) for (let i = 0; i < w; i++) { const a = x + i, b = y + j; if (!inb(a, b) || !isLand(a, b) || map.occ[idx(a, b)] || dirt[idx(a, b)] || water[idx(a, b)] || map.layers.deco[idx(a, b)]) { ok = false; break; } }
    if (ok) map.stamp(t, c, rr, w, h, x, y, { baseRows: 1 });
  }
  for (let y = 0; y < OW_H; y++) for (let x = OLD_W; x < W; x++) {
    if (!band[idx(x, y)] || map.layers.deco[idx(x, y)] || map.layers.above[idx(x, y)] || water[idx(x, y)] || dirt[idx(x, y)]) continue;
    const r = reg(x, y);
    put1(x, y, 'N', r === 'snow' || r === 'dragon' ? pick([6, 7, 8]) : pick([0, 1, 2, 3, 5, 8]), r === 'snow' || r === 'dragon' ? 12 : 10, { block: true });
  }

  // ================================================================== passagens na borda leste do mapa antigo
  // Corredor de terra escura de 3 tiles atravessando as duas bordas de árvores. Apaga deco/copa no corredor e nas 3
  // linhas acima (copas de árvores cujo tronco foi removido), sem tocar no resto.
  const passages = [];
  function passage({ y, x0, x1 }) {
    const [c, r] = blob['11111111'];
    for (let x = x0; x <= x1; x++) {
      for (let yy = y - 4; yy <= y + 1; yy++) { const i = idx(x, yy); map.layers.above[i] = 0; }
      for (let yy = y - 1; yy <= y + 1; yy++) {
        const i = idx(x, yy);
        map.layers.deco[i] = 0; map.layers.collision[i] = 0;
        map.put('ground', x, yy, 'F', c + 11, r);
      }
      // tronco cortado ao meio: o que sobrou de base (deco) logo acima do corredor vira pedra baixa
      for (const yy of [y - 2, y + 2]) { const i = idx(x, yy); if (map.layers.collision[i] && !map.layers.deco[i]) map.put('deco', x, yy, 'N', pick([6, 7, 8]), 12); }
    }
    passages.push([x0, y, x1]);
  }
  passage(PASS_N); passage(PASS_S);
  // marcos (tochas) nas entradas das Terras Selvagens
  for (const p of [PASS_N, PASS_S]) for (const dy of [-2, 2]) brazier(OLD_W + 4, p.y + dy, '#ffb050');

  // ================================================================== SUBTERRÂNEO (área vazia abaixo de OW_H)
  const floorG = new Uint8Array(W * H);
  const carve = (x0, y0, x1, y1, chamfer = 0) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (chamfer) { const dx = Math.min(x - x0, x1 - x), dy = Math.min(y - y0, y1 - y); if (dx + dy < chamfer) continue; }
      floorG[idx(x, y)] = 1;
    }
  };
  // ---- Labirinto dos Minotauros: labirinto perfeito (backtracker) com corredores de 2 tiles + alguns atalhos
  const LAB = { x0: 168, y0: 134, cw: 15, ch: 11, pitch: 4 };
  {
    const seen = new Uint8Array(LAB.cw * LAB.ch), stack = [[0, 0]];
    const cell = (cx, cy) => [LAB.x0 + cx * LAB.pitch, LAB.y0 + cy * LAB.pitch];
    seen[0] = 1;
    const open = (cx, cy) => { const [x, y] = cell(cx, cy); carve(x, y, x + 1, y + 1); };
    open(0, 0);
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [cx + a, cy + b]).filter(([a, b]) => a >= 0 && b >= 0 && a < LAB.cw && b < LAB.ch && !seen[b * LAB.cw + a]);
      if (!nb.length) { stack.pop(); continue; }
      const [nx, ny] = pick(nb);
      seen[ny * LAB.cw + nx] = 1; open(nx, ny);
      const [ax, ay] = cell(cx, cy), [bx, by] = cell(nx, ny);
      carve(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx) + 1, Math.max(ay, by) + 1);
      stack.push([nx, ny]);
    }
    // atalhos (o labirinto perfeito é cansativo demais para caçar)
    for (let k = 0; k < 26; k++) {
      const cx = ri(0, LAB.cw - 2), cy = ri(0, LAB.ch - 2), [ax, ay] = cell(cx, cy);
      if (rng() < 0.5) carve(ax, ay, ax + LAB.pitch + 1, ay + 1); else carve(ax, ay, ax + 1, ay + LAB.pitch + 1);
    }
  }
  const LAB_ENTRY = [LAB.x0 + 2, LAB.y0 + 2];                 // sala de entrada (canto NO)
  carve(LAB.x0, LAB.y0, LAB.x0 + 7, LAB.y0 + 5, 1);
  const FOX = { x0: LAB.x0 + 22, y0: LAB.y0 + 16, x1: LAB.x0 + 35, y1: LAB.y0 + 26 }; // salão central da Raposa
  carve(FOX.x0, FOX.y0, FOX.x1, FOX.y1, 2);
  const LAB_EXIT_DOOR = [LAB.x0 + 3, LAB.y0 - 1];             // parede norte da sala de entrada
  // ---- Abismo: corredor descendo por salões (behemoths) até o trono de Orshabaal
  const ABY = { x0: 238, y0: 132 };
  carve(244, 132, 256, 140, 2);   // A: entrada
  carve(249, 141, 251, 146);      // A->B
  carve(238, 147, 262, 160, 2);   // B: salão dos behemoths
  carve(263, 152, 268, 153);      // B->C
  carve(269, 144, 277, 166, 2);   // C: fenda leste (behemoths)
  carve(249, 161, 251, 166);      // B->D
  carve(240, 167, 262, 180, 2);   // D: salão dos demônios
  carve(269, 167, 271, 172); carve(262, 172, 270, 173); // C->D
  carve(249, 181, 251, 186);      // D->E
  carve(240, 187, 262, 200, 3);   // E: trono de Orshabaal
  for (const [px, py] of [[244, 151], [256, 151], [244, 156], [256, 156], [245, 171], [257, 171], [245, 176], [257, 176], [272, 150], [272, 160]]) floorG[idx(px, py)] = 0; // pilares de rocha
  const ABY_ENTRY = [250, 135], ABY_EXIT_DOOR = [250, 131];
  const isFloor = (x, y) => inb(x, y) && floorG[idx(x, y)] === 1;
  const inNewDungeon = (x, y) => x >= OLD_W && y >= OW_H;
  const wall = new Uint8Array(W * H);
  for (let y = OW_H; y < H; y++) for (let x = OLD_W; x < W; x++) {
    if (isFloor(x, y)) continue;
    let w = false;
    for (let j = -1; j <= 1 && !w; j++) for (let i = -1; i <= 1; i++) if (isFloor(x + i, y + j)) { w = true; break; }
    if (!w && isFloor(x, y + 2)) w = true;
    if (w) wall[idx(x, y)] = 1;
  }
  const isWall = (x, y) => inb(x, y) && wall[idx(x, y)] === 1;
  const isAbyss = (x) => x >= 236;
  for (let y = OW_H; y < H; y++) for (let x = OLD_W; x < W; x++) {
    if (!inNewDungeon(x, y)) continue;
    if (isFloor(x, y)) {
      map.block(x, y, false);
      if (isAbyss(x)) { const [c, r] = pick([[20, 14], [21, 14], [20, 15], [21, 15]]); map.put('ground', x, y, 'I', c, r); }
      else { let [c, r] = [12, 15]; if (rng() < 0.05) [c, r] = pick([[11, 18], [12, 18]]); map.put('ground', x, y, 'C', c, r); }
    } else if (isWall(x, y)) {
      const above = isWall(x, y - 1), below = isWall(x, y + 1), left = isWall(x - 1, y), right = isWall(x + 1, y);
      const row = isFloor(x, y + 1) ? 2 : !above ? 0 : !below ? 2 : 1;
      map.put('deco', x, y, 'R', !left ? 4 : !right ? 6 : 5, row); map.block(x, y);
    }
  }
  const dungeonSpawns = [
    // Labirinto (lv 48-55)
    ['minotaur', 3, 4, 48, LAB.x0 + 14, LAB.y0 + 6], ['minotaur', 3, 4, 48, LAB.x0 + 46, LAB.y0 + 6], ['minotaur', 3, 4, 48, LAB.x0 + 10, LAB.y0 + 30],
    ['minotaur', 3, 4, 48, LAB.x0 + 50, LAB.y0 + 34], ['minotaur_mage', 2, 4, 50, LAB.x0 + 30, LAB.y0 + 6], ['minotaur_mage', 2, 4, 50, LAB.x0 + 18, LAB.y0 + 38],
    ['minotaur_mage', 2, 4, 50, LAB.x0 + 42, LAB.y0 + 22], ['horned_fox', 1, 3, 55, (FOX.x0 + FOX.x1) >> 1, (FOX.y0 + FOX.y1) >> 1],
    // Abismo (lv 90-120)
    ['behemoth', 3, 5, 90, 244, 153], ['behemoth', 2, 4, 90, 273, 155], ['behemoth', 2, 4, 90, 258, 154],
    ['demon', 2, 5, 100, 246, 173], ['demon', 2, 5, 100, 257, 174], ['orshabaal', 1, 3, 120, 251, 194],
  ];
  // os spawns do labirinto caem num tile de corredor: puxa para o tile de chão mais próximo
  for (const s of dungeonSpawns) {
    if (isFloor(s[4], s[5])) continue;
    let best = null, bd = 1e9;
    for (let y = s[5] - 6; y <= s[5] + 6; y++) for (let x = s[4] - 6; x <= s[4] + 6; x++) if (isFloor(x, y)) { const d = (x - s[4]) ** 2 + (y - s[5]) ** 2; if (d < bd) { bd = d; best = [x, y]; } }
    if (best) [s[4], s[5]] = best;
  }
  // decoração do subterrâneo (só em células com os 8 vizinhos abertos, para não fechar corredores)
  const protect = new Set(dungeonSpawns.map((s) => `${s[4]},${s[5]}`).concat([LAB_ENTRY.join(), ABY_ENTRY.join()]));
  for (let y = OW_H; y < H; y++) for (let x = OLD_W; x < W; x++) {
    if (!isFloor(x, y) || map.layers.deco[idx(x, y)] || protect.has(`${x},${y}`)) continue;
    let open = true; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (!isFloor(x + i, y + j)) open = false;
    if (!open) continue;
    if (isAbyss(x)) {
      if (rng() < 0.03) put1(x, y, 'FD', pick([14, 15, 5, 6]), 0);
      else if (rng() < 0.012) brazier(x, y, '#ff4020');
    } else if (rng() < 0.02) put1(x, y, 'FD', pick([5, 6, 7, 14, 15]), 0);
  }
  for (const [x, y] of [[FOX.x0 + 2, FOX.y0 + 2], [FOX.x1 - 2, FOX.y0 + 2], [FOX.x0 + 2, FOX.y1 - 2], [FOX.x1 - 2, FOX.y1 - 2]]) brazier(x, y, '#ffb050');
  for (const [x, y] of [[243, 190], [259, 190], [243, 197], [259, 197]]) brazier(x, y, '#ff3020');
  // portas de saída na parede norte das salas de entrada
  map.put('deco', LAB_EXIT_DOOR[0], LAB_EXIT_DOOR[1], 'D', 1, 0); map.block(LAB_EXIT_DOOR[0], LAB_EXIT_DOOR[1], false);
  map.put('deco', ABY_EXIT_DOOR[0], ABY_EXIT_DOOR[1], 'D', 2, 0); map.block(ABY_EXIT_DOOR[0], ABY_EXIT_DOOR[1], false);

  const labDoor = [LAB_MOUTH[0] + 1, LAB_MOUTH[1] + 2], abyDoor = [ABYSS_MOUTH[0] + 1, ABYSS_MOUTH[1] + 2];
  const portals = [
    [labDoor[0], labDoor[1], LAB_ENTRY[0], LAB_ENTRY[1]], [LAB_EXIT_DOOR[0], LAB_EXIT_DOOR[1], labDoor[0], labDoor[1] + 1],
    [abyDoor[0], abyDoor[1], ABY_ENTRY[0], ABY_ENTRY[1]], [ABY_EXIT_DOOR[0], ABY_EXIT_DOOR[1], abyDoor[0], abyDoor[1] + 1],
  ];

  // ================================================================== OBJETOS (depois de todos os antigos)
  const allSpawns = spawns.concat(dungeonSpawns);
  for (const [id, x, y] of npcs) map.tileObj('npc', x, y, { npcId: id }, id);
  for (const [x, y, tx, ty] of portals) map.tileObj('portal', x, y, { toX: tx, toY: ty }, 'portal');
  for (const [m, count, radius, level, x, y] of allSpawns) map.tileObj('monster_spawn', x, y, { monster: m, count, radius, level }, m);
  const zones = [
    ['Deserto de Zao', 160, 0, 56, 50, false],
    ['Picos Gelados', 214, 0, 66, 52, false],
    ['Floresta Sombria', 160, 44, 120, 42, false],
    ['Vale dos Dragões', 160, 80, 120, 40, false],
    ['Posto da Fronteira', OUTPOST.x0, OUTPOST.y0, OUTPOST.x1 - OUTPOST.x0 + 1, OUTPOST.y1 - OUTPOST.y0 + 1, true],
    ['Labirinto dos Minotauros', LAB.x0 - 2, LAB.y0 - 2, LAB.cw * LAB.pitch + 4, LAB.ch * LAB.pitch + 4, false],
    ['Abismo', 236, 128, 44, 76, false],
  ];
  for (const [name, x, y, w, h, pz] of zones) map.addObject({ type: 'zone', name, x: x * 16, y: y * 16, width: w * 16, height: h * 16, rect: true, props: { music: pz ? '36 - Village.ogg' : '30 - Ruins.ogg', ...(pz ? { pz: true } : {}) } });
  for (const [x, y, radius, color, flicker] of lights) map.tileObj('light', x, y, { radius, color, flicker }, 'light');

  // ================================================================== VALIDAÇÃO (mapa inteiro, a partir do spawn)
  const fail = (msg) => { throw new Error('EXPANSION VALIDATION FAILED: ' + msg); };
  const portalMap = new Map(oldPortals.concat(portals).map(([x, y, tx, ty]) => [x + ',' + y, [tx, ty]]));
  for (const [id, x, y] of npcs) if (map.blocked(x, y)) fail(`npc ${id} at ${x},${y} blocked`);
  const reach = bfs(map, spawnTile[0], spawnTile[1], portalMap);
  const R = (x, y) => reach[idx(x, y)] === 1;
  for (const [id, x, y] of npcs) if (!R(x, y)) fail(`npc ${id} at ${x},${y} unreachable`);
  for (const [m, , , , x, y] of allSpawns) { if (map.blocked(x, y)) fail(`spawn ${m} at ${x},${y} blocked`); if (!R(x, y)) fail(`spawn ${m} at ${x},${y} unreachable`); }
  for (const [x, y, tx, ty] of portals) {
    if (map.blocked(x, y) || map.blocked(tx, ty)) fail(`portal ${x},${y} -> ${tx},${ty} blocked`);
    if (portalMap.has(tx + ',' + ty)) fail(`portal target ${tx},${ty} is itself a portal`);
    if (!R(x, y) || !R(tx, ty)) fail(`portal ${x},${y} -> ${tx},${ty} unreachable`);
  }
  // o posto é zona protegida: nenhum spawn a menos de 10 tiles
  for (const [m, , , , x, y] of spawns) {
    const dx = Math.max(OUTPOST.x0 - x, 0, x - OUTPOST.x1), dy = Math.max(OUTPOST.y0 - y, 0, y - OUTPOST.y1);
    if (Math.hypot(dx, dy) < 10) fail(`spawn ${m} at ${x},${y} too close to the outpost`);
  }
  for (const [id, x, y] of npcs) map.block(x, y);
  let newWalk = 0, newReach = 0;
  for (let y = 0; y < H; y++) for (let x = OLD_W; x < W; x++) { const i = idx(x, y); if (!map.layers.collision[i]) { newWalk++; if (reach[i]) newReach++; } }
  console.log(`expansion: ${W}x${H}, ${allSpawns.length} spawns, ${npcs.length} npcs, ${portals.length} portals; new area ${newReach}/${newWalk} walkable tiles reachable`);
  return { map, lights };
}
