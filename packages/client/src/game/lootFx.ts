// Animação de loot: itens/moedas saltam no tile do abate e voam até o jogador. Ícones carregados sob demanda.
import Phaser from "phaser";
import { RARITY_COLOR, TILE_SIZE, itemDef, type ItemIcon, type ItemInstance, type Rarity } from "@lemonquest/shared";
import type { CombatFx } from "./combatFx.ts";
import { sfx, type SfxName } from "./sfx.ts";
import { TEX } from "./textures.ts";
import { lightBus } from "./lighting.ts";

const DEPTH = 1_950_000;
const BEAM_DEPTH = 1_899_000;
const POP_MS = 420;
const STAGGER_MS = 80;
const FLY_MS = 600;
const COIN_KEY = "loot_coin";
const COIN_ANIM = "loot:coin";

const hex = (c: string) => parseInt(c.slice(1), 16);

/** Tempo (ms) que os itens ficam no chão antes de voar. Épico/lendário: feixe de luz de 1,5 s. */
const HOLD: Record<Rarity, number> = { common: 450, uncommon: 450, rare: 750, epic: 1500, legendary: 1500 };

interface Piece {
  glow: Phaser.GameObjects.Image;
  spr: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  rarity: Rarity | null; // null = moeda
  sx: number; sy: number;
  lx: number; ly: number;
  fromX: number; fromY: number;
  popAt: number; flyAt: number;
  phase: "wait" | "pop" | "hold" | "fly" | "done";
  base: number;
}

interface Drop {
  t: number;
  pieces: Piece[];
  fx: Phaser.GameObjects.GameObject[];
  beam?: { img: Phaser.GameObjects.Image; ring: Phaser.GameObjects.Image; until: number; h: number; w: number };
  gold: number;
  lastCoin?: Piece;
  goldShown: boolean;
  sfxItem: boolean;
}

// --- ícones de item sob demanda (também usados por game/ground.ts) ------------------------

/** Chave de textura do ícone de um item. */
export function itemIconKey(icon: ItemIcon): string {
  return icon.frame !== undefined ? `lootsheet:${icon.url}:${icon.frameWidth}x${icon.frameHeight}` : `lootimg:${icon.url}`;
}

const pendingIcons = new WeakMap<Phaser.Scene, Map<string, ((ok: boolean) => void)[]>>();

/** Carrega o ícone (uma vez por cena) e chama `done(ok)`. */
export function ensureItemIcon(scene: Phaser.Scene, icon: ItemIcon, done: (ok: boolean) => void): void {
  const key = itemIconKey(icon);
  if (scene.textures.exists(key)) { done(true); return; }
  let pending = pendingIcons.get(scene);
  if (!pending) { pending = new Map(); pendingIcons.set(scene, pending); }
  const waiting = pending.get(key);
  if (waiting) { waiting.push(done); return; }
  pending.set(key, [done]);
  const url = `${import.meta.env.BASE_URL}${icon.url}`;
  const finish = (ok: boolean) => {
    scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onErr);
    const cbs = pending!.get(key) ?? [];
    pending!.delete(key);
    for (const cb of cbs) cb(ok);
  };
  const onErr = (f: Phaser.Loader.File) => { if (f.key === key) finish(false); };
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onErr);
  scene.load.once(`${Phaser.Loader.Events.FILE_KEY_COMPLETE}${icon.frame !== undefined ? "spritesheet" : "image"}-${key}`, () => finish(true));
  if (icon.frame !== undefined) scene.load.spritesheet(key, url, { frameWidth: icon.frameWidth ?? 16, frameHeight: icon.frameHeight ?? 16 });
  else scene.load.image(key, url);
  if (!scene.load.isLoading()) scene.load.start();
}

interface LootLike { x: number; y: number; items: ItemInstance[]; gold: number }

export class LootFx {
  private drops: Drop[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldLayer: Phaser.GameObjects.Layer,
    private readonly uiLayer: Phaser.GameObjects.Layer,
    private readonly fx: CombatFx,
    /** Corpo do jogador local (px de mundo), ou null. */
    private readonly player: () => { x: number; y: number; headY: number } | null,
  ) {}

  static preload(scene: Phaser.Scene) {
    scene.load.spritesheet(COIN_KEY, `${import.meta.env.BASE_URL}ninja/Items/Treasure/Coin2.png`, { frameWidth: 10, frameHeight: 10 });
  }

  static createAnims(scene: Phaser.Scene) {
    if (scene.anims.exists(COIN_ANIM)) return;
    scene.anims.create({ key: COIN_ANIM, frames: scene.anims.generateFrameNumbers(COIN_KEY, { start: 0, end: 3 }), frameRate: 9, repeat: -1 });
  }

  private iconKey(icon: ItemIcon) { return itemIconKey(icon); }
  private ensureIcon(icon: ItemIcon, done: (ok: boolean) => void) { ensureItemIcon(this.scene, icon, done); }

  // --- drop ------------------------------------------------------------------

