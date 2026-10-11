// Áreas da tela cobertas pelo HUD. A câmera (game/pixelCamera.ts) centraliza o jogador na área livre.
// Também publica as CSS vars --hud-right / --hud-bottom em <html>.
// Sem imports de Preact: o jogo (Phaser) importa este módulo.

export interface HudInsets { right: number; bottom: number }
type Listener = (i: HudInsets) => void;

let insets: HudInsets = { right: 0, bottom: 0 };
const listeners = new Set<Listener>();

export const getHudInsets = (): HudInsets => insets;

export function subscribeHudInsets(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function setHudInsets(patch: Partial<HudInsets>): void {
  const next = { ...insets, ...patch };
  if (next.right === insets.right && next.bottom === insets.bottom) return;
  insets = next;
  const s = document.documentElement.style;
  s.setProperty("--hud-right", `${next.right}px`);
  s.setProperty("--hud-bottom", `${next.bottom}px`);
  for (const l of [...listeners]) l(next);
}
