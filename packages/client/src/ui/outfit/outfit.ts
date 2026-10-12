// Estado da janela de roupas (tecla O / trilho do HUD / botão direito no próprio personagem) e do menu de contexto.
import { C2S, ADDON_BITS, OUTFITS, type SetOutfitMsg } from "@lemonquest/shared";
import { send } from "../items/net.ts";
import { createStore } from "../hud/store.ts";

export const outfitOpen = createStore(false);

export interface CtxMenuItem { label: string; run: () => void }
/** Menu de contexto simples (posição em px da janela). */
export const ctxMenuStore = createStore<{ x: number; y: number; items: CtxMenuItem[] } | null>(null);

export const openOutfit = (): void => { ctxMenuStore.set(null); outfitOpen.set(true); };
export const closeOutfit = (): void => outfitOpen.set(false);
export const toggleOutfit = (): void => outfitOpen.set((v) => !v);

export function openCtxMenu(x: number, y: number, items: CtxMenuItem[]): void {
  ctxMenuStore.set({ x, y, items });
}
export const closeCtxMenu = (): void => ctxMenuStore.set(null);

/** Envia a troca (o servidor valida; o estado sincronizado traz o resultado para todos). */
export function sendOutfit(outfit: string, addons: number): void {
  if (!OUTFITS[outfit]) return;
  send(C2S.SetOutfit, { outfit, addons: addons & ADDON_BITS } satisfies SetOutfitMsg);
}
