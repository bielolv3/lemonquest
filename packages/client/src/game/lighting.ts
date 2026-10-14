// Iluminação dinâmica: camada de escuridão (multiplicadora) em RenderTexture de baixa resolução, com "buracos" suaves
// recortados (ERASE) para cada luz e um brilho aditivo colorido por cima. Fica numa Layer própria desenhada pela câmera
// de UI (zoom 1), entre o mundo e os nomes/barras — então só o mundo escurece, o HUD (DOM) e os nomes não.
import Phaser from "phaser";
import { TILE_SIZE, ambientForZone, darknessOf, needsLights, zoneAt, zoneLightMode, type Rgb, type TiledMap, type TiledObject, type ZoneRect } from "@lemonquest/shared";
import { createStore, useStore, type Store } from "../ui/hud/store.ts";
import { worldClock } from "./daynight.ts";
import { cullLights, extractMapLights, flickerWave, type StaticLight } from "./lightSources.ts";
import type { PixelCamera } from "./pixelCamera.ts";

// --- configuração (persistida) ----------------------------------------------------------------

export type LightLevel = "high" | "low" | "off";
export const LIGHT_LEVELS: { id: LightLevel; label: string; hint: string }[] = [
  { id: "high", label: "Alto", hint: "Todas as luzes, brilho e tremulação" },
  { id: "low", label: "Baixo", hint: "Menos luzes, sem tremulação" },
  { id: "off", label: "Desligado", hint: "Sem escuridão (PCs fracos)" },
];
const KEY = "lemonquest.ui.lightfx";
/** Testes E2E não devem depender de pixels: iluminação desligada com ?e2e. */
const E2E = new URLSearchParams(location.search).has("e2e");

function loadLevel(): LightLevel {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "high" || v === "low" || v === "off") return v;
  } catch { /* sem localStorage */ }
  return "high";
}
export const lightLevelStore: Store<LightLevel> = createStore<LightLevel>(loadLevel());
lightLevelStore.subscribe((v) => { try { localStorage.setItem(KEY, v); } catch { /* ignora */ } });
export const useLightLevel = () => useStore(lightLevelStore);
/** Nível efetivo (E2E força "off" sem mexer na preferência salva). */
export const effectiveLightLevel = (): LightLevel => (E2E ? "off" : lightLevelStore.get());

// --- barramento de luzes temporárias (magias, projéteis, loot) ----------------------------------

interface Burst { x: number; y: number; color: number; r: number; ms: number; age: number; intensity: number }
interface PointLight { x: number; y: number; color: number; r: number; intensity: number }

const MAX_BURSTS = 28;

/** FX chamam isto sem saber nada de Phaser; o LightField consome a cada quadro. Coordenadas = pixels de mundo. */
class LightBus {
  bursts: Burst[] = [];
  points: PointLight[] = [];
  /** Clarão que some em `ms` (explosões, impactos, feixe de loot). */
  burst(x: number, y: number, color: number, radiusPx: number, ms: number, intensity = 1) {
    if (effectiveLightLevel() === "off") return;
    if (this.bursts.length >= MAX_BURSTS) this.bursts.shift();
    this.bursts.push({ x, y, color, r: radiusPx, ms, age: 0, intensity });
  }
  /** Luz de um quadro só (projétil em voo: chamar a cada quadro enquanto ele vive). */
  point(x: number, y: number, color: number, radiusPx: number, intensity = 1) {
    if (this.points.length < 16) this.points.push({ x, y, color, r: radiusPx, intensity });
  }
}
export const lightBus = new LightBus();

// --- pincel de luz --------------------------------------------------------------------------------

const BRUSH = "lq_light_brush";
const BRUSH_SIZE = 128;

