// Acessibilidade: guarda as opções (por navegador) e as aplica no <html> (lidas por a11y.css).
import { createStore } from "../hud/store.ts";
import { A11Y_DEFAULT, a11yAttrs, parseA11y, type A11ySettings } from "./a11yLogic.ts";

const KEY = "lemonquest.a11y";

export const a11yStore = createStore<A11ySettings>(
  (() => { try { return parseA11y(localStorage.getItem(KEY)); } catch { return { ...A11Y_DEFAULT }; } })(),
);

function apply(s: A11ySettings) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(a11yAttrs(s))) root.setAttribute(k, v);
}

apply(a11yStore.get());
a11yStore.subscribe((s) => {
  apply(s);
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* indisponível */ }
});

/** Animações reduzidas (opção do jogador ou do sistema): efeitos do mundo como o tremor da câmera ficam de fora. */
export function reducedMotion(): boolean {
  if (a11yStore.get().motion) return true;
  try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}
