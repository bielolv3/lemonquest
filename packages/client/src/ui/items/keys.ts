// Atalhos de itens/batalha: Q/E poções, F5–F7 posturas, F8 seguir, I recolhe/expande Equipamento+Mochila, Esc fecha overlays.
import { arenaResultStore, arenaWindowOpen, closeArenaWindow } from "../arena/arena.ts";
import { useEffect } from "preact/hooks";
import { isTyping } from "../focus.ts";
import { setFightMode, STANCES, toggleChase } from "../hud/FightMode.tsx";
import { sectionsStore } from "../hud/Section.tsx";
import { npcStore, closeNpc } from "../npc/npc.ts";
import { closeDialog, dialogStore } from "./dialogs.ts";
import { cancelDrag } from "./dnd.ts";
import { quickPotion } from "./potions.ts";
import { closeCtxMenu, closeOutfit, ctxMenuStore, outfitOpen } from "../outfit/outfit.ts";

/** Fecha o overlay de itens mais "alto" (arrasto, diálogo, janela de NPC). Retorna true se fechou algo. */
export function closeTopOverlay(): boolean {
  if (cancelDrag()) return true;
  if (ctxMenuStore.get()) { closeCtxMenu(); return true; }
  if (outfitOpen.get()) { closeOutfit(); return true; }
  if (dialogStore.get()) { closeDialog(); return true; }
  if (npcStore.get()) { closeNpc(); return true; }
  if (arenaResultStore.get()) { arenaResultStore.set(null); return true; }
  if (arenaWindowOpen.get()) { closeArenaWindow(); return true; }
  return false;
}

export function toggleInventorySections(): void {
  sectionsStore.set((s) => {
    const open = !(s.equipment && s.backpack);
    return { ...s, equipment: open, backpack: open };
  });
}

export function useItemKeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping() || e.ctrlKey || e.altKey || e.metaKey) return;
      if (dialogStore.get()) return;
      const stanceKey = /^F([5-7])$/.exec(e.code);
      if (stanceKey) {
        e.preventDefault();
        if (!e.repeat) setFightMode({ stance: STANCES[Number(stanceKey[1]) - 5].id });
        return;
      }
      if (e.code === "F8") { e.preventDefault(); if (!e.repeat) toggleChase(); return; }
      if (e.repeat) return;
      if (e.code === "KeyQ") quickPotion("hp");
      else if (e.code === "KeyE") quickPotion("mana");
      else if (e.code === "KeyI") toggleInventorySections();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
