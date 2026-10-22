// Poções rápidas (Q = vida, E = mana) e recarga compartilhada: a de quem bebeu vale para qualquer poção (vida 2 s,
// mana 1 s — `use.cooldownMs` do item, HEALTH_POTION_CD_MS / MANA_POTION_CD_MS no shared).
import { C2S, type QuickPotionMsg } from "@lemonquest/shared";
import { pushToast } from "../toasts.ts";
import { createStore } from "../hud/store.ts";
import { defOf, inventoryStore } from "./inventory.ts";
import { send } from "./net.ts";

export type PotionKind = "hp" | "mana";
export const POTION_CD_MS = 1000;

export interface PotionCd { start: number; end: number }
export const potionCdStore = createStore<PotionCd | null>(null);

export function startPotionCooldown(ms = POTION_CD_MS): void {
  const now = performance.now();
  potionCdStore.set({ start: now, end: now + ms });
}
export function potionCooling(): boolean {
  const c = potionCdStore.get();
  return !!c && c.end > performance.now();
}

/** Primeira poção do tipo na mochila (é a que o servidor usa). */
export function firstPotion(kind: PotionKind) {
  const bp = inventoryStore.get()?.backpack ?? [];
  for (const it of bp) {
    const u = it && defOf(it)?.use;
    if (it && u && (kind === "hp" ? u.heal : u.mana)) return it;
  }
  return null;
}

export function quickPotion(kind: PotionKind): void {
  const it = firstPotion(kind);
  if (!it) {
    pushToast({ text: kind === "hp" ? "Você não tem poção de vida." : "Você não tem poção de mana.", kind: "warn" }, 800);
    return;
  }
  if (potionCooling()) return;
  const m: QuickPotionMsg = { kind };
  send(C2S.QuickPotion, m);
  startPotionCooldown(defOf(it)?.use?.cooldownMs ?? POTION_CD_MS);
}
