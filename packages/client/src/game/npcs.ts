// NPCs no mundo: sprites parados (olham em volta / viram para o jogador), nome com selos, balões de fala e acerto de clique.
import Phaser from "phaser";
import { NPCS, TILE_SIZE, findObjects, objectTile, type Facing, type TiledMap } from "@tibinha/shared";
import { Actor, type ActorDeps } from "./actor.ts";
import { gridSheet, type CharacterSheet } from "./sprites.ts";

const FALLBACK_URL = "ninja/Actor/Character/Villager/SpriteSheet.png";
const NAME_COLOR = "#8fe6d6";
const FONT = '"Pixelify Sans", Verdana, system-ui, sans-serif';
const BUBBLE_MS = 4000;
const BUBBLE_FADE_MS = 600;
const BUBBLE_MAX_W = 160;
const BADGE_COIN = "npc_badge_coin";
const BADGE_CHEST = "npc_badge_chest";

const sheetKey = (url: string) => `npc:${url}`;
const FALLBACK = gridSheet(sheetKey(FALLBACK_URL), FALLBACK_URL, 16, 16);

/** Sheets de todos os NPCs do catálogo + o genérico (para o preload / animações). */
export function allNpcSheets(): CharacterSheet[] {
  const seen = new Map<string, CharacterSheet>([[FALLBACK.key, FALLBACK]]);
  for (const d of Object.values(NPCS)) {
    const k = sheetKey(d.sprite);
    if (!seen.has(k)) seen.set(k, gridSheet(k, d.sprite, 16, 16));
  }
  return [...seen.values()];
}

/** Desenha um selo pixel-art a partir de um mapa de caracteres. */
function badgeTexture(scene: Phaser.Scene, key: string, rows: string[], pal: Record<string, string>) {
  if (scene.textures.exists(key)) return;
  const w = rows[0].length, h = rows.length;
  const tex = scene.textures.createCanvas(key, w, h)!;
  const ctx = tex.getContext();
  rows.forEach((row, y) => [...row].forEach((c, x) => { if (pal[c]) { ctx.fillStyle = pal[c]; ctx.fillRect(x, y, 1, 1); } }));
  tex.refresh();
}

function createBadgeTextures(scene: Phaser.Scene) {
  badgeTexture(scene, BADGE_COIN, [
    ".oooo.",
    "oyyhyo",
    "oyhyyo",
    "oyyyyo",
    "oyyyyo",
    ".oooo.",
  ], { o: "#6b4a00", y: "#ffd447", h: "#fff3b0" });
  badgeTexture(scene, BADGE_CHEST, [
    ".bbbbb.",
    "bwwwwwb",
    "bbbgbbb",
    "bwwgwwb",
    "bwwwwwb",
    ".bbbbb.",
  ], { b: "#3a2412", w: "#a8693a", g: "#ffd447" });
}

interface Bubble {
  box: Phaser.GameObjects.Container;
  age: number;
}

interface Npc {
  id: string;
  actor: Actor;
  tx: number; ty: number;
  badges: Phaser.GameObjects.Image[];
  bubble?: Bubble;
  face: Facing;
  nextLook: number;
  lookLeft: number;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class NpcManager {
  private npcs = new Map<string, Npc>();
  private readonly res = Math.max(1, Math.ceil(window.devicePixelRatio || 1));

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: () => ActorDeps,
    private readonly uiLayer: Phaser.GameObjects.Layer,
  ) {
    createBadgeTextures(scene);
  }

  /** Cria NPCs a partir dos objetos "npc" do mapa Tiled. */
  addFromMap(tiled: TiledMap) {
    for (const o of findObjects(tiled, "npc")) {
      const id = String(o.properties?.find((p) => p.name === "npcId")?.value ?? o.name ?? "");
      if (!id) continue;
      const t = objectTile(o, tiled.tilewidth);
      this.add(id, t.x, t.y);
    }
  }

  add(id: string, x: number, y: number) {
    if (this.npcs.has(id)) return;
    const def = NPCS[id];
    const want = def ? sheetKey(def.sprite) : FALLBACK.key;
    const sheet = def && this.scene.textures.exists(want) ? gridSheet(want, def.sprite, 16, 16) : FALLBACK;
    const actor = new Actor(
      this.deps(), { sheet, tint: 0xffffff }, def?.name ?? id, false, x, y, 4,
      { fontSize: 10, nameColor: NAME_COLOR, noBar: true },
    );
    const badges: Phaser.GameObjects.Image[] = [];
    if (def?.shop) badges.push(this.scene.add.image(0, 0, BADGE_COIN));
    if (def?.depot) badges.push(this.scene.add.image(0, 0, BADGE_CHEST));
    for (const b of badges) this.uiLayer.add(b.setOrigin(0.5, 0.5));
    this.npcs.set(id, { id, actor, tx: x, ty: y, badges, face: "down", nextLook: rnd(4000, 8000), lookLeft: 0 });
  }

