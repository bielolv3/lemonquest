// Item sob o mouse (para o balão de detalhes).
import type { ItemInstance, ItemLocation } from "@tibinha/shared";
import { createStore } from "../hud/store.ts";

export interface ItemTip {
  inst: ItemInstance;
  /** Onde o item está (undefined = vitrine da loja). Itens equipados não são comparados consigo mesmos. */
  loc?: ItemLocation;
  rect: { left: number; right: number; top: number; bottom: number };
}
export const itemTipStore = createStore<ItemTip | null>(null);

/** Instância sintética de um item "novo" (loja). */
export const shopInstance = (defId: string): ItemInstance => ({ uid: `shop:${defId}`, defId, count: 1, rarity: "common", bonuses: [] });
