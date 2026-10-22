import { afterEach, describe, expect, it, vi } from "vitest";

// Sem navegador: a sessão real abre o cliente do Colyseus (location/window); os stores do HUD só leem window ao carregar.
vi.hoisted(() => {
  const g = globalThis as Record<string, unknown>;
  g.window ??= { innerWidth: 1600, innerHeight: 900, addEventListener: () => {}, removeEventListener: () => {} };
});
vi.mock("../../session.ts", () => ({ session: { room: null, onRoom: () => {} } }));
import { helpOpen } from "../hud/uiState.ts";
import { dialogStore } from "../items/dialogs.ts";
import { ctxMenuStore } from "../outfit/outfit.ts";
import { escCancelsTrade, overlayAboveTrade } from "./escape.ts";

/** Elemento falso: só o que escCancelsTrade usa. */
const el = (tagName: string, inTrade: boolean) => ({ tagName, isContentEditable: false, closest: (s: string) => (inTrade && s === ".trade-window" ? {} : null) }) as unknown as EventTarget;

describe("Esc da troca", () => {
  afterEach(() => { ctxMenuStore.set(null); helpOpen.set(false); dialogStore.set(null); });

  it("cancela a troca quando nada está por cima", () => {
    expect(overlayAboveTrade()).toBe(false);
    expect(escCancelsTrade(el("DIV", false))).toBe(true);
    expect(escCancelsTrade(el("INPUT", true))).toBe(true); // campo de ouro da própria troca
    expect(escCancelsTrade(null)).toBe(true);
  });

  it("não cancela com menu de contexto, ajuda ou diálogo por cima", () => {
    ctxMenuStore.set({ x: 0, y: 0, items: [] });
    expect(escCancelsTrade(el("DIV", false))).toBe(false);
    ctxMenuStore.set(null);
    helpOpen.set(true);
    expect(escCancelsTrade(el("DIV", false))).toBe(false);
    helpOpen.set(false);
    dialogStore.set({} as never);
    expect(escCancelsTrade(el("DIV", false))).toBe(false);
  });

  it("não rouba o Esc do chat (campo de texto fora da janela)", () => {
    expect(escCancelsTrade(el("INPUT", false))).toBe(false);
    expect(escCancelsTrade(el("TEXTAREA", false))).toBe(false);
  });
});