  drop(msg: LootLike) {
    const items = msg.items.slice(0, 8);
    const coinN = msg.gold > 0 ? Math.min(5, Math.max(2, 1 + Math.ceil(Math.log10(msg.gold + 1)))) : 0;
    if (!items.length && !coinN) return;
    let left = items.length;
    const icons: (boolean)[] = [];
    let started = false;
    const go = () => { if (started) return; started = true; this.start(msg, items, icons, coinN); };
    if (!left) { go(); return; }
    items.forEach((it, i) => {
      const def = itemDef(it.defId);
      if (!def) { icons[i] = false; if (--left === 0) go(); return; }
      this.ensureIcon(def.icon, (ok) => { icons[i] = ok; if (--left === 0) go(); });
    });
    window.setTimeout(go, 1500); // rede lenta: anima com o que tiver
  }

  private start(msg: LootLike, items: ItemInstance[], ok: boolean[], coinN: number) {
    const cx = (msg.x + 0.5) * TILE_SIZE, cy = (msg.y + 0.5) * TILE_SIZE;
    const order: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
    const best = items.reduce<Rarity>((b, it) => (order.indexOf(it.rarity) > order.indexOf(b) ? it.rarity : b), "common");
    const hold = items.length ? HOLD[best] : 400;
    const drop: Drop = { t: 0, pieces: [], fx: [], gold: msg.gold, goldShown: false, sfxItem: false };
    const n = items.length + coinN;
    const add = (spr: Piece["spr"], rarity: Rarity | null, i: number, tint: number) => {
      const glow = this.scene.add.image(0, 0, TEX.glow).setBlendMode(Phaser.BlendModes.ADD).setTint(tint)
        .setAlpha(rarity === "common" ? 0.35 : rarity === null ? 0.3 : 0.7).setScale(rarity === null ? 0.28 : 0.45);
      this.worldLayer.add(glow.setDepth(DEPTH - 1));
      this.worldLayer.add(spr.setDepth(DEPTH));
      const ang = (n === 1 ? 0 : (i / n) * Math.PI * 2) + Math.random() * 0.5;
      const rad = n === 1 ? 0 : 5 + Math.random() * 5;
      const p: Piece = {
        glow, spr, rarity, sx: cx, sy: cy,
        lx: cx + Math.cos(ang) * rad, ly: cy + Math.sin(ang) * rad * 0.6 + 2,
        fromX: cx, fromY: cy,
        popAt: i * STAGGER_MS, flyAt: hold + i * STAGGER_MS, phase: "wait", base: spr.scale,
      };
      spr.setVisible(false); glow.setVisible(false);
      drop.pieces.push(p);
      return p;
    };
    items.forEach((it, i) => {
      const def = itemDef(it.defId)!;
      const tint = hex(RARITY_COLOR[it.rarity]);
      const key = ok[i] && def ? this.iconKey(def.icon) : null;
      let spr: Piece["spr"];
      if (key) {
        spr = this.scene.add.image(0, 0, key, def.icon.frame);
        if (def.icon.tint !== undefined) spr.setTint(def.icon.tint);
        const sc = Phaser.Math.Clamp(12 / Math.max(spr.width, spr.height), 0.75, 1.5);
        spr.setScale(sc);
      } else {
        spr = this.scene.add.image(0, 0, TEX.px).setTint(tint).setDisplaySize(5, 5);
      }
      add(spr, it.rarity, i, tint);
    });
    for (let c = 0; c < coinN; c++) {
      const spr = this.scene.add.sprite(0, 0, COIN_KEY, 0).setScale(0.8);
      spr.play({ key: COIN_ANIM, startFrame: c % 4 });
      drop.lastCoin = add(spr, null, items.length + c, 0xffd447);
    }

    // Feixes de luz (raro: pequeno e azul; épico/lendário: alto + flash + som).
    if (best === "rare" || best === "epic" || best === "legendary") {
      const big = best !== "rare";
      const tint = hex(RARITY_COLOR[best]);
      const h = big ? 120 : 56, w = big ? 15 : 9;
      const img = this.scene.add.image(cx, cy + 5, TEX.beam).setOrigin(0.5, 1).setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(w, h).setAlpha(0);
      const ring = this.scene.add.image(cx, cy + 4, TEX.ring).setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setScale(0.1).setAlpha(0);
      this.worldLayer.add(img.setDepth(BEAM_DEPTH));
      this.worldLayer.add(ring.setDepth(BEAM_DEPTH));
      drop.beam = { img, ring, until: hold, h, w };
      lightBus.burst(cx, cy, tint, big ? 70 : 46, hold + 500, big ? 1 : 0.8);
      drop.fx.push(img, ring);
      if (big) this.flash(tint);
      sfx.play(best === "legendary" ? "lootLegend" : best === "epic" ? "lootEpic" : "lootRare", { volume: big ? 1 : 0.8 });
    }
    this.drops.push(drop);
  }

