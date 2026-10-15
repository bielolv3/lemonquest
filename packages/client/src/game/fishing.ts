// Boias de pesca: uma bolinha vermelha que balança no tile de água enquanto o jogador espera o peixe (S2C.FishCast).
import Phaser from "phaser";
import { TILE_SIZE, type FishCastMsg } from "@lemonquest/shared";
import { textRes } from "./textRes.ts";

interface Bobber { text: Phaser.GameObjects.Text; x: number; y: number; end: number }

export class FishBobbers {
  private readonly list = new Map<string, Bobber>();

  constructor(private readonly scene: Phaser.Scene, private readonly layer: Phaser.GameObjects.Layer) {}

  get count(): number { return this.list.size; }

  /** `ms` = 0 (ou menos) recolhe a boia. */
  cast(m: FishCastMsg) {
    this.list.get(m.id)?.text.destroy();
    this.list.delete(m.id);
    if (!(m.ms > 0)) return;
    const text = this.scene.add.text(0, 0, "◉", {
      fontFamily: "Verdana, Tahoma, system-ui, sans-serif", fontSize: "13px", fontStyle: "bold", color: "#ff5a52",
      stroke: "#ffffff", strokeThickness: 2, resolution: textRes(),
    }).setOrigin(0.5);
    this.layer.add(text);
    this.list.set(m.id, { text, x: m.x, y: m.y, end: performance.now() + m.ms });
  }

  /** Posiciona as boias (câmera de UI) e recolhe as vencidas. */
  update(toScreenX: (wx: number) => number, toScreenY: (wy: number) => number, visible = true) {
    const now = performance.now();
    for (const [id, b] of [...this.list]) {
      if (now >= b.end) { b.text.destroy(); this.list.delete(id); continue; }
      const bob = Math.sin(now / 260 + b.x) * 2.5;
      b.text.setVisible(visible).setPosition(Math.round(toScreenX((b.x + 0.5) * TILE_SIZE)), Math.round(toScreenY((b.y + 0.5) * TILE_SIZE) + bob));
    }
  }

  destroy() {
    for (const b of this.list.values()) b.text.destroy();
    this.list.clear();
  }
}
