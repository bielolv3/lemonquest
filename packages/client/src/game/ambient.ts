// Ambiente barato: borboletas esvoaçando perto de pontos de interesse da cidade (flores do herbalista, spawn).
import Phaser from "phaser";
import { TILE_SIZE } from "@lemonquest/shared";

const TEX_BUTTERFLY = "amb_butterfly";
const COLORS = [0xffd447, 0xff8fc2, 0x9fd8ff, 0xffffff, 0xffa24a];

interface Fly { img: Phaser.GameObjects.Image; hx: number; hy: number; r: number; sp: number; ph: number; flap: number }

export class Butterflies {
  private flies: Fly[] = [];

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer, homes: { x: number; y: number }[], perHome = 2) {
    if (!scene.textures.exists(TEX_BUTTERFLY)) {
      const tex = scene.textures.createCanvas(TEX_BUTTERFLY, 5, 4)!;
      const ctx = tex.getContext();
      ctx.fillStyle = "#fff";
      for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1], [3, 0], [4, 0], [3, 1], [4, 1], [1, 2], [3, 2]]) ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = "#3a2a2a";
      ctx.fillRect(2, 0, 1, 3);
      tex.refresh();
    }
    for (const h of homes) {
      for (let i = 0; i < perHome; i++) {
        const img = scene.add.image(0, 0, TEX_BUTTERFLY).setTint(COLORS[(Math.random() * COLORS.length) | 0]);
        layer.add(img.setDepth(1_000_000 - 5));
        this.flies.push({
          img, hx: (h.x + 0.5) * TILE_SIZE, hy: (h.y + 0.5) * TILE_SIZE,
          r: 10 + Math.random() * 14, sp: 0.00045 + Math.random() * 0.0004, ph: Math.random() * 6.28, flap: 0.012 + Math.random() * 0.006,
        });
      }
    }
  }

  update(time: number, cx: number, cy: number) {
    for (const f of this.flies) {
      const near = Math.abs(f.hx - cx) < 320 && Math.abs(f.hy - cy) < 240;
      f.img.setVisible(near);
      if (!near) continue;
      const a = time * f.sp + f.ph;
      const x = f.hx + Math.sin(a * 2.3) * f.r + Math.sin(a * 5.1) * 2;
      const y = f.hy + Math.cos(a * 1.7) * f.r * 0.7 + Math.sin(time * 0.006 + f.ph) * 1.5;
      f.img.setPosition(Math.round(x), Math.round(y));
      f.img.setScale(0.35 + 0.65 * Math.abs(Math.sin(time * f.flap + f.ph)), 1);
    }
  }

  destroy() {
    for (const f of this.flies) f.img.destroy();
    this.flies = [];
  }
}
