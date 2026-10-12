// Fontes de luz ESTÁTICAS do mapa (funções puras, sem Phaser): postes (tile de lampião), objetos "light", NPCs, portais.
// Mais o recorte (culling) das luzes por retângulo de tela.
import { findObjects, objectTile, type TiledMap, type TiledObject } from "@lemonquest/shared";

export interface StaticLight {
  /** Centro em pixels de mundo. */
  x: number; y: number;
  /** Raio em pixels de mundo. */
  r: number;
  color: number;
  /** 0..1: força do "buraco" na escuridão. */
  strength: number;
  /** 0..1: quanto tremula (0 = estável). */
  flicker: number;
  /** 0..1: brilho aditivo colorido por cima. */
  glow: number;
  kind: "lamp" | "light" | "npc" | "portal";
}

const T = 16;
const LAMP_COLOR = 0xffc470;

/** Id do tile "poste" no tileset Element (col 6, linha 4 = a metade de baixo do lampião 1x2 do mapgen). */
const LAMP_COL = 6, LAMP_ROW_BOTTOM = 4;

const prop = (o: TiledObject, name: string) => o.properties?.find((p) => p.name === name)?.value;

/** "#rrggbb" | "rrggbb" | 0xrrggbb (número) → int. Inválido → fallback. */
export function parseColor(v: unknown, fallback = LAMP_COLOR): number {
  if (typeof v === "number" && Number.isFinite(v)) return v & 0xffffff;
  if (typeof v === "string") {
    const m = /^#?([0-9a-f]{6})$/i.exec(v.trim());
    if (m) return parseInt(m[1], 16);
  }
  return fallback;
}

/** Raio da prop: em tiles (padrão); valores > 40 são lidos como pixels. */
function parseRadiusPx(v: unknown, fallbackTiles: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallbackTiles * T;
  return n > 40 ? n : n * T;
}

function parseFlicker(v: unknown): number {
  if (v === true) return 0.6;
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.min(1, v));
  return 0;
}

export function extractMapLights(tiled: TiledMap): StaticLight[] {
  const out: StaticLight[] = [];

  // 1) Postes: tile de lampião na camada "deco" (a metade de baixo; a chama fica no tile de cima).
  const deco = tiled.layers.find((l) => l.type === "tilelayer" && l.name === "deco");
  const element = tiled.tilesets.find((t) => t.name === "TilesetElement");
  if (deco?.data && element) {
    const cols = element.columns || 16;
    const gid = element.firstgid + LAMP_ROW_BOTTOM * cols + LAMP_COL;
    const W = tiled.width;
    for (let i = 0; i < deco.data.length; i++) {
      if ((deco.data[i] & 0x1fffffff) !== gid) continue;
      const tx = i % W, ty = Math.floor(i / W);
      out.push({ x: (tx + 0.5) * T, y: (ty - 0.55) * T, r: 5.2 * T, color: LAMP_COLOR, strength: 0.95, flicker: 0.55, glow: 0.42, kind: "lamp" });
    }
  }

  // 2) Objetos "light" do mapa (props: radius em tiles, color, flicker).
  for (const o of findObjects(tiled, "light")) {
    const cx = o.x + (o.width || 0) / 2, cy = o.y + (o.height || 0) / 2;
    out.push({
      x: cx, y: cy, r: parseRadiusPx(prop(o, "radius"), 4), color: parseColor(prop(o, "color")),
      strength: 0.95, flicker: parseFlicker(prop(o, "flicker")), glow: 0.4, kind: "light",
    });
  }

  // 3) NPCs: um brilho quente discreto (vendedores com lampião).
  for (const o of findObjects(tiled, "npc")) {
    const t = objectTile(o, T);
    out.push({ x: (t.x + 0.5) * T, y: (t.y + 0.4) * T, r: 2.8 * T, color: 0xffd9a8, strength: 0.6, flicker: 0.15, glow: 0.14, kind: "npc" });
  }

  // 4) Portais: brilho arcano violeta.
  for (const o of findObjects(tiled, "portal")) {
    const t = objectTile(o, T);
    out.push({ x: (t.x + 0.5) * T, y: (t.y + 0.5) * T, r: 3 * T, color: 0xa88aff, strength: 0.8, flicker: 0.35, glow: 0.35, kind: "portal" });
  }
  return out;
}

export interface Rect { x0: number; y0: number; x1: number; y1: number }

/** Luzes cujo círculo toca o retângulo (coordenadas de mundo). */
export function cullLights<L extends { x: number; y: number; r: number }>(lights: readonly L[], view: Rect): L[] {
  return lights.filter((l) => l.x + l.r >= view.x0 && l.x - l.r <= view.x1 && l.y + l.r >= view.y0 && l.y - l.r <= view.y1);
}

/** Oscilação suave e barata em [-1, 1] (soma de senoides), determinística por fase. */
export function flickerWave(timeMs: number, phase: number): number {
  const t = timeMs / 1000;
  return (Math.sin(t * 7.3 + phase) * 0.5 + Math.sin(t * 13.1 + phase * 2.3) * 0.3 + Math.sin(t * 3.1 + phase * 0.7) * 0.2);
}
