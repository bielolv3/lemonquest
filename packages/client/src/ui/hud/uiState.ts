// Estado de janelas/painéis do HUD.
import { createStore, persistedBool } from "./store.ts";

export const NARROW_PX = 1000;
export const SIDEBAR_W = 220;
export const SIDEBAR_GAP = 8;

/** Barra lateral aberta (lembrada); em janelas estreitas começa fechada. */
export const sidebarOpen = persistedBool("sidebar", true, window.innerWidth < NARROW_PX ? false : undefined);

export const skillsOpen = persistedBool("skills", false);
export const helpOpen = createStore(false);
export const soundOpen = createStore(false);
export const autoOpen = createStore(false);

export const toggle = (s: { set(fn: (v: boolean) => boolean): void }) => s.set((v) => !v);
