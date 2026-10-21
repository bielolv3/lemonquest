// Atalhos de magia do personagem (tecla → magia). Vêm do servidor ao entrar (S2C.Hotkeys); mudanças no painel (H) ou
// arrastando na barra são aplicadas na hora e enviadas (C2S.SetHotkeys). Primeira vez (servidor manda null): migra a
// ordem antiga da barra (navegador) para as teclas 1–8, para ninguém perder a barra que já tinha arrumado.
import {
  C2S, S2C, defaultHotkeys, hotkeysFromOrder, keyLabel, sanitizeHotkeys,
  type Hotkey, type HotkeysMsg, type SetHotkeysMsg, type Vocation,
} from "@lemonquest/shared";
import { session } from "../../session.ts";
import { parseOrder } from "../hud/slotOrder.ts";
import { createStore } from "../hud/store.ts";
import { meStore } from "../hud/world.ts";

export { hotkeyIndex, keyFromEvent, swapHotkeySpells } from "./edit.ts";

/** Atalhos atuais; null = ainda não chegaram do servidor (a barra usa o padrão da vocação). */
export const hotkeysStore = createStore<Hotkey[] | null>(null);
export const hotkeysOpen = createStore(false);
export const toggleHotkeys = () => hotkeysOpen.set((v) => !v);

/** Rótulos reais do teclado do jogador (Chrome/Edge: navigator.keyboard); sem suporte = rótulos do teclado americano. */
export const layoutStore = createStore<ReadonlyMap<string, string> | undefined>(undefined);
try {
  const kb = (navigator as unknown as { keyboard?: { getLayoutMap?: () => Promise<ReadonlyMap<string, string>> } }).keyboard;
  kb?.getLayoutMap?.().then((m) => layoutStore.set(m), () => {});
} catch { /* sem suporte */ }

export const hotkeyLabel = (key: string): string => keyLabel(key, layoutStore.get());

/** Atalhos efetivos: os do servidor, ou o padrão da vocação enquanto não chegam. */
export function effectiveHotkeys(vocation: Vocation | undefined): Hotkey[] {
  return hotkeysStore.get() ?? (vocation ? defaultHotkeys(vocation) : []);
}

let send: (list: Hotkey[]) => void = (list) => { session.room?.send(C2S.SetHotkeys, { list } satisfies SetHotkeysMsg); };
/** Testes/harness: troca o envio ao servidor. */
export function setHotkeysTransport(fn: (list: Hotkey[]) => void): void { send = fn; }

/** Aplica (já limpa pelas mesmas regras do servidor) e envia. */
export function setHotkeys(list: readonly Hotkey[]): void {
  const voc = meStore.get()?.vocation as Vocation | undefined;
  const clean = voc ? sanitizeHotkeys(list, voc) : list.slice();
  hotkeysStore.set(clean);
  send(clean);
}

// --- carga e migração ------------------------------------------------------------------

/** Ordem da barra antiga, gravada no navegador por personagem (antes dos atalhos no servidor). */
const oldOrderKey = () => `lemonquest.actionbar.${(session.myName || "?").normalize("NFC").toLowerCase()}`;
let migrate = false;

function tryMigrate(): void {
  const voc = meStore.get()?.vocation as Vocation | undefined;
  if (!migrate || !voc) return;
  migrate = false;
  let order: (string | null)[] | null = null;
  try { order = parseOrder(localStorage.getItem(oldOrderKey())); } catch { /* sem localStorage */ }
  setHotkeys(hotkeysFromOrder(order, voc));
}

session.onRoom((room) => {
  room.onMessage(S2C.Hotkeys, (m: HotkeysMsg) => {
    if (Array.isArray(m?.list)) { migrate = false; hotkeysStore.set(m.list); return; }
    hotkeysStore.set(null);
    migrate = true;
    tryMigrate();
  });
});
meStore.subscribe(() => tryMigrate());
