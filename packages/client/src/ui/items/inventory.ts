// Estado do inventário (mochila/equipamento/ouro/depot) alimentado por S2C.Inventory e S2C.Depot + ações (C2S).
import {
  BACKPACK_SIZE, C2S, itemDef,
  type DiscardItemMsg, type EquipSlot, type InventoryMsg, type ItemDef, type ItemInstance, type ItemLocation,
  type MoveItemMsg, type UseItemMsg,
} from "@lemonquest/shared";
import { createStore } from "../hud/store.ts";
import { send } from "./net.ts";

export const inventoryStore = createStore<InventoryMsg | null>(null);
/** Conteúdo do depot (null = nunca recebido). */
export const depotStore = createStore<(ItemInstance | null)[] | null>(null);

export const defOf = (inst: ItemInstance | null | undefined): ItemDef | undefined => (inst ? itemDef(inst.defId) : undefined);

export function itemAt(loc: ItemLocation): ItemInstance | null {
  const inv = inventoryStore.get();
  if (loc.where === "backpack") return inv?.backpack[loc.index] ?? null;
  if (loc.where === "equip") return inv?.equipment[loc.slot] ?? null;
  return depotStore.get()?.[loc.index] ?? null;
}

export function firstEmptyBackpack(): number {
  const bp = inventoryStore.get()?.backpack;
  if (!bp) return -1;
  for (let i = 0; i < BACKPACK_SIZE; i++) if (!bp[i]) return i;
  return -1;
}

/** Soma de uma mesma definição (poções) na mochila. */
export const countInBackpack = (defId: string): number =>
  (inventoryStore.get()?.backpack ?? []).reduce((n, it) => n + (it && it.defId === defId ? it.count : 0), 0);

export function moveItem(from: ItemLocation, to: ItemLocation, count?: number): void {
  const m: MoveItemMsg = count != null ? { from, to, count } : { from, to };
  send(C2S.MoveItem, m);
}
export function useBackpackItem(index: number): void {
  const m: UseItemMsg = { index };
  send(C2S.UseItem, m);
}
export function discardBackpackItem(index: number): void {
  const m: DiscardItemMsg = { index };
  send(C2S.DiscardItem, m);
}

/** Tenta equipar o item da mochila no slot da definição. */
export function equipFromBackpack(index: number): void {
  const def = defOf(itemAt({ where: "backpack", index }));
  if (def?.slot) moveItem({ where: "backpack", index }, { where: "equip", slot: def.slot });
}
export function unequipToBackpack(slot: EquipSlot): void {
  const to = firstEmptyBackpack();
  if (to >= 0) moveItem({ where: "equip", slot }, { where: "backpack", index: to });
}
export function depotToBackpack(index: number): void {
  const to = firstEmptyBackpack();
  if (to >= 0) moveItem({ where: "depot", index }, { where: "backpack", index: to });
}
