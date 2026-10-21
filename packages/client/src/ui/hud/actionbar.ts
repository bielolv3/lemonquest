// Barra de ações = atalhos de magia (ui/hotkeys): um slot por atalho, na ordem do painel. Recebem ativações (tecla do
// atalho ou clique) e disparam cooldowns. Slots são 0-based na API.
import { HOTKEY_MAX } from "@lemonquest/shared";
import { createStore, type Unsubscribe } from "./store.ts";

export const ACTION_SLOTS = HOTKEY_MAX;

export interface SlotAction {
  /** Nome exibido no tooltip. */
  label: string;
  /** URL do ícone (ex.: "/ninja/Ui/Skill Icon/Spell/Heal.png"). */
  icon?: string;
  /** Custo de mana exibido no canto. */
  mana?: number;
  /** Magias: id, palavras mágicas, descrição, level mínimo, cooldown (ms) e chave visual. */
  spellId?: string;
  words?: string;
  desc?: string;
  level?: number;
  cooldownMs?: number;
  fx?: string;
  /** Cor do elemento (CSS) para a borda do slot. */
  color?: string;
  /** Rótulo da tecla do atalho ("1", "⇧F"). */
  keyLabel?: string;
}

/** Quantos slots a barra mostra (= atalhos configurados). */
export const slotCountStore = createStore(0);

export interface Cooldown { start: number; end: number }

export const slotsStore = createStore<(SlotAction | null)[]>(Array(ACTION_SLOTS).fill(null));
export const cooldownStore = createStore<(Cooldown | null)[]>(Array(ACTION_SLOTS).fill(null));
/** Contador por slot que incrementa a cada "flash" (tecla ou clique). */
export const flashStore = createStore<number[]>(Array(ACTION_SLOTS).fill(0));

/** Contador por slot que incrementa a cada "tremida" (falha ao conjurar). */
export const shakeStore = createStore<number[]>(Array(ACTION_SLOTS).fill(0));
export function shakeSlot(slot: number): void {
  if (valid(slot)) shakeStore.set((a) => patch(a, slot, a[slot] + 1));
}
/** Define o cooldown de um slot de forma absoluta (ou null para limpar). */
export function setCooldownAt(slot: number, cd: Cooldown | null): void {
  if (valid(slot)) cooldownStore.set((a) => patch(a, slot, cd));
}

function patch<T>(arr: T[], i: number, v: T): T[] {
  const n = arr.slice(); n[i] = v; return n;
}
const valid = (slot: number) => Number.isInteger(slot) && slot >= 0 && slot < ACTION_SLOTS;

/** Define (ou limpa com null) a ação de um slot. */
export function setSlotAction(slot: number, action: SlotAction | null): void {
  if (valid(slot)) slotsStore.set((a) => patch(a, slot, action));
}

/** Inicia um cooldown de `ms` no slot (overlay radial). ms <= 0 limpa. */
export function setCooldown(slot: number, ms: number): void {
  if (!valid(slot)) return;
  const now = performance.now();
  cooldownStore.set((a) => patch(a, slot, ms > 0 ? { start: now, end: now + ms } : null));
}

export function isOnCooldown(slot: number): boolean {
  const c = cooldownStore.get()[slot];
  return !!c && c.end > performance.now();
}

export function flashSlot(slot: number): void {
  if (valid(slot)) flashStore.set((a) => patch(a, slot, a[slot] + 1));
}

type ActivateHandler = (slot: number) => void;
const handlers = new Set<ActivateHandler>();

/** Assina ativações (tecla do atalho ou clique no slot). */
export function onSlotActivate(fn: ActivateHandler): Unsubscribe {
  handlers.add(fn);
  return () => { handlers.delete(fn); };
}

/** Chamado pela UI quando o jogador ativa um slot. */
export function activateSlot(slot: number): void {
  if (!valid(slot)) return;
  flashSlot(slot);
  for (const h of [...handlers]) h(slot);
}
