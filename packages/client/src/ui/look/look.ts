// "Olhar" (como o Look do Tibia: os dois botões do mouse juntos, ou Shift+clique): cartão com o que está sob o mouse.
// Criaturas/jogadores/NPCs/baús viram linhas de texto (lookStore); item do chão abre o balão de item completo, com os
// bônus que vêm do servidor (C2S.LookGround → S2C.LookItem). Qualquer clique, Esc ou 8 s fecham.
import { S2C, type LookItemMsg } from "@lemonquest/shared";
import { session } from "../../session.ts";
import { createStore } from "../hud/store.ts";
import { itemTipStore } from "../items/tipStore.ts";

export interface LookCard {
  title: string;
  /** Cor do título (CSS). */
  color?: string;
  lines: string[];
  /** Ponto do clique (coordenadas de tela). */
  x: number;
  y: number;
}

export const lookStore = createStore<LookCard | null>(null);

const LOOK_MS = 8000;
let timer = 0;
/** Quando o último olhar abriu: o clique que o abriu também passa pelo "fechar no próximo clique". */
let openedAt = 0;
/** Onde abrir o balão do item quando a resposta do servidor chegar. */
let pendingItem: { groundId: string; x: number; y: number } | null = null;

export function clearLook(): void {
  window.clearTimeout(timer);
  lookStore.set(null);
  pendingItem = null;
  if (itemTipStore.get()?.pinned) itemTipStore.set(null);
}

function armTimer(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(clearLook, LOOK_MS);
}

export function showLook(card: LookCard): void {
  clearLook();
  lookStore.set(card);
  armTimer();
}

/** Item do chão: espera a instância completa do servidor e abre o balão de item preso no ponto do clique. */
export function expectLookItem(groundId: string, x: number, y: number): void {
  clearLook();
  pendingItem = { groundId, x, y };
}

session.onRoom((room) => {
  room.onMessage(S2C.LookItem, (m: LookItemMsg) => {
    if (!pendingItem || pendingItem.groundId !== m.groundId) return;
    const { x, y } = pendingItem;
    pendingItem = null;
    itemTipStore.set({ inst: m.item, rect: { left: x - 4, right: x + 4, top: y - 4, bottom: y + 4 }, pinned: true });
    armTimer();
  });
});

// Fecha no próximo clique (fora do próprio cartão) ou no Esc. Em captura: antes de o clique virar outra ação.
try {
  window.addEventListener("pointerdown", (e) => {
    if (!lookStore.get() && !itemTipStore.get()?.pinned) return;
    if ((e.target as HTMLElement | null)?.closest?.(".look-card")) return;
    // O clique que ABRIU o olhar (segundo botão) chega aqui depois de mostrado: ignora o mesmo instante.
    if (performance.now() - openedAt < 120) return;
    clearLook();
  }, true);
  // O Esc que fecha o olhar para aí (senão a cadeia do HUD também tiraria o alvo).
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !(lookStore.get() || itemTipStore.get()?.pinned)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    clearLook();
  }, true);
} catch { /* sem window */ }

lookStore.subscribe((c) => { if (c) openedAt = performance.now(); });
itemTipStore.subscribe((t) => { if (t?.pinned) openedAt = performance.now(); });
