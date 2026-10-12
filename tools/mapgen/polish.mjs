// Content polish pass (swamp, ruins, zone seams, dungeons). Runs AFTER all the original generation, with its own RNG stream,
// so older content keeps its coordinates. Everything here is decoration: it never touches NPC/spawn/portal tiles (protect mask),
// never blocks reserved/road cells, and the generator's BFS validation runs afterwards.
import { mulberry32, noise2, fbm } from './lib.mjs';

export function polish(c) {
  const { map, ts, L, W, H, idx, inb, reg, dirt, water, pave, mud, band, floorG, isFloor, isWall, S, place, CAVE, CRYPT, ARENA, MAUS, DY, lights, protect, ARENAS, isAF } = c;
  const r3 = mulberry32(20260612);
  const ri = (a, b) => a + Math.floor(r3() * (b - a + 1));
  const pick = (a) => a[Math.floor(r3() * a.length)];
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r3() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const g = (tsn, col, row) => ts.gid(tsn, col, row);
  const light = (x, y, radius, color, flicker) => lights.push([x, y, radius, color, flicker]);
  const empty = (x, y) => inb(x, y) && !map.layers.deco[idx(x, y)] && !map.layers.above[idx(x, y)] && !map.layers.collision[idx(x, y)];
  const free = (x, y) => empty(x, y) && !protect[idx(x, y)];
  // landDec: ground decoration that never blocks (may sit in reserved halos); landFree: blocking props, kept clear of roads
  const fdOnly = (x, y) => { const gd = map.layers.deco[idx(x, y)]; if (!gd) return true; const lc = ts.locate(gd); return !!lc && lc.t.name === "TilesetFloorDetail" && lc.row >= 2 && lc.row <= 3; };
  const landDec = (x, y) => inb(x, y) && fdOnly(x, y) && !map.layers.above[idx(x, y)] && !map.layers.collision[idx(x, y)] && !protect[idx(x, y)] && !water[idx(x, y)] && !dirt[idx(x, y)] && !pave[idx(x, y)] && !band[idx(x, y)];
  const nearDirt = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (dirt[idx(x + i, y + j)] || pave[idx(x + i, y + j)]) return true; return false; };
  const landFree = (x, y) => landDec(x, y) && !nearDirt(x, y);
  const dec = (x, y, gid, block = false) => { map.layers.deco[idx(x, y)] = gid; if (block) map.block(x, y); };
  const abv = (x, y, gid) => { map.layers.above[idx(x, y)] = gid; };
  const S_ = L.S;
  const stats = { reeds: 0, lily: 0, shrooms: 0, glow: 0, boardwalks: 0, mossTrees: 0, logs: 0, huts: 0, cols: 0, arches: 0, vines: 0, rubble: 0 };

  // ------------------------------------------------------------------ zone seams: dithered ground blends + border dressing
  const FOR = [0, 12], DRK = [11, 12], SOIL = [11, 19];
  const land = (x, y) => { const rr = reg(x, y); return rr === 'forest' || rr === 'swamp' || rr === 'ruins'; };
  const dist = new Int8Array(W * H).fill(99), other = new Array(W * H).fill(null), q = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!land(x, y)) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = x + dx, b = y + dy; if (inb(a, b) && land(a, b) && reg(a, b) !== reg(x, y)) { dist[idx(x, y)] = 0; other[idx(x, y)] = reg(a, b); q.push([x, y]); break; } }
  }
  for (let h = 0; h < q.length; h++) {
    const [x, y] = q[h]; const d = dist[idx(x, y)]; if (d >= 6) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = x + dx, b = y + dy; if (!inb(a, b) || !land(a, b) || reg(a, b) !== reg(x, y) || dist[idx(a, b)] <= d + 1) continue; dist[idx(a, b)] = d + 1; other[idx(a, b)] = other[idx(x, y)]; q.push([a, b]); }
  }
  // (the seam itself lies where one region's cells touch the other, so both sides are blended symmetrically)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = dist[idx(x, y)]; if (d > 5 || dirt[idx(x, y)] || water[idx(x, y)] || pave[idx(x, y)]) continue;
    const mine = reg(x, y), o = other[idx(x, y)];
    const p = 0.7 * (1 - d / 6) ** 1.3 + (noise2(x, y, 4, 91) - 0.5) * 0.25;
    if (r3() > p) continue;
    let t;
    if (mine === 'forest') t = o === 'swamp' ? (r3() < 0.45 + 0.1 * (5 - d) / 5 ? SOIL : DRK) : DRK;
    else if (mine === 'swamp') t = o === 'forest' ? (r3() < 0.55 ? FOR : DRK) : DRK;
    else t = o === 'forest' ? FOR : (r3() < 0.4 ? SOIL : DRK);
    map.put('ground', x, y, 'F', t[0] + (r3() < 0.14 ? 1 + ri(0, 3) : 0), t[1]);
  }
  // swamp: dark grass patches (fog-friendly variation) in noise blobs
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (reg(x, y) !== 'swamp' || dirt[idx(x, y)] || water[idx(x, y)] || band[idx(x, y)] || dist[idx(x, y)] <= 5) continue;
    const n = noise2(x, y, 6, 201); if (n > 0.6 && r3() < 0.85) map.put('ground', x, y, 'F', DRK[0] + (r3() < 0.15 ? 1 + ri(0, 3) : 0), DRK[1]);
  }
  // seam dressing: bushes / tufts / small rocks / mushrooms / a few trees, thinning away from the border
  let seamN = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = dist[idx(x, y)]; if (d > 4 || !landDec(x, y)) continue;
    const mine = reg(x, y), o = other[idx(x, y)], k = r3(), f = (5 - d) / 5;
    const swampish = mine === 'swamp' || o === 'swamp', ruinish = mine === 'ruins' || o === 'ruins';
    if (k < 0.075 * f) { map.layers.deco[idx(x, y)] = g('N', pick([0, 1, 2, 3, 4, 5, 6, 8]), 10); seamN++; }
    else if (k < 0.12 * f + 0.075 * f) { if (swampish) dec(x, y, S_.darkTuft[ri(0, 3)]); else map.layers.deco[idx(x, y)] = g('FD', pick([0, 1, 2, 3]), 2); }
    else if (k < 0.24 * f + 0.02) { if (ruinish) { if (r3() < 0.5) dec(x, y, S_.rubbleTan[ri(0, 3)]); else map.layers.deco[idx(x, y)] = g('FD', pick([14, 15, 5, 6]), 0); } else if (swampish && r3() < 0.45) dec(x, y, r3() < 0.5 ? S_.shroomBrown[ri(0, 1)] : S_.shroomRed[ri(0, 2)]); else if (r3() < 0.3) place(pick(['rockSmallGray', 'rockSmallBrown']), x, y); }
    else if (d >= 1 && k < 0.262 * f + 0.02 + 0.006) { if (mine === 'forest') place(swampish ? 'treeDead2' : 'treePine2', x, y); else if (mine === 'swamp') place(r3() < 0.6 ? 'treeDead2' : 'treeOlive2', x, y); else place(r3() < 0.5 ? 'treePine2' : 'treeDead2', x, y); }
  }

  // ------------------------------------------------------------------ SWAMP
  const inSwamp = (x, y) => reg(x, y) === 'swamp';
  // dead trees: hanging moss on the canopy
  const mossCache = new Map();
  const mossOf = (gid, kind) => { const k = kind + gid; if (!mossCache.has(k)) mossCache.set(k, L.overlay(gid, 'moss', 1 + (mossCache.size % 3), L.draw.moss)); return mossCache.get(k); };
  const deadCols = new Set(); for (const [c0, r0, w, h] of [[4, 0, 2, 2], [0, 5, 4, 3]]) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) deadCols.add(g('N', c0 + i, r0 + j));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inSwamp(x, y)) continue;
    for (const layer of ['above', 'deco']) { const gid = map.layers[layer][idx(x, y)]; if (gid && deadCols.has(gid) && r3() < 0.6) { map.layers[layer][idx(x, y)] = mossOf(gid, layer[0]); stats.mossTrees++; } }
  }
  // water: lily pads / flowers on open water, reeds on shore + in shallows
  const isW = (x, y) => inb(x, y) && water[idx(x, y)] === 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inSwamp(x, y)) continue;
    if (isW(x, y)) {
      const inner = isW(x - 1, y) && isW(x + 1, y) && isW(x, y - 1) && isW(x, y + 1);
      if (inner && !map.layers.deco[idx(x, y)] && r3() < 0.14) { dec(x, y, r3() < 0.2 ? S_.lilyFlower[ri(0, 1)] : S_.lilyPad[ri(0, 2)]); stats.lily++; }
      continue;
    }
    if (!landDec(x, y)) continue;
    const shore = isW(x - 1, y) || isW(x + 1, y) || isW(x, y - 1) || isW(x, y + 1) || isW(x - 1, y - 1) || isW(x + 1, y + 1) || isW(x + 1, y - 1) || isW(x - 1, y + 1);
    if (shore && r3() < 0.55) { dec(x, y, S_.reed[ri(0, 4)]); stats.reeds++; }
  }
  // reed clumps in the open + dark grass tufts (fog-friendly darker variation) + mushrooms
  const glowKinds = ['cyan', 'violet', 'lime', 'amber'];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inSwamp(x, y) || !landDec(x, y)) continue;
    const n = noise2(x, y, 7, 133), k = r3();
    if (k < 0.03) { dec(x, y, r3() < 0.5 ? S_.shroomRed[ri(0, 2)] : S_.shroomBrown[ri(0, 1)]); stats.shrooms++; }
    else if (k < 0.045 && stats.glow < 46) { const kind = glowKinds[ri(0, 3)]; dec(x, y, S_.glow[kind][ri(0, 1)]); light(x, y, 3 + (r3() < 0.3 ? 1 : 0), { cyan: "#7fe8ff", violet: "#c890ff", lime: "#c8ff70", amber: "#ffc060" }[kind], r3() < 0.4); stats.glow++; }
    else if (n > 0.5 && k < 0.25) dec(x, y, S_.darkTuft[ri(0, 3)]);
    else if (n < 0.4 && k < 0.05) dec(x, y, S_.reed[ri(0, 4)]);
    else if (k < 0.03) { dec(x, y, r3() < 0.5 ? S_.shroomRed[ri(0, 2)] : S_.shroomBrown[ri(0, 1)]); stats.shrooms++; }
    else if (k < 0.017 && stats.glow < 46) { const kind = glowKinds[ri(0, 3)]; dec(x, y, S_.glow[kind][ri(0, 1)]); light(x, y, 3 + (r3() < 0.3 ? 1 : 0), { cyan: '#7fe8ff', violet: '#c890ff', lime: '#c8ff70', amber: '#ffc060' }[kind], r3() < 0.4); stats.glow++; }
  }
  // fallen logs (2 tiles, blocking) on free swamp ground
  for (let tries = 0; tries < 900 && stats.logs < 22; tries++) {
    const x = ri(105, 156), y = ri(42, 96);
    if (!inSwamp(x, y) || !landFree(x, y) || !landFree(x + 1, y) || !free(x, y + 1) || !free(x + 1, y + 1)) continue;
    const lg = r3() < 0.5 ? S_.logH : S_.logH2;
    dec(x, y, lg[0][0], true); dec(x + 1, y, lg[0][1], true); map.reserve(x, y, 2, 1); stats.logs++;
  }
  // ruined huts (mossy ruined houses; solid blocks)
  const hutSpots = [];
  for (let tries = 0; tries < 40000 && hutSpots.length < 5; tries++) {
    const big = hutSpots.length < 1 && tries < 15000, name = big ? 'swampHutBig' : pick(['swampHutA', 'swampHutB']);
    const [, , , w, h] = S[name]; const x = ri(108, 152), y = ri(44, 90);
    if (!inSwamp(x, y)) continue;
    let ok = true; for (let j = 0; j < h && ok; j++) for (let i = 0; i < w; i++) { if (!landDec(x + i, y + j) || !inSwamp(x + i, y + j)) { ok = false; break; } }
    if (!ok) continue;
    if (hutSpots.some(([a, b]) => Math.hypot(a - x, b - y) < 10)) continue;
    // keep monster spawns clear
    if (c.spawns.some((s) => Math.hypot(s[4] - x - w / 2, s[5] - y - h / 2) < 4)) continue;
    place(name, x, y, { check: false }); hutSpots.push([x, y]); stats.huts++;
    // a lantern-ish glow shroom + stump beside it
    if (landFree(x - 1, y + h)) { dec(x - 1, y + h, S_.glow.amber[0]); light(x - 1, y + h, 3, '#ffc060', true); }
    if (big && landFree(x + w, y + h - 1)) place('frogStatue', x + w, y + h - 2, { check: false });
  }
  // boardwalks over water
  const walk = (x, y) => inb(x, y) && !map.layers.collision[idx(x, y)] && !water[idx(x, y)] && inSwamp(x, y);
  const cand = [];
  for (let y = 41; y < 97; y++) for (let x = 104; x < 158; x++) {
    if (!isW(x, y) || isW(x - 1, y)) continue; // run start (horizontal)
    let e = x; while (isW(e + 1, y)) e++;
    const len = e - x + 1; if (len >= 2 && len <= 9 && walk(x - 1, y) && walk(e + 1, y) && free(x - 1, y) && free(e + 1, y) && !protect[idx(x - 1, y)]) cand.push({ d: 'h', x0: x, y0: y, x1: e, y1: y, len });
  }
  for (let x = 104; x < 158; x++) for (let y = 41; y < 97; y++) {
    if (!isW(x, y) || isW(x, y - 1)) continue;
    let e = y; while (isW(x, e + 1)) e++;
    const len = e - y + 1; if (len >= 2 && len <= 9 && walk(x, y - 1) && walk(x, e + 1) && free(x, y - 1) && free(x, e + 1)) cand.push({ d: 'v', x0: x, y0: y, x1: x, y1: e, len });
  }
  shuffle(cand);
  const used = [];
  for (const b of cand) {
    if (stats.boardwalks >= 18) break;
    const mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
    if (used.some(([a, bb]) => Math.hypot(a - mx, bb - my) < 8)) continue;
    let ok = true; for (let y = b.y0; y <= b.y1 && ok; y++) for (let x = b.x0; x <= b.x1; x++) if (protect[idx(x, y)] || map.layers.deco[idx(x, y)] || map.layers.above[idx(x, y)]) { ok = false; break; }
    if (!ok) continue;
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      const first = (b.d === 'h' ? x === b.x0 : y === b.y0), last = (b.d === 'h' ? x === b.x1 : y === b.y1);
      const gid = first ? S_['plankA_' + b.d] : last ? S_['plankB_' + b.d] : S_['plank_' + b.d][ri(0, 1)];
      dec(x, y, b.d === 'h' && (first || last) ? S_['plankPost_h'] : b.d === 'v' && (first || last) ? S_['plankPost_v'] : gid, false);
      map.block(x, y, false);
    }
    used.push([mx, my]); stats.boardwalks++;
  }

  // ------------------------------------------------------------------ RUINS
  const inRuins = (x, y) => reg(x, y) === 'ruins';
  const solid = (x, y) => map.layers.collision[idx(x, y)] !== 0;
  // vines creeping over the slab walls (relief blocks, cols 4..6)
  const wallVine = new Map();
  for (let y = 0; y < 40; y++) for (let x = 84; x < W; x++) {
    if (!inRuins(x, y)) continue;
    const gid = map.layers.deco[idx(x, y)]; if (!gid) continue;
    const loc = ts.locate(gid); if (!loc || loc.t.name !== 'TilesetRelief' || loc.col < 4 || loc.col > 6 || loc.row > 2) continue;
    if (r3() < 0.5) continue;
    const kind = loc.row === 2 ? 'vineUp' : 'vine'; const key = kind + gid + (x % 3);
    if (!wallVine.has(key)) wallVine.set(key, L.overlay(gid, kind, 1 + (x % 3), L.draw[kind]));
    map.layers.deco[idx(x, y)] = wallVine.get(key); stats.vines++;
  }
  // arena: imposing goblin king pit
  {
    const { x0, y0, x1, y1 } = ARENA;
    const dirtCell = (x, y) => dirt[idx(x, y)] === 1 && !pave[idx(x, y)];
    const gates = [[x0, y0 + 6, x0 + 3, y0 + 12], [x0 + 9, y1 - 2, x0 + 15, y1 + 2]];
    const inGate = (x, y) => gates.some(([a, b, cc, d]) => x >= a - 1 && x <= cc + 1 && y >= b - 1 && y <= d + 1);
    // raised stone parapet: outermost dirt ring, with the two gates left open
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!dirtCell(x, y) || inGate(x, y) || protect[idx(x, y)]) continue;
      const ring = !(dirtCell(x - 1, y) && dirtCell(x + 1, y) && dirtCell(x, y - 1) && dirtCell(x, y + 1));
      if (!ring || map.layers.deco[idx(x, y)] || map.layers.above[idx(x, y)]) continue;
      const north = !dirtCell(x, y - 1), west = !dirtCell(x - 1, y), east = !dirtCell(x + 1, y);
      const col = west ? 4 : east ? 6 : 5, row = north ? 0 : 2;
      dec(x, y, g('R', col, row), true);
    }
    // totems at the gates, banners along the north parapet, braziers, bone piles
    const totemAt = (x, y, v) => { const t = S_.totem[v]; if (free(x, y) && free(x, y - 1)) { abv(x, y - 1, t[0][0]); dec(x, y, t[1][0], true); } };
    totemAt(x0 + 5, y0 + 5, 0); totemAt(x0 + 5, y0 + 14, 1); totemAt(x1 - 5, y0 + 5, 1); totemAt(x1 - 5, y0 + 14, 0);
    totemAt(x0 + 7, y1 - 2, 0); totemAt(x0 + 17, y1 - 2, 1);
    const bannerAt = (x, y, B) => { if (free(x, y) && free(x, y - 1)) { abv(x, y - 1, B[0][0]); dec(x, y, B[1][0], true); } };
    for (let x = x0 + 6; x <= x1 - 6; x += 4) bannerAt(x, y0 + 2, (x - x0) % 8 === 2 ? S_.bannerRed : S_.bannerBlack);
    const braz = (x, y) => { if (free(x, y)) { dec(x, y, S_.brazier, true); light(x, y, 6, '#ff9a3c', true); } };
    for (const [x, y] of [[x0 + 3, y0 + 4], [x1 - 3, y0 + 4], [x0 + 3, y1 - 4], [x1 - 3, y1 - 4], [x0 + 12, y0 + 3], [(x0 + x1) >> 1, y1 - 3], [x0 + 8, y0 + 8], [x1 - 8, y0 + 8], [x0 + 8, y1 - 8], [x1 - 8, y1 - 8]]) braz(x, y);
    for (let k = 0; k < 18; k++) { const x = ri(x0 + 3, x1 - 3), y = ri(y0 + 3, y1 - 3); if (free(x, y) && dirtCell(x, y)) dec(x, y, pick(S_.bone)); }
    for (let k = 0; k < 10; k++) { const x = ri(x0 + 3, x1 - 3), y = ri(y0 + 3, y1 - 3); if (free(x, y) && dirtCell(x, y)) dec(x, y, S_.crackStone[ri(0, 4)]); }
  }
  // flagstone courtyards with cracks, rubble and broken columns
  const flagTile = (v) => L.tile('flag' + v, () => { const cv = new (L.Cv)(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) cv.set(x, y, L.px.flagstone(x, y, v)); return cv; }, { speed: 95, terrain: 'stone' });
  const flags = [0, 1, 2, 3].map(flagTile);
  const yards = [];
  for (let tries = 0; tries < 3000 && yards.length < 7; tries++) {
    const w = ri(7, 11), h = ri(5, 8), x = ri(88, 148), y = ri(4, 33);
    if (!inRuins(x, y) || !inRuins(x + w, y + h)) continue;
    let ok = true; for (let j = -1; j <= h && ok; j++) for (let i = -1; i <= w; i++) { const a = x + i, b = y + j; if (!inb(a, b) || !inRuins(a, b) || dirt[idx(a, b)] || protect[idx(a, b)] || map.layers.collision[idx(a, b)] || map.layers.deco[idx(a, b)] || map.layers.above[idx(a, b)] || band[idx(a, b)]) { ok = false; break; } }
    if (!ok || yards.some(([a, b]) => Math.abs(a - x) < 12 && Math.abs(b - y) < 10)) continue;
    yards.push([x, y, w, h]);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const edge = i === 0 || j === 0 || i === w - 1 || j === h - 1, corner = (i === 0 || i === w - 1) && (j === 0 || j === h - 1);
      if (corner || (edge && r3() < 0.38)) continue; // ragged edge
      map.layers.ground[idx(x + i, y + j)] = flags[ri(0, 3)]; map.reserve(x + i, y + j);
      if (r3() < 0.2) dec(x + i, y + j, S_.crackStone[ri(0, 4)]);
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { if (map.layers.ground[idx(x + i, y + j)] === 0) continue; }
    // columns around the court
    const colAt = (cx, cy) => {
      if (!free(cx, cy)) return;
      const kind = ri(0, 4);
      if (kind === 0 && free(cx, cy - 1) && free(cx, cy - 2)) { abv(cx, cy - 2, S_.col.cap[ri(0, 1)]); abv(cx, cy - 1, S_.col.shaft[ri(0, 2)]); dec(cx, cy, S_.col.base[ri(0, 1)], true); }
      else if (kind === 1 && free(cx, cy - 1)) { abv(cx, cy - 1, S_.col.broken[ri(0, 2)]); dec(cx, cy, S_.col.base[ri(0, 1)], true); }
      else if (kind === 2) dec(cx, cy, S_.col.stub[ri(0, 2)], true);
      else if (kind === 3 && free(cx + 1, cy)) { dec(cx, cy, S_.fallenCol[0][0], true); dec(cx + 1, cy, S_.fallenCol[0][1], true); }
      else dec(cx, cy, S_.rubbleTan[ri(0, 3)]);
      stats.cols++;
    };
    for (let i = 1; i < w - 1; i += 3) { colAt(x + i, y - 0 + 1); if (r3() < 0.7) colAt(x + i, y + h - 1); }
    for (let j = 3; j < h - 1; j += 3) { if (r3() < 0.6) colAt(x, y + j); if (r3() < 0.6) colAt(x + w - 1, y + j); }
    // centre: a brazier or a statue
    const cx = x + (w >> 1), cy = y + (h >> 1);
    if (yards.length % 2) { if (free(cx, cy)) { dec(cx, cy, S_.brazier, true); light(cx, cy, 6, '#ff9a3c', true); } }
    else place(pick(['statueG1', 'statueG2', 'statueG3']), cx, cy - 1, { check: false });
    for (let k = 0; k < 6; k++) { const a = x + ri(0, w - 1), b = y + ri(0, h - 1); if (free(a, b) && map.layers.ground[idx(a, b)] === flags[0] + 0) dec(a, b, S_.rubbleTan[ri(0, 3)]); }
  }
  // standalone: collapsed / intact arches, broken columns, statues, rubble, lava cracks, braziers
  const archAt = (x, y, broken) => {
    const A = broken ? S_.archBroken : S_.arch; // 5 wide x 4 tall; y = base row
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) { const a = x + i, b = y - 3 + j; if (!empty(a, b) || (j === 3 && (i === 0 || i === 4) && nearDirt(a, b)) || protect[idx(a, b)] || !inRuins(a, b) || water[idx(a, b)] || band[idx(a, b)]) return false; }
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) { const gid = A[j][i]; if (!gid) continue; if (j === 3) { dec(x + i, y, gid, i === 0 || i === 4); } else abv(x + i, y - 3 + j, gid); }
    if (broken) { for (const [i, k] of [[3, 1], [4, 2]]) if (empty(x + i, y + 0) && !map.layers.deco[idx(x + i, y)]) { dec(x + i, y, S_.rubbleTan[k], false); } }
    map.reserve(x, y - 3, 5, 4); stats.arches++; return true;
  };
  let nArch = 0;
  for (let tries = 0; tries < 60000 && nArch < 9; tries++) { const x = ri(88, 148), y = ri(8, 35); if (archAt(x, y, nArch % 3 !== 0)) nArch++; }
  for (let k = 0; k < 140; k++) {
    const x = ri(88, 154), y = ri(4, 36); if (!inRuins(x, y) || !landFree(x, y)) continue;
    const t = r3();
    if (t < 0.3 && free(x, y - 1)) { abv(x, y - 1, S_.col.broken[ri(0, 2)]); dec(x, y, S_.col.base[ri(0, 1)], true); stats.cols++; }
    else if (t < 0.5) { dec(x, y, S_.col.stub[ri(0, 2)], true); stats.cols++; }
    else if (t < 0.62 && free(x, y - 1) && free(x, y - 2)) { abv(x, y - 2, S_.col.cap[ri(0, 1)]); abv(x, y - 1, S_.col.shaft[ri(0, 2)]); dec(x, y, S_.col.base[ri(0, 1)], true); stats.cols++; }
    else if (t < 0.72 && landFree(x + 1, y)) { dec(x, y, S_.fallenCol[0][0], true); dec(x + 1, y, S_.fallenCol[0][1], true); stats.cols++; }
    else if (t < 0.85) { dec(x, y, pick([S_.rubbleTan, S_.rubbleGray])[ri(0, 3)]); stats.rubble++; }
    else if (t < 0.9) place(pick(['statueG1', 'statueG2', 'statueG3', 'pillarG']), x, y - 1, { check: false });
    else if (t < 0.95) { dec(x, y, S_.brazier, true); light(x, y, 6, '#ff9a3c', true); }
    else { dec(x, y, pick(S_.bone)); }
  }
  // lava cracks: glowing seams in the ground (flame spirit country, east side)
  let lava = 0;
  for (let tries = 0; tries < 2000 && lava < 34; tries++) {
    const x = ri(132, 156), y = ri(4, 30); if (!inRuins(x, y) || !landFree(x, y)) continue;
    dec(x, y, S_.crackLava[ri(0, 2)]); if (lava % 3 === 0) light(x, y, 3, '#ff7a2a', true); lava++;
  }
  stats.lava = lava;

  // crypt mausoleum entrance: pediment, paved forecourt, braziers
  {
    const { x, y, w } = MAUS; // wall blocks at y..y+2; skull door at (106, y+2)
    for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) { const a = x + i, b = y - 2 + j; map.layers.deco[idx(a, b)] = 0; map.layers.above[idx(a, b)] = 0; const gid = S_.mausTop[j][i]; if (gid) { if (j === 1) dec(a, b, gid, true); else { dec(a, b, gid, true); } } }
    for (let j = 0; j < 3; j++) for (let i = 0; i < w; i++) { if (r3() < 0.35) { const gg = map.layers.deco[idx(x + i, y + j)]; if (gg && j < 2) map.layers.deco[idx(x + i, y + j)] = L.overlay(gg, 'vine', i, L.draw.vine); } }
    for (let j = 3; j <= 5; j++) for (let i = -2; i <= w + 1; i++) { const a = x + i, b = y + j; if (!inb(a, b) || solid(a, b) || water[idx(a, b)]) continue; const inPath = a >= x + 1 && a <= x + 3; if (inPath || (j === 3 && r3() < 0.8) || r3() < 0.25) { map.layers.ground[idx(a, b)] = flags[ri(0, 3)]; map.reserve(a, b); if (r3() < 0.2) dec(a, b, S_.crackStone[ri(0, 4)]); } }
    for (const [a, b] of [[x, y + 3], [x + 4, y + 3]]) { if (!solid(a, b) && !protect[idx(a, b)]) { dec(a, b, S_.brazier, true); light(a, b, 6, '#ff9a3c', true); } }
    for (const [a, b] of [[x - 1, y + 4], [x + 5, y + 4]]) if (free(a, b)) dec(a, b, S_.rubbleGray[ri(0, 3)]);
    light(x + 2, y + 2, 4, '#9be8ff', true); // the skull door glows
  }

  // ------------------------------------------------------------------ DUNGEONS
  const inCave = (x, y) => x >= CAVE.x0 && x <= CAVE.x1 && y >= CAVE.y0 && y <= CAVE.y1;
  const open8 = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (!isFloor(x + i, y + j)) return false; return true; };
  const cavLight = { 0: '#ffb060', 1: '#60c8ff', 2: '#d890ff', 3: '#b8f060' };
  let nCr = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // pack crystals already placed (Nature col 0..3, row 16) glow
    const gd = map.layers.deco[idx(x, y)];
    if (gd && inCave(x, y)) { const loc = ts.locate(gd); if (loc && loc.t.name === 'TilesetNature' && loc.row === 16 && loc.col < 4) { light(x, y, 4, cavLight[loc.col], false); nCr++; } }
  }
  const cavernCells = [], cryptCells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isFloor(x, y)) (inCave(x, y) ? cavernCells : (x >= CRYPT.x0 && y >= CRYPT.y0 ? cryptCells : [])).push([x, y]);
  let nStal = 0, nWeb = 0, nBone = 0;
  for (const [x, y] of cavernCells) {
    if (!free(x, y)) continue;
    const nWall = isWall(x, y - 1), k = r3();
    if (nWall && isWall(x - 1, y) && !isFloor(x - 1, y) && k < 0.7) { dec(x, y, S_.cobweb[0]); nWeb++; continue; }
    if (nWall && isWall(x + 1, y) && !isFloor(x + 1, y) && k < 0.7) { dec(x, y, S_.cobweb[1]); nWeb++; continue; }
    if (!open8(x, y)) { if (k < 0.04) dec(x, y, S_.rubbleGray[ri(0, 3)]); continue; }
    if (k < 0.04) { dec(x, y, S_.stalag[ri(0, 2)], true); nStal++; }
    else if (k < 0.055 && free(x, y - 1)) { const t = S_.stalagTall[ri(0, 1)]; abv(x, y - 1, t[0][0]); dec(x, y, t[1][0], true); nStal++; }
    else if (k < 0.075) { const kind = pick(['cyan', 'violet', 'lime', 'amber']); dec(x, y, S_.crystal[kind][ri(0, 1)], true); light(x, y, 4, { cyan: '#7fe8ff', violet: '#c890ff', lime: '#c8ff70', amber: '#ffc060' }[kind], false); nCr++; }
    else if (k < 0.095) { dec(x, y, S_.rubbleGray[ri(0, 3)]); }
    else if (k < 0.108) { dec(x, y, pick(S_.bone)); nBone++; }
    else if (k < 0.118) { dec(x, y, r3() < 0.6 ? S_.glow.cyan[ri(0, 1)] : S_.glow.lime[ri(0, 1)]); light(x, y, 3, '#7fe8ff', false); nCr++; }
  }
  // crypt
  let nCandle = 0, nSarc = 0;
  for (const [x, y] of cryptCells) {
    if (!free(x, y)) continue;
    const nWall = isWall(x, y - 1), k = r3();
    if (nWall && isWall(x - 1, y) && !isFloor(x - 1, y) && k < 0.7) { dec(x, y, S_.cobweb[0]); nWeb++; continue; }
    if (nWall && isWall(x + 1, y) && !isFloor(x + 1, y) && k < 0.7) { dec(x, y, S_.cobweb[1]); nWeb++; continue; }
    if (nWall && k < 0.2) { const t = pick(['one', 'three', 'stand']); dec(x, y, S_.candle[t], t === 'stand'); light(x, y, t === 'one' ? 3 : 4, '#ffbc75', true); nCandle++; continue; }
    if (!open8(x, y)) { if (k < 0.04) dec(x, y, S_.rubbleGray[ri(0, 3)]); continue; }
    if (k < 0.012 && free(x + 1, y) && isFloor(x + 1, y) && isFloor(x + 2, y)) { dec(x, y, S_.sarcophagus[0][0], true); dec(x + 1, y, S_.sarcophagus[0][1], true); nSarc++; }
    else if (k < 0.05) { dec(x, y, pick(S_.bone)); nBone++; }
    else if (k < 0.075) { const t = pick(['one', 'three']); dec(x, y, S_.candle[t], false); light(x, y, 3, '#ffbc75', true); nCandle++; }
    else if (k < 0.095) dec(x, y, S_.rubbleGray[ri(0, 3)]);
  }
  // crypt wall sconces + skull reliefs
  let nSconce = 0;
  const wallOv = new Map();
  for (const [x, y] of cryptCells) {
    const wy = y - 1; if (!isWall(x, wy) || isFloor(x, wy) || !free(x, y) || r3() > 0.16) continue;
    const gid = map.layers.deco[idx(x, wy)]; if (!gid) continue;
    const kind = r3() < 0.7 ? 'sconce' : 'skullRelief'; const key = kind + gid;
    if (!wallOv.has(key)) wallOv.set(key, L.overlay(gid, kind, 1, L.draw[kind]));
    map.layers.deco[idx(x, wy)] = wallOv.get(key);
    if (kind === 'sconce') { light(x, wy, 5, '#ffb060', true); nSconce++; }
  }
  // cave wall cracks
  for (const [x, y] of cavernCells) { const wy = y - 1; if (isWall(x, wy) && isFloor(x, y) && r3() < 0.08) { const gid = map.layers.deco[idx(x, wy)]; if (gid) { const key = 'crk' + gid; if (!wallOv.has(key)) wallOv.set(key, L.overlay(gid, 'crackWall', 1, L.draw.crackWall)); map.layers.deco[idx(x, wy)] = wallOv.get(key); } } }

  // ------------------------------------------------------------------ lights on existing props (lamp posts, arena torches, town windows)
  for (const [x, y] of [[79, 85], [65, 95], [96, 95], [63, 84], [92, 84], [65, 105], [95, 105], [79, 106]]) light(x, y, 3, '#ffe0a0', false); // house windows / doors
  for (const a of ARENAS) {
    for (const [lx, ly] of [[4, 7], [4, 16], [19, 17], [19, 10], [7, 5], [16, 5]]) { const x = a.rx + lx, y = a.ry + ly; if (isAF(x, y) && free(x, y)) { dec(x, y, S_.brazier, true); light(x, y, 6, '#ff9a3c', true); } }
  }
  for (const [x, y] of [[85, 108], [90, 108]]) light(x, y, 5, '#ff9a3c', true); // colosseum gatehouse torches
  return { stats: { ...stats, cave_features: nStal, cobwebs: nWeb, bones: nBone, candles: nCandle, sarcophagi: nSarc, sconces: nSconce, crystals: nCr, seam_bushes: seamN } };
}
