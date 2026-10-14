// Itens no chão (state.groundItems): desenha o item do topo de cada tile (abaixo dos atores), centrado e
// reduzido a 16 px, com brilho de raridade (raro+), cintilar (épico/lendário), quantidade da pilha e uma
// "pilha" de itens por baixo quando há mais de um no tile. Rótulo com o nome (cor da raridade) ao passar o mouse.
import Phaser from "phaser";
import { RARITIES, RARITY_COLOR, TILE_SIZE, itemDef, type GroundItemView, type ItemInstance, type Rarity } from "@lemonquest/shared";
import { ensureItemIcon, itemIconKey } from "./lootFx.ts";
import { TEX } from "./textures.ts";
import { textRes } from "./textRes.ts";

/** Abaixo do quadrado de hover (5) e dos atores (≥ 26); acima do chão (< 0). */
const DEPTH = 3;
const POP_MS = 360;
const CULL_TILES = 22;
const ICON_PX = 14;
const UNDER_MAX = 2;

const hex = (c: string) => parseInt(c.slice(1), 16);
const tileKey = (x: number, y: number) => `${x},${y}`;
const asRarity = (r: string): Rarity => ((RARITIES as string[]).includes(r) ? (r as Rarity) : "common");

interface TileVisual {
  x: number; y: number;
  glow?: Phaser.GameObjects.Image;
  spr?: Phaser.GameObjects.Image;
  under: Phaser.GameObjects.Image[];
  count?: Phaser.GameObjects.Text;
  sparkle?: Phaser.GameObjects.Image;
  rarity: Rarity;
  topId: string;
  popAt: number;   // ms (relógio local) do pop-in; -1 = sem animação
  t: number;
}

