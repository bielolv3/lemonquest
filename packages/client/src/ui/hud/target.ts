// Alvo selecionado no cliente (battle list / clique). O combate (M2) assina este store.
import { createStore, type Unsubscribe } from "./store.ts";

export type TargetKind = "player" | "monster";
export interface Target { id: string; kind: TargetKind }

export const targetStore = createStore<Target | null>(null);

export const getTarget = (): Target | null => targetStore.get();

const same = (a: Target | null, b: Target | null) => a === b || (!!a && !!b && a.id === b.id && a.kind === b.kind);

export function setTarget(t: Target | null): void {
  if (!same(targetStore.get(), t)) targetStore.set(t);
}

/** Seleciona; se já for o alvo atual, desseleciona (comportamento do Tibia). */
export function toggleTarget(t: Target): void {
  setTarget(same(targetStore.get(), t) ? null : t);
}

export const clearTarget = (): void => targetStore.set(null);

export const subscribeTarget = (fn: (t: Target | null) => void): Unsubscribe => targetStore.subscribe(fn);
