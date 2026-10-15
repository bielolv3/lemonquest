// Seta-guia (tutorial do novato e marcadores do mapa): ▼ saltitante sobre o destino quando ele está na tela, ou uma seta
// na borda da área de jogo apontando para ele quando está fora. Desenhada na câmera de UI (coordenadas de tela).
import Phaser from "phaser";
import { textRes } from "./textRes.ts";

const COLOR = "#ffd447";
const EDGE = 30;

export interface GuideInput {
  /** Posição do destino em px de tela (câmera de UI). */
  sx: number; sy: number;
  /** Distância em tiles (Chebyshev) e legenda. */
  dist: number;
  label: string;
}

export interface GuideArea { w: number; h: number; right: number; bottom: number }

export class GuideArrow {
  private readonly arrow: Phaser.GameObjects.Text;
  private readonly label: Phaser.GameObjects.Text;
  private t = 0;
  /** Para os testes E2E: o que está sendo mostrado. */
  shown: { onScreen: boolean; label: string; dist: number } | null = null;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
    const style = (size: number): Phaser.Types.GameObjects.Text.TextStyle => ({
      fontFamily: "Verdana, Tahoma, system-ui, sans-serif", fontSize: `${size}px`, fontStyle: "bold",
      color: COLOR, stroke: "#101018", strokeThickness: 4, resolution: textRes(),
    });
    this.arrow = scene.add.text(0, 0, "▼", style(22)).setOrigin(0.5).setVisible(false);
    this.label = scene.add.text(0, 0, "", { ...style(11), align: "center" }).setOrigin(0.5).setVisible(false);
    layer.add([this.arrow, this.label]);
  }

  update(dt: number, input: GuideInput | null, area: GuideArea) {
    if (!input) { this.hide(); return; }
    this.t += dt;
    const bob = Math.round(Math.sin(this.t / 220) * 4);
    const left = EDGE, top = EDGE, right = area.w - area.right - EDGE, bottom = area.h - area.bottom - EDGE;
    const inside = input.sx >= left && input.sx <= right && input.sy >= top + 20 && input.sy <= bottom;
    this.shown = { onScreen: inside, label: input.label, dist: input.dist };
    this.arrow.setVisible(true);
    this.label.setVisible(true);
    this.label.setText(inside ? input.label : `${input.label}\n${input.dist} passos`);
    if (inside) {
      this.arrow.setText("▼").setRotation(0).setPosition(Math.round(input.sx), Math.round(input.sy - 30 + bob));
      this.label.setPosition(Math.round(input.sx), Math.round(input.sy - 56 + bob));
      return;
    }
    // Fora da tela: seta na borda da área livre, na direção do destino.
    const cx = (left + right) / 2, cy = (top + bottom) / 2;
    const dx = input.sx - cx, dy = input.sy - cy;
    const k = Math.min(dx !== 0 ? (right - left) / 2 / Math.abs(dx) : Infinity, dy !== 0 ? (bottom - top) / 2 / Math.abs(dy) : Infinity);
    const px = cx + dx * k, py = cy + dy * k;
    this.arrow.setText("➤").setRotation(Math.atan2(dy, dx)).setPosition(Math.round(px), Math.round(py));
    // Legenda do lado de dentro da seta (nunca para fora da área).
    const lx = Phaser.Math.Clamp(px - Math.sign(dx) * 70, left + 70, right - 70);
    const ly = Phaser.Math.Clamp(py - Math.sign(dy) * 28, top + 20, bottom - 20);
    this.label.setPosition(Math.round(lx), Math.round(ly));
  }

  hide() {
    this.shown = null;
    this.arrow.setVisible(false);
    this.label.setVisible(false);
  }

  destroy() {
    this.arrow.destroy();
    this.label.destroy();
  }
}