  private flash(tint: number) {
    const f = this.scene.add.image(0, 0, TEX.px).setOrigin(0, 0).setTint(tint).setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(this.scene.scale.width, this.scene.scale.height).setAlpha(0.3);
    this.uiLayer.add(f);
    this.scene.tweens.add({ targets: f, alpha: 0, duration: 280, ease: "Quad.easeOut", onComplete: () => f.destroy() });
  }

  update(dt: number) {
    if (!this.drops.length) return;
    const pl = this.player();
    for (let di = this.drops.length - 1; di >= 0; di--) {
      const d = this.drops[di];
      d.t += dt;
      let alive = 0;
      for (const p of d.pieces) {
        if (p.phase === "done") continue;
        alive++;
        this.stepPiece(d, p, pl);
      }
      if (d.beam) {
        const b = d.beam;
        if (d.t >= b.until) { b.img.destroy(); b.ring.destroy(); d.beam = undefined; }
        else {
          const k = d.t / b.until;
          const a = Math.min(1, d.t / 160) * Math.min(1, (b.until - d.t) / 260);
          const pulse = 0.85 + 0.15 * Math.sin(d.t / 70);
          b.img.setAlpha(a * pulse).setDisplaySize(b.w * (0.8 + 0.25 * Math.sin(d.t / 130)), b.h * Math.min(1, d.t / 220));
          b.ring.setAlpha(a * 0.8).setScale(0.18 + 0.05 * Math.sin(d.t / 90) + 0.04 * k);
        }
      }
      if (!alive && !d.beam) this.drops.splice(di, 1);
    }
  }

  private stepPiece(d: Drop, p: Piece, pl: { x: number; y: number; headY: number } | null) {
    const t = d.t;
    if (p.phase === "wait") {
      if (t < p.popAt) return;
      p.phase = "pop";
      p.spr.setVisible(true); p.glow.setVisible(true);
    }
    if (p.phase === "pop") {
      const k = Math.min(1, (t - p.popAt) / POP_MS);
      // arco principal (0..0.62) + quique pequeno (0.62..1)
      const arc = k < 0.62 ? 15 * Math.sin(Math.PI * (k / 0.62)) : 4 * Math.sin(Math.PI * ((k - 0.62) / 0.38));
      const e = Phaser.Math.Easing.Quadratic.Out(Math.min(1, k * 1.15));
      p.fromX = p.sx + (p.lx - p.sx) * e;
      p.fromY = p.sy + (p.ly - p.sy) * e;
      this.place(p, p.fromX, p.fromY - arc - 3);
      if (k >= 1) p.phase = "hold";
      return;
    }
    if (p.phase === "hold") {
      // flutua de leve enquanto espera
      this.place(p, p.fromX, p.fromY - 3 - Math.sin((t + p.popAt) / 180));
      if (t >= p.flyAt) p.phase = "fly";
      return;
    }
    // fly
    const k = Math.min(1, (t - p.flyAt) / FLY_MS);
    const tx = pl ? pl.x : p.fromX, ty = pl ? pl.y : p.fromY - 12;
    const e = k * k * (3 - 2 * k) * 0.6 + k * k * 0.4;
    const x = p.fromX + (tx - p.fromX) * e;
    const y = p.fromY - 3 + (ty - p.fromY + 3) * e - Math.sin(Math.PI * k) * 10;
    this.place(p, x, y);
    p.spr.setScale(p.base * (1 - 0.4 * k));
    p.glow.setAlpha(p.glow.alpha);
    if (k >= 1) {
      p.phase = "done";
      if (pl) this.arrive(d, p, pl);
      p.spr.destroy(); p.glow.destroy();
    }
  }

  private place(p: Piece, x: number, y: number) {
    const rx = Math.round(x), ry = Math.round(y);
    p.spr.setPosition(rx, ry);
    p.glow.setPosition(rx, ry);
  }

  private arrive(d: Drop, p: Piece, pl: { x: number; y: number; headY: number }) {
    if (p.rarity === null) {
      sfx.play("coin", { volume: 0.6 });
      if (p === d.lastCoin && !d.goldShown && d.gold > 0) {
        d.goldShown = true;
        this.fx.floatText(pl.x, pl.headY - 4, `+${d.gold} ouro`, 0xffd447, { size: 15, life: 1200, rise: 18, dx: 0 });
      }
    } else if (!d.sfxItem) {
      d.sfxItem = true;
      sfx.play("loot" as SfxName, { volume: 0.7 });
    }
    // brilho curto ao entrar
    const tint = p.rarity ? hex(RARITY_COLOR[p.rarity]) : 0xffd447;
    const g = this.scene.add.image(pl.x, pl.y, TEX.glow).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(0.25).setAlpha(0.8);
    this.worldLayer.add(g.setDepth(DEPTH));
    this.scene.tweens.add({ targets: g, alpha: 0, scale: 0.6, duration: 260, onComplete: () => g.destroy() });
  }

  destroy() {
    for (const d of this.drops) {
      for (const p of d.pieces) { if (p.phase !== "done") { p.spr.destroy(); p.glow.destroy(); } }
      for (const o of d.fx) o.destroy();
    }
    this.drops = [];
  }
}
