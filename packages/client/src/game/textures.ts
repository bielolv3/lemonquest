// Texturas pequenas geradas em runtime (pixel art, sem arquivos).
import Phaser from "phaser";

export const TEX = {
  px: "fx_px",
  shadow: "fx_shadow",
  marker: "fx_marker",
  hover: "fx_hover",
  beam: "fx_beam",
} as const;

/** Gradiente vertical (opaco embaixo → transparente em cima) para a coluna de luz do level-up. */
export function createBeamTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(TEX.beam)) return;
  const tex = scene.textures.createCanvas(TEX.beam, 8, 64)!;
  const ctx = tex.getContext();
  const g = ctx.createLinearGradient(0, 64, 0, 0);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.6, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 64);
  ctx.globalCompositeOperation = "destination-in";
  const h = ctx.createLinearGradient(0, 0, 8, 0);
  h.addColorStop(0, "rgba(0,0,0,0.25)"); h.addColorStop(0.5, "rgba(0,0,0,1)"); h.addColorStop(1, "rgba(0,0,0,0.25)");
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, 8, 64);
  tex.refresh();
}

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (put: (x: number, y: number, a?: number) => void) => void, rgb = "255,255,255") {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h)!;
  const ctx = tex.getContext();
  draw((x, y, a = 1) => {
    ctx.fillStyle = `rgba(${rgb},${a})`;
    ctx.fillRect(x, y, 1, 1);
  });
  tex.refresh();
}

export function createFxTextures(scene: Phaser.Scene) {
  canvasTexture(scene, TEX.px, 1, 1, (put) => put(0, 0));
  createBeamTexture(scene);

  // Sombra elíptica 12x4 (preta; alpha aplicado no objeto).
  canvasTexture(scene, TEX.shadow, 12, 4, (put) => {
    const rows = [[3, 8], [1, 10], [1, 10], [3, 8]]; // [início, largura]
    rows.forEach(([x0, w], y) => { for (let x = x0; x < x0 + w; x++) put(x, y); });
  }, "0,0,0");

  // Marcador de destino: cantos de um quadrado 16x16.
  canvasTexture(scene, TEX.marker, 16, 16, (put) => {
    for (let i = 0; i < 4; i++) {
      for (const [x, y] of [[i, 0], [0, i], [15 - i, 0], [15, i], [i, 15], [0, 15 - i], [15 - i, 15], [15, 15 - i]]) put(x, y);
    }
  });

  // Hover: contorno 16x16 completo e fraco.
  canvasTexture(scene, TEX.hover, 16, 16, (put) => {
    for (let i = 0; i < 16; i++) { put(i, 0); put(i, 15); put(0, i); put(15, i); }
  });
}
