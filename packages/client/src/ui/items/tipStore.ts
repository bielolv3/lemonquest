// Item sob o mouse (para o balão de detalhes).
import type { ItemInstance, ItemLocation } from "@lemonquest/shared";
import { createStore } from "../hud/store.ts";

export interface ItemTip {
  inst: ItemInstance;
  /** Onde o item está (undefined = vitrine da loja). Itens equipados não são comparados consigo mesmos. */
  loc?: ItemLocation;
  rect: { left: number; right: number; top: number; bottom: number };
  /** Aberto pelo "olhar" (item do chão): fica até um clique, Esc ou o tempo (não some ao tirar o mouse). */
  pinned?: boolean;
}
export const itemTipStore = createStore<ItemTip | null>(null);

/** Instância sintética de um item "novo" (loja). */
export const shopInstance = (defId: string): ItemInstance => ({ uid: `shop:${defId}`, defId, count: 1, rarity: "common", bonuses: [] });