export class GroundItems {
  private readonly items = new Map<string, GroundItemView>();
  private readonly tiles = new Map<string, string[]>();
  private readonly visuals = new Map<string, TileVisual>();
  private label: Phaser.GameObjects.Text;
  private labelFor = "";
  private clock = 0;
  /** Itens que chegam logo após conectar (sincronização inicial) não "pulam". */
  private quietUntil = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldLayer: Phaser.GameObjects.Layer,
    private readonly uiLayer: Phaser.GameObjects.Layer,
  ) {
    this.label = scene.add.text(0, 0, "", {
      fontFamily: "Verdana, Tahoma, system-ui, sans-serif", fontSize: "11px", fontStyle: "bold",
      color: "#ffffff", stroke: "#101018", strokeThickness: 3,
      resolution: textRes(),
    }).setOrigin(0.5, 1).setVisible(false);
    uiLayer.add(this.label);
  }

  /** Chamado ao entrar numa sala: o que vier nos próximos instantes é o estado inicial. */
  beginSync(): void { this.quietUntil = this.clock + 600; }

  get(id: string): GroundItemView | undefined { return this.items.get(id); }

  /** Todos os itens conhecidos (cópias). */
  all(): GroundItemView[] { return [...this.items.values()].map((v) => ({ ...v })); }

  /** Id do item do topo no tile (ou null). */
  topAt(x: number, y: number): string | null {
    const ids = this.tiles.get(tileKey(x, y));
    return ids?.length ? ids[ids.length - 1]! : null;
  }

  /** Instância "de vitrine" (sem bônus — o servidor não os envia) para fantasma/tooltip de arrasto. */
  instanceOf(id: string): ItemInstance | null {
    const v = this.items.get(id);
    return v ? { uid: v.id, defId: v.defId, count: v.count, rarity: asRarity(v.rarity), bonuses: [] } : null;
  }

  add(id: string, v: GroundItemView): void {
    // Cópia: o objeto do schema muda em onChange (count).
    this.items.set(id, { id, defId: v.defId, count: v.count, rarity: v.rarity, x: v.x, y: v.y });
    const k = tileKey(v.x, v.y);
    const list = this.tiles.get(k);
    if (list) list.push(id); else this.tiles.set(k, [id]);
    this.refresh(k, this.clock >= this.quietUntil);
  }

  change(id: string, v: GroundItemView): void {
    const cur = this.items.get(id);
    if (!cur || cur.count === v.count) return;
    cur.count = v.count;
    this.refresh(tileKey(cur.x, cur.y), false);
  }

  remove(id: string): void {
    const v = this.items.get(id);
    if (!v) return;
    this.items.delete(id);
    const k = tileKey(v.x, v.y);
    const list = this.tiles.get(k);
    if (list) {
      const i = list.indexOf(id);
      if (i >= 0) list.splice(i, 1);
      if (!list.length) this.tiles.delete(k);
    }
    this.refresh(k, false);
  }

  clear(): void {
    for (const k of [...this.visuals.keys()]) this.destroyVisual(k);
    this.items.clear();
    this.tiles.clear();
    this.hideLabel();
  }

  /** Rótulo com o nome do item do topo (px de tela) — null esconde. */
  showLabel(id: string | null, sx = 0, sy = 0): void {
    const v = id ? this.items.get(id) : undefined;
    if (!v) { this.hideLabel(); return; }
    if (this.labelFor !== id) {
      this.labelFor = id!;
      const d = itemDef(v.defId);
      const n = this.tiles.get(tileKey(v.x, v.y))?.length ?? 1;
      const name = `${v.count > 1 ? `${v.count}× ` : ""}${d?.name ?? v.defId}${n > 1 ? `  (+${n - 1})` : ""}`;
      this.label.setText(name).setColor(RARITY_COLOR[asRarity(v.rarity)]);
    }
    this.label.setPosition(Math.round(sx), Math.round(sy)).setVisible(true);
  }

  private hideLabel() { this.labelFor = ""; this.label.setVisible(false); }

  // --- render ---------------------------------------------------------------------------

  private refresh(k: string, pop: boolean): void {
    const ids = this.tiles.get(k);
    if (!ids?.length) { this.destroyVisual(k); return; }
    const top = this.items.get(ids[ids.length - 1]!)!;
    const old = this.visuals.get(k);
    const samePop = old && old.topId === top.id ? old.popAt : -1;
    this.destroyVisual(k);
    this.labelFor = ""; // o hover reescreve o rótulo no próximo quadro (contagem/topo podem ter mudado)
    const rarity = asRarity(top.rarity);
    const vis: TileVisual = { x: top.x, y: top.y, under: [], rarity, topId: top.id, popAt: pop ? this.clock : samePop, t: Math.random() * 1000 };
    this.visuals.set(k, vis);
    const cx = (top.x + 0.5) * TILE_SIZE, cy = (top.y + 0.5) * TILE_SIZE;

    if (rarity !== "common" && rarity !== "uncommon") {
      vis.glow = this.scene.add.image(cx, cy + 1, TEX.glow).setBlendMode(Phaser.BlendModes.ADD).setTint(hex(RARITY_COLOR[rarity]))
        .setAlpha(0.55).setScale(0.5);
      this.worldLayer.add(vis.glow.setDepth(DEPTH - 0.2));
    }
    // Itens de baixo (até 2), deslocados: indicam que há uma pilha.
    const below = ids.slice(Math.max(0, ids.length - 1 - UNDER_MAX), ids.length - 1).reverse();
    below.forEach((uid, i) => {
      const u = this.items.get(uid);
      const d = u && itemDef(u.defId);
      if (!d) return;
      ensureItemIcon(this.scene, d.icon, (ok) => {
        if (!ok || this.visuals.get(k) !== vis) return;
        const img = this.iconImage(d.icon, cx - 2 - i * 2, cy - 1 - i, 0.85).setAlpha(0.75 - i * 0.2).setTint(0xb0b0b0);
        this.worldLayer.add(img.setDepth(DEPTH - 0.1 - i * 0.01));
        vis.under.push(img);
      });
    });
    const d = itemDef(top.defId);
    const place = (spr: Phaser.GameObjects.Image) => {
      vis.spr = spr;
      this.worldLayer.add(spr.setDepth(DEPTH));
      if (top.count > 1) {
        vis.count = this.scene.add.text(0, 0, top.count > 999 ? "999+" : String(top.count), {
          fontFamily: "Verdana, Tahoma, system-ui, sans-serif", fontSize: "9px", fontStyle: "bold",
          color: "#ffffff", stroke: "#101018", strokeThickness: 2,
          resolution: textRes(),
        }).setOrigin(1, 1);
        this.uiLayer.add(vis.count);
      }
      if (rarity === "epic" || rarity === "legendary") {
        vis.sparkle = this.scene.add.image(cx, cy, TEX.glow).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffffff).setScale(0.08).setAlpha(0);
        this.worldLayer.add(vis.sparkle.setDepth(DEPTH + 0.1));
      }
    };
    if (!d) { place(this.scene.add.image(cx, cy, TEX.px).setDisplaySize(6, 6).setTint(hex(RARITY_COLOR[rarity]))); return; }
    ensureItemIcon(this.scene, d.icon, (ok) => {
      if (this.visuals.get(k) !== vis) return;
      if (!ok) { place(this.scene.add.image(cx, cy, TEX.px).setDisplaySize(6, 6).setTint(hex(RARITY_COLOR[rarity]))); return; }
      place(this.iconImage(d.icon, cx, cy, 1));
    });
  }

  private iconImage(icon: NonNullable<ReturnType<typeof itemDef>>["icon"], x: number, y: number, k: number): Phaser.GameObjects.Image {
    const img = this.scene.add.image(x, y, itemIconKey(icon), icon.frame);
    if (icon.tint !== undefined) img.setTint(icon.tint);
    img.setScale((ICON_PX / Math.max(img.width, img.height, 1)) * k);
    img.setData("base", img.scale);
    return img;
  }

  private destroyVisual(k: string): void {
    const v = this.visuals.get(k);
    if (!v) return;
    v.glow?.destroy(); v.spr?.destroy(); v.count?.destroy(); v.sparkle?.destroy();
    for (const u of v.under) u.destroy();
    this.visuals.delete(k);
  }

  /** Por quadro: pop-in, brilho pulsante, cintilar, contagem na câmera de UI e culling. */
  update(dt: number, me: { tx: number; ty: number } | null, toScreen: (wx: number, wy: number) => { x: number; y: number }, zoom: number): void {
    this.clock += dt;
    for (const v of this.visuals.values()) {
      const far = !!me && Math.max(Math.abs(v.x - me.tx), Math.abs(v.y - me.ty)) > CULL_TILES;
      const show = !far;
      v.spr?.setVisible(show); v.glow?.setVisible(show); v.sparkle?.setVisible(show);
      for (const u of v.under) u.setVisible(show);
      v.count?.setVisible(show);
      if (!show) continue;
      v.t += dt;
      const cx = (v.x + 0.5) * TILE_SIZE, cy = (v.y + 0.5) * TILE_SIZE;
      let lift = 0, squash = 1;
      if (v.popAt >= 0 && this.clock - v.popAt < POP_MS) {
        const k = (this.clock - v.popAt) / POP_MS;
        lift = k < 0.6 ? 8 * Math.sin(Math.PI * (k / 0.6)) : 2 * Math.sin(Math.PI * ((k - 0.6) / 0.4));
        squash = k < 0.15 ? 0.6 + k / 0.15 * 0.4 : 1;
      }
      if (v.spr) {
        const base = (v.spr.getData("base") as number) ?? v.spr.scale;
        v.spr.setPosition(cx, Math.round(cy - lift)).setScale(base * squash);
      }
      if (v.glow) {
        const pulse = 0.5 + 0.5 * Math.sin(v.t / 380);
        v.glow.setAlpha((v.rarity === "rare" ? 0.35 : 0.5) + 0.25 * pulse).setScale(0.42 + 0.08 * pulse);
      }
      if (v.sparkle) {
        // Cintilar suave: uma estrelinha a cada ~1,6 s num ponto do ícone.
        const period = v.rarity === "legendary" ? 1200 : 1700;
        const ph = (v.t % period) / period;
        if (ph < 0.25) {
          const k = ph / 0.25;
          const seed = Math.floor(v.t / period);
          const ox = ((seed * 37) % 9) - 4, oy = ((seed * 53) % 7) - 4;
          v.sparkle.setPosition(cx + ox, cy + oy - lift).setAlpha(Math.sin(Math.PI * k) * 0.95).setScale(0.05 + 0.07 * Math.sin(Math.PI * k));
        } else v.sparkle.setAlpha(0);
      }
      if (v.count) {
        const s = toScreen((v.x + 1) * TILE_SIZE - 1, (v.y + 1) * TILE_SIZE - lift);
        v.count.setPosition(Math.round(s.x), Math.round(s.y)).setScale(Math.max(0.8, Math.min(1.4, zoom / 3)));
      }
    }
  }

  destroy(): void {
    this.clear();
    this.label.destroy();
  }
}
