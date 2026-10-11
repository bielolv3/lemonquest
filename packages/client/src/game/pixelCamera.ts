// Câmera pixel-perfect: zoom inteiro, seguimento suave (lerp independente de FPS), limitada ao mapa.
import Phaser from "phaser";
import { TILE_SIZE } from "@tibinha/shared";

/** Tiles visíveis na vertical que buscamos (~15–19). */
const TARGET_ROWS = 17;
/** Constante de suavização do seguimento (1/s). Maior = mais grudado. */
const FOLLOW_SHARPNESS = 12;

export function zoomFor(viewHeight: number): number {
  return Math.max(1, Math.round(viewHeight / (TILE_SIZE * TARGET_ROWS)));
}

export class PixelCamera {
  zoom = 1;
  /** Centro suavizado (mundo, px). */
  private cx = 0;
  private cy = 0;

  constructor(private readonly cam: Phaser.Cameras.Scene2D.Camera, private mapW: number, private mapH: number) {
    this.fit();
  }

  /** Recalcula o zoom para o tamanho atual da janela. */
  fit() {
    this.zoom = zoomFor(this.cam.height);
    this.cam.setZoom(this.zoom);
  }

  /** Arredonda para o grid de pixels da tela. */
  snap = (v: number) => Math.round(v * this.zoom) / this.zoom;

  jumpTo(x: number, y: number) {
    this.cx = x; this.cy = y;
    this.apply();
  }

  follow(x: number, y: number, dtMs: number) {
    const k = 1 - Math.exp(-FOLLOW_SHARPNESS * dtMs / 1000);
    this.cx += (x - this.cx) * k;
    this.cy += (y - this.cy) * k;
    if (Math.abs(x - this.cx) < 0.01) this.cx = x;
    if (Math.abs(y - this.cy) < 0.01) this.cy = y;
    this.apply();
  }

  /** Mundo → tela (px CSS do canvas). Válido depois de follow/jumpTo neste frame. */
  toScreenX(wx: number) { return (wx - this.cam.scrollX - this.cam.width / 2) * this.zoom + this.cam.width / 2; }
  toScreenY(wy: number) { return (wy - this.cam.scrollY - this.cam.height / 2) * this.zoom + this.cam.height / 2; }

  private apply() {
    const halfW = this.cam.width / 2 / this.zoom, halfH = this.cam.height / 2 / this.zoom;
    const clamp = (c: number, half: number, size: number) =>
      size <= half * 2 ? size / 2 : Phaser.Math.Clamp(c, half, size - half);
    const x = this.snap(clamp(this.cx, halfW, this.mapW));
    const y = this.snap(clamp(this.cy, halfH, this.mapH));
    this.cam.setScroll(x - this.cam.width / 2, y - this.cam.height / 2);
  }
}