  isNpcTile(x: number, y: number): boolean {
    for (const n of this.npcs.values()) if (n.tx === x && n.ty === y) return true;
    return false;
  }

  tileOf(id: string): { x: number; y: number } | null {
    const n = this.npcs.get(id);
    return n ? { x: n.tx, y: n.ty } : null;
  }

  /** NPC sob um ponto do mundo (px): o tile dele + um pouco da cabeça. */
  atPoint(wx: number, wy: number): string | null {
    for (const n of this.npcs.values()) {
      const x = n.tx * TILE_SIZE, y = n.ty * TILE_SIZE;
      if (wx >= x && wx < x + TILE_SIZE && wy >= y - 5 && wy < y + TILE_SIZE) return n.id;
    }
    return null;
  }

  /** Balão de fala (substitui o anterior). */
  say(id: string, text: string) {
    const n = this.npcs.get(id);
    if (!n || !text) return;
    n.bubble?.box.destroy();
    const t = this.scene.add.text(0, 0, text, {
      fontFamily: FONT, fontSize: "12px", color: "#1d2030", align: "center",
      wordWrap: { width: BUBBLE_MAX_W - 12, useAdvancedWrap: true }, resolution: this.res,
    }).setOrigin(0.5, 1);
    const w = Math.ceil(t.width) + 12, h = Math.ceil(t.height) + 8;
    const g = this.scene.add.graphics();
    g.fillStyle(0x10131c, 0.9).fillRoundedRect(-w / 2 - 1, -h - 7, w + 2, h + 2, 7);
    g.fillStyle(0xf6f2e4, 1).fillRoundedRect(-w / 2, -h - 6, w, h, 6);
    g.fillStyle(0x10131c, 0.9).fillTriangle(-4, -5, 4, -5, 0, 0);
    g.fillStyle(0xf6f2e4, 1).fillTriangle(-3, -6, 3, -6, 0, -2);
    t.setPosition(0, -10);
    const box = this.scene.add.container(0, 0, [g, t]);
    this.uiLayer.add(box);
    n.bubble = { box, age: 0 };
  }

  update(dt: number, me: Actor | undefined) {
    for (const n of this.npcs.values()) {
      n.actor.update(dt);
      let want: Facing = n.face;
      const d = me ? Math.max(Math.abs(me.tileX - n.tx), Math.abs(me.tileY - n.ty)) : 99;
      if (me && d <= 3) {
        const dx = me.tileX - n.tx, dy = me.tileY - n.ty;
        want = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
        n.lookLeft = 0; n.nextLook = rnd(2500, 5000);
      } else if (n.lookLeft > 0) {
        n.lookLeft -= dt;
        if (n.lookLeft <= 0) { want = "down"; n.nextLook = rnd(4000, 8000); }
      } else {
        n.nextLook -= dt;
        if (n.nextLook <= 0) {
          const opts = (["left", "right", "up", "down"] as Facing[]).filter((f) => f !== n.face);
          want = opts[(Math.random() * opts.length) | 0];
          n.lookLeft = rnd(900, 1800);
        } else if (n.face !== "down") want = "down";
      }
      if (want !== n.face) { n.face = want; n.actor.faceSide(want); }
    }
  }

  /** Nome, selos e balões na câmera de UI (zoom 1). */
  placeUi(zoom: number, dt: number, toScreenX: (wx: number) => number, toScreenY: (wy: number) => number) {
    const bs = zoom >= 3 ? 2 : 1;
    for (const n of this.npcs.values()) {
      const a = n.actor;
      a.placeUi(toScreenX(a.headX), toScreenY(a.headY), zoom, dt);
      const lx = a.label.x, ly = a.label.y - a.label.height / 2 - 1;
      let x = lx - a.label.width / 2 + 1;
      for (const b of n.badges) {
        b.setScale(bs).setVisible(a.label.visible);
        x -= (b.width * bs) / 2 + 1;
        b.setPosition(Math.round(x), Math.round(ly));
        x -= (b.width * bs) / 2 + 2;
      }
      const bub = n.bubble;
      if (bub) {
        bub.age += dt;
        if (bub.age >= BUBBLE_MS) { bub.box.destroy(); n.bubble = undefined; continue; }
        const left = BUBBLE_MS - bub.age;
        bub.box.setAlpha(left < BUBBLE_FADE_MS ? left / BUBBLE_FADE_MS : 1);
        bub.box.setPosition(Math.round(lx), Math.round(a.label.y - a.label.height - 2));
      }
    }
  }

  destroy() {
    for (const n of this.npcs.values()) {
      n.actor.destroy();
      n.bubble?.box.destroy();
      for (const b of n.badges) b.destroy();
    }
    this.npcs.clear();
  }
}