function ensureBrush(scene: Phaser.Scene) {
  if (scene.textures.exists(BRUSH)) return;
  const tex = scene.textures.createCanvas(BRUSH, BRUSH_SIZE, BRUSH_SIZE)!;
  const ctx = tex.getContext();
  const img = ctx.createImageData(BRUSH_SIZE, BRUSH_SIZE);
  const c = (BRUSH_SIZE - 1) / 2;
  for (let y = 0; y < BRUSH_SIZE; y++) for (let x = 0; x < BRUSH_SIZE; x++) {
    const d = Math.hypot(x - c, y - c) / c;
    // núcleo pleno até ~25% do raio e queda suave (smoothstep) até 100%
    const t = Math.min(1, Math.max(0, (d - 0.34) / 0.66));
    const a = 1 - t * t * (3 - 2 * t);
    const o = (y * BRUSH_SIZE + x) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
    img.data[o + 3] = Math.round(a * 255);
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
}

// --- campo de luz ------------------------------------------------------------------------------------

export interface LightActors {
  /** Corpo do jogador local em pixels de mundo (null = ainda sem personagem). */
  me(): { x: number; y: number; tileX: number; tileY: number } | null;
  /** Outros jogadores (pixels de mundo). */
  others(): Iterable<{ x: number; y: number }>;
}

interface Draw { sx: number; sy: number; r: number; color: number; strength: number; glow: number }

const RT_DIV = { high: 4, low: 6 } as const;
const MAX_LIGHTS = { high: 40, low: 14 } as const;
/** Multiplicação do raio do jogador local (tiles). */
const ME_RADIUS_TILES = 3.7;
const ME_RADIUS_CAVE_TILES = 7.4;
const OTHER_RADIUS_TILES = 2.4;

function parseZones(tiled: TiledMap): ZoneRect[] {
  const layer = tiled.layers.find((l) => l.type === "objectgroup" && l.name === "objects");
  return (layer?.objects ?? [])
    .filter((o: TiledObject) => (o.type ?? o.class) === "zone" && o.name)
    .map((o) => ({ name: o.name, x: Math.floor(o.x / tiled.tilewidth), y: Math.floor(o.y / tiled.tileheight), w: Math.ceil(o.width / tiled.tilewidth), h: Math.ceil(o.height / tiled.tileheight) }));
}

const toInt = (c: Rgb) => (Math.round(c[0] * 255) << 16) | (Math.round(c[1] * 255) << 8) | Math.round(c[2] * 255);

export class LightField {
  private rt: Phaser.GameObjects.RenderTexture | null = null;
  private div = 0;
  private brushes: Phaser.GameObjects.Image[] = [];
  private glows: Phaser.GameObjects.Image[] = [];
  private readonly statics: StaticLight[];
  private readonly zones: ZoneRect[];
  private cur: Rgb = [1, 1, 1];
  private curInit = false;
  private zoneName: string | null = null;
  private enabled = true;
  /** Diagnóstico (dev/perf): luzes desenhadas no último quadro. */
  lastCount = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
    private readonly pcam: PixelCamera,
    tiled: TiledMap,
    private readonly actors: LightActors,
  ) {
    // Canvas 2D (sem WebGL) não suporta ERASE/MULTIPLY direito: sem iluminação.
    this.enabled = scene.sys.game.renderer.type === Phaser.WEBGL;
    this.statics = extractMapLights(tiled);
    this.zones = parseZones(tiled);
    ensureBrush(scene);
  }

  /** Zona atual do jogador (para a HUD/diagnóstico). */
  get zone() { return this.zoneName; }
  /** Cor multiplicadora atual (já suavizada). */
  get ambient(): Rgb { return this.cur; }

  private ensureRt(w: number, h: number, div: number) {
    const rw = Math.ceil(w / div), rh = Math.ceil(h / div);
    if (this.rt && this.div === div && this.rt.width === rw && this.rt.height === rh) return this.rt;
    this.rt?.destroy();
    const rt = this.scene.add.renderTexture(0, 0, rw, rh).setOrigin(0, 0).setScale(div).setDepth(0).setBlendMode(Phaser.BlendModes.MULTIPLY);
    rt.texture.setFilter(Phaser.Textures.FilterMode.LINEAR); // bordas suaves ao ampliar
    this.layer.add(rt);
    this.rt = rt;
    this.div = div;
    return rt;
  }

  private brush(i: number) {
    let b = this.brushes[i];
    if (!b) { b = this.scene.make.image({ key: BRUSH, add: false }); this.brushes[i] = b; }
    return b;
  }

  private glow(i: number) {
    let g = this.glows[i];
    if (!g) {
      g = this.scene.add.image(0, 0, BRUSH).setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
      this.layer.add(g);
      this.glows[i] = g;
    }
    return g;
  }

  private hide() {
    this.rt?.setVisible(false);
    for (const g of this.glows) g.setVisible(false);
    this.lastCount = 0;
  }

  update(dtMs: number, timeMs: number) {
    const level = effectiveLightLevel();
    // Consome sempre os temporários (não acumulam fora da tela / com a luz desligada).
    const bus = lightBus;
    for (const b of bus.bursts) b.age += dtMs;
    bus.bursts = bus.bursts.filter((b) => b.age < b.ms);
    const framePoints = bus.points;
    bus.points = [];

    if (level === "off" || !this.enabled) { this.hide(); return; }

    const me = this.actors.me();
    this.zoneName = me ? zoneAt(this.zones, me.tileX, me.tileY) : null;
    const target = ambientForZone(worldClock.now(), this.zoneName);
    if (!this.curInit) { this.cur = target; this.curInit = true; }
    else {
      const k = 1 - Math.exp(-dtMs / 1000 * 2.2);
      this.cur = [this.cur[0] + (target[0] - this.cur[0]) * k, this.cur[1] + (target[1] - this.cur[1]) * k, this.cur[2] + (target[2] - this.cur[2]) * k];
    }
    if (!needsLights(this.cur)) { this.hide(); return; }
    const dark = darknessOf(this.cur);

    const cam = this.scene.cameras.main;
    const W = cam.width, H = cam.height, zoom = this.pcam.zoom;
    const rt = this.ensureRt(W, H, RT_DIV[level]);
    rt.setVisible(true);
    const flicker = level === "high";
    const z = zoom;

    // Retângulo visível em mundo (com folga) para o recorte.
    const view = {
      x0: cam.scrollX + W / 2 - W / 2 / z - 4, x1: cam.scrollX + W / 2 + W / 2 / z + 4,
      y0: cam.scrollY + H / 2 - H / 2 / z - 4, y1: cam.scrollY + H / 2 + H / 2 / z + 4,
    };
    const sx = (wx: number) => this.pcam.toScreenX(wx), sy = (wy: number) => this.pcam.toScreenY(wy);
    const draws: Draw[] = [];
    const push = (x: number, y: number, rWorld: number, color: number, strength: number, glow: number) => {
      draws.push({ sx: sx(x), sy: sy(y), r: rWorld * z, color, strength, glow });
    };

    // Jogador local: luz pessoal quente, levemente maior à noite fechada (respira devagar).
    if (me) {
      const breathe = flicker ? 1 + 0.025 * Math.sin(timeMs / 700) : 1;
      // Em cavernas/cripta (escuras o tempo todo) a luz pessoal é maior e mais forte: é ela que mostra o caminho.
      const cave = zoneLightMode(this.zoneName) === "dark";
      push(me.x, me.y - 2, (cave ? ME_RADIUS_CAVE_TILES : ME_RADIUS_TILES) * TILE_SIZE * breathe, 0xffe2b4, cave ? 0.97 : 0.85, cave ? 0.1 : 0.05);
    }
    // Temporárias (clarões de magia e projéteis): recortadas pela tela e com vagas reservadas logo após a pessoal —
    // no modo baixo uma cidade com muitas tochas não pode apagar as luzes do combate.
    const near = (x: number, y: number) => x >= view.x0 - 48 && x <= view.x1 + 48 && y >= view.y0 - 48 && y <= view.y1 + 48;
    const cap = MAX_LIGHTS[level];
    const dynCap = Math.ceil(cap / 3);
    // Além da reserva, as temporárias ainda entram no fim se sobrar vaga (modo alto).
    const late: Draw[] = [];
    const pushDyn = (x: number, y: number, rWorld: number, color: number, strength: number, glow: number) => {
      if (!near(x, y)) return;
      if (draws.length - (me ? 1 : 0) < dynCap) push(x, y, rWorld, color, strength, glow);
      else late.push({ sx: sx(x), sy: sy(y), r: rWorld * z, color, strength, glow });
    };
    for (const b of bus.bursts) {
      const t = b.age / b.ms;
      const fade = (1 - t) * (1 - t);
      pushDyn(b.x, b.y, b.r * (0.75 + 0.35 * t), b.color, Math.min(1, b.intensity * fade * 1.2), 0.55 * b.intensity * fade);
    }
    for (const p of framePoints) pushDyn(p.x, p.y, p.r, p.color, Math.min(1, p.intensity), 0.5 * p.intensity);
    for (const o of this.actors.others()) {
      if (!near(o.x, o.y)) continue;
      push(o.x, o.y - 2, OTHER_RADIUS_TILES * TILE_SIZE, 0xffe2b4, 0.8, 0.08);
    }
    // Fixas do mapa.
    for (const l of cullLights(this.statics, view)) {
      let r = l.r, s = l.strength, g = l.glow;
      if (flicker && l.flicker > 0) {
        const f = flickerWave(timeMs, l.x * 0.13 + l.y * 0.07);
        r *= 1 + f * 0.05 * l.flicker * 2;
        g *= 1 + f * 0.3 * l.flicker;
        s = Math.min(1, s * (1 + f * 0.04 * l.flicker));
      }
      push(l.x, l.y, r, l.color, s, g);
    }

    for (const d of late) draws.push(d);

    // Limite de luzes: pessoal, temporárias (reservadas), outros jogadores, fixas e o resto das temporárias.
    if (draws.length > cap) draws.length = cap;
    this.lastCount = draws.length;

    // 1) escuridão cheia com a cor ambiente...
    rt.fill(toInt(this.cur), 1);
    // 2) ...com um buraco suave por luz.
    const div = this.div;
    const brushes: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < draws.length; i++) {
      const d = draws[i];
      const b = this.brush(i);
      b.setPosition(d.sx / div, d.sy / div).setScale((d.r * 2) / div / BRUSH_SIZE).setAlpha(d.strength);
      brushes.push(b);
    }
    if (brushes.length) rt.erase(brushes);

    // 3) brilho aditivo colorido (só se ainda há noite de verdade).
    const glowK = Math.min(1, dark * 1.8);
    let gi = 0;
    if (level === "high") {
      for (const d of draws) {
        if (d.glow <= 0.01) continue;
        const g = this.glow(gi++);
        const a = d.glow * glowK;
        g.setVisible(true).setPosition(d.sx, d.sy).setTint(d.color).setAlpha(Math.min(0.6, a)).setDisplaySize(d.r * 1.3, d.r * 1.3);
      }
    }
    for (let i = gi; i < this.glows.length; i++) this.glows[i].setVisible(false);
  }

  destroy() {
    this.rt?.destroy();
    this.rt = null;
    for (const g of this.glows) g.destroy();
    for (const b of this.brushes) b.destroy();
    this.glows = [];
    this.brushes = [];
  }
}
