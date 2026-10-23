// Diálogos modais leves da UI de itens: seletor de quantidade (dividir pilha / largar parte no chão) e
// confirmação simples (largar item raro ou melhor no chão).
import { createStore } from "../hud/store.ts";

export type ItemDialog =
  /** `verb` = texto do botão ("Mover" por padrão). */
  | { kind: "count"; title: string; verb?: string; max: number; initial: number; onConfirm: (n: number) => void }
  /** Pergunta sim/não; `verb` = texto do botão que confirma (vermelho: ação sem volta). */
  | { kind: "confirm"; title: string; text: string; verb: string; onConfirm: () => void };

export const dialogStore = createStore<ItemDialog | null>(null);
export const openDialog = (d: ItemDialog): void => dialogStore.set(d);
export const closeDialog = (): void => dialogStore.set(null);
