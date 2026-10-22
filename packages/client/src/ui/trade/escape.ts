// Esc da janela de troca: cancela a troca, mas só quando nada está por cima dela. Menu de contexto, arrasto, diálogo de
// quantidade, olhar, ajuda e painel de atalhos fecham primeiro (cada um no seu próprio Esc ou na cadeia do HUD).
import { hotkeysOpen } from "../hotkeys/hotkeys.ts";
import { helpOpen } from "../hud/uiState.ts";
import { dialogStore } from "../items/dialogs.ts";
import { dragStore } from "../items/dnd.ts";
import { itemTipStore } from "../items/tipStore.ts";
import { lookStore } from "../look/look.ts";
import { ctxMenuStore, outfitOpen } from "../outfit/outfit.ts";

/** Alguma sobreposição acima da troca vai tratar este Esc? */
export function overlayAboveTrade(): boolean {
  return !!(ctxMenuStore.get() || dragStore.get() || dialogStore.get() || lookStore.get() || itemTipStore.get()?.pinned
    || helpOpen.get() || hotkeysOpen.get() || outfitOpen.get());
}

/**
 * Este Esc deve cancelar a troca? Não quando há sobreposição por cima nem quando vem de um campo de texto fora da
 * janela (o chat fecha com o próprio Esc).
 */
export function escCancelsTrade(target: EventTarget | null): boolean {
  if (overlayAboveTrade()) return false;
  const t = target as HTMLElement | null;
  if (t && typeof t.closest === "function" && !t.closest(".trade-window")
    && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return false;
  return true;
}
