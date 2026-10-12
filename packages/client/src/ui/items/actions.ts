// Ação "padrão" de um item (clique direito / duplo clique): usar, equipar, desequipar, vender, guardar.
import { DEPOT_SIZE, type ItemDef, type ItemInstance, type ItemLocation, type NpcOpenMsg } from "@lemonquest/shared";
import { npcStore, sellItem } from "../npc/npc.ts";
import { pushToast } from "../toasts.ts";
import {
  defOf, depotStore, equipFromBackpack, firstEmptyBackpack, moveItem, unequipToBackpack, useBackpackItem,
} from "./inventory.ts";
import { potionCooling, startPotionCooldown } from "./potions.ts";

/** O NPC aberto compra este item? */
export function npcBuys(def: ItemDef | undefined, npc: NpcOpenMsg | undefined): boolean {
  if (!def || !npc?.shop?.buys) return false;
  return def.value > 0 && def.id !== "gold_coin" && npc.shop.buys.includes(def.kind);
}

export function firstEmptyDepot(): number {
  const d = depotStore.get();
  if (!d) return -1;
  for (let i = 0; i < DEPOT_SIZE; i++) if (!d[i]) return i;
  return -1;
}

export function activateItem(loc: ItemLocation, inst: ItemInstance): void {
  const def = defOf(inst);
  if (!def) return;
  if (loc.where === "backpack") {
    const npc = npcStore.get();
    if (npc?.tab === "sell" && npcBuys(def, npc.msg)) { sellItem(npc.msg.npcId, loc.index, 1); return; }
    if (def.use?.chest) { useBackpackItem(loc.index); return; } // baú: abre (sem recarga de poção)
    if (def.use?.food) { useBackpackItem(loc.index); return; } // comida: recarga própria (servidor), não trava as poções
    if (def.use) {
      if (potionCooling()) return;
      useBackpackItem(loc.index);
      startPotionCooldown(def.use.cooldownMs);
      return;
    }
    if (def.slot) { equipFromBackpack(loc.index); return; }
    if (npc?.tab === "depot") {
      const to = firstEmptyDepot();
      if (to >= 0) moveItem(loc, { where: "depot", index: to });
      else pushToast({ text: "Depot cheio", kind: "warn" }, 800);
    }
    return;
  }
  // Equipamento ou depot → mochila.
  if (firstEmptyBackpack() < 0) { pushToast({ text: "Mochila cheia", kind: "warn" }, 800); return; }
  if (loc.where === "equip") unequipToBackpack(loc.slot);
  else moveItem(loc, { where: "backpack", index: firstEmptyBackpack() });
}
