// HUD do jogo: monta todos os painéis e trata os atalhos de teclado da UI.
import { useEffect } from "preact/hooks";
import { isTyping } from "../focus.ts";
import { ActionBar } from "./ActionBar.tsx";
import { activateSlot, ACTION_SLOTS } from "./actionbar.ts";
import { startCastBar } from "./castbar.ts";
import { ConditionsStrip } from "./ConditionsStrip.tsx";
import { LowHpVignette } from "./LowHpVignette.tsx";
import { Sidebar } from "./Sidebar.tsx";
import { SkillsWindow } from "./SkillsWindow.tsx";
import { clearTarget, getTarget } from "./target.ts";
import { Tooltip } from "./Tooltip.tsx";
import "../items/bind.ts";
import { DragLayer } from "../items/DragLayer.tsx";
import { closeTopOverlay, useItemKeys } from "../items/keys.ts";
import { ItemTooltip } from "../items/ItemTooltip.tsx";
import { LootToasts } from "../items/LootToasts.tsx";
import { QuickPotions } from "../items/QuickPotions.tsx";
import { NpcWindow } from "../npc/NpcWindow.tsx";
import { ArenaWindow } from "../arena/ArenaWindow.tsx";
import { ArenaHud } from "../arena/ArenaHud.tsx";
import { TrainingWindow } from "../training/TrainingWindow.tsx";
import { helpOpen, skillsOpen, toggle } from "./uiState.ts";
import { OutfitWindow } from "../outfit/OutfitWindow.tsx";
import { ContextMenu } from "../outfit/ContextMenu.tsx";
import { toggleOutfit } from "../outfit/outfit.ts";
import "./world.ts";
import "./hud.css";

export function Hud() {
  useHudKeys();
  useItemKeys();
  useEffect(() => startCastBar(), []);
  useNoButtonFocus();
  return (
    <>
      <LowHpVignette />
      <ConditionsStrip />
      <ActionBar />
      <QuickPotions />
      <NpcWindow />
      <ArenaWindow />
      <ArenaHud />
      <TrainingWindow />
      <LootToasts />
      <SkillsWindow />
      <OutfitWindow />
      <Sidebar />
      <ContextMenu />
      <Tooltip />
      <ItemTooltip />
      <DragLayer />
    </>
  );
}

function useHudKeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping() || e.ctrlKey || e.altKey || e.metaKey) return;
      // Teclas 1–8 (linha de cima; o numpad é movimento).
      const m = /^Digit([1-9])$/.exec(e.code);
      if (m) {
        const slot = Number(m[1]) - 1;
        if (slot < ACTION_SLOTS) {
          e.preventDefault();
          if (!e.repeat) activateSlot(slot);
        }
        return;
      }
      if (e.repeat) return;
      if (e.code === "KeyK") { e.preventDefault(); toggle(skillsOpen); return; }
      if (e.code === "KeyO") { e.preventDefault(); toggleOutfit(); return; }
      if (e.key === "?" || e.code === "F1") { e.preventDefault(); toggle(helpOpen); return; }
      if (e.key === "Escape") {
        if (closeTopOverlay()) return;
        // Fecha o que estiver aberto, um por vez; por último limpa o alvo.
        if (helpOpen.get()) helpOpen.set(false);
        else if (skillsOpen.get()) skillsOpen.set(false);
        else if (getTarget()) clearTarget();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/**
 * Botões do HUD não roubam o foco: assim Enter continua abrindo o chat (em vez de "clicar" de novo
 * o último botão) e o chat aberto não perde o foco ao clicar no painel.
 */
function useNoButtonFocus() {
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("#ui button")) e.preventDefault();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
}
