// Diálogos modais leves da UI de itens: seletor de quantidade (dividir pilha) e confirmação de descarte.
import { createStore } from "../hud/store.ts";

export type ItemDialog =
  | { kind: "count"; title: string; max: number; initial: number; onConfirm: (n: number) => void }
  | { kind: "discard"; name: string; count: number; onConfirm: () => void };

export const dialogStore = createStore<ItemDialog | null>(null);
export const openDialog = (d: ItemDialog): void => dialogStore.set(d);
export const closeDialog = (): void => dialogStore.set(null);
