// Rótulo de classe sobre cada baú de quest ("Cavaleiro", "Paladino"… na cor da vocação, ou "Todas"). Fica na câmera
// de UI (zoom 1), reposicionado a cada quadro como os nomes das criaturas.
import Phaser from "phaser";
import { TILE_SIZE, type QuestObjectSpot } from "@lemonquest/shared";
import { chestClass } from "./chestInfo.ts";
import { textRes } from "./textRes.ts";

const FONT = '"Pixelify Sans", Verdana, system-ui, sans-serif';

export class ChestLabels {
  private readonly labels: { spot: QuestObjectSpot; text: Phaser.GameObjects.Text }[] = [];

  constructor(scene: Phaser.Scene, uiLayer: Phaser.GameObjects.Layer, spots: readonly QuestObjectSpot[]) {
    for (const spot of spots) {
      if (spot.kind !== "chest") continue;
      const c = chestClass(spot.id);
      const text = scene.add.text(0, 0, c.label, {
        fontFamily: FONT, fontSize: "11px", fontStyle: "bold", color: c.color, stroke: "#10131c", strokeThickness: 3,
        resolution: textRes(),
      }).setOrigin(0.5, 1);
      uiLayer.add(text);
      this.labels.push({ spot, text });
    }
  }

  /** Centro do topo do tile do baú, em pixels de tela; some fora da tela. */
  placeUi(toScreenX: (wx: number) => number, toScreenY: (wy: number) => number, viewW: number, viewH: number): void {
    for (const { spot, text } of this.labels) {
      const x = Math.round(toScreenX((spot.x + 0.5) * TILE_SIZE)), y = Math.round(toScreenY(spot.y * TILE_SIZE) - 1);
      const on = x > -60 && x < viewW + 60 && y > -20 && y < viewH + 20;
      text.setVisible(on);
      if (on) text.setPosition(x, y);
    }
  }
}
