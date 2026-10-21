// Atalhos de magia (painel "Atalhos", tecla H): cada linha liga uma tecla a uma magia. Salvos no personagem (servidor).
// A tecla é o KeyboardEvent.code (independe do layout do teclado), com "Shift+" opcional. Ctrl/Alt ficam de fora: o
// navegador usa Ctrl+1–8 para trocar de aba e Alt abre menus.
import { spellDef, spellsFor } from "./data/spells.ts";
import type { Vocation } from "./types.ts";

export interface Hotkey {
  /** KeyboardEvent.code, com prefixo "Shift+" opcional (ex.: "Digit1", "Shift+KeyF", "F2"). */
  key: string;
  spellId: string;
}

/** Máximo de atalhos (= slots da barra de ações). */
export const HOTKEY_MAX = 12;

export const SHIFT_PREFIX = "Shift+";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** Teclas que podem virar atalho (sem o Shift). */
export const HOTKEY_CODES: ReadonlySet<string> = new Set([
  ...Array.from({ length: 10 }, (_, i) => `Digit${i}`),
  ...[...LETTERS].map((c) => `Key${c}`),
  "F2", "F3", "F4", "F10", "F11", "F12",
  "Minus", "Equal", "Backquote", "BracketLeft", "BracketRight", "Semicolon", "Quote", "Comma", "Period", "Slash",
  "Backslash", "IntlBackslash", "IntlRo", "Space",
]);

/**
 * Teclas do próprio jogo (código → para que servem). Não viram atalho nem com Shift: o handler do jogo olha só o
 * `code` (Shift+Q também tomaria a poção).
 */
export const RESERVED_KEYS: Readonly<Record<string, string>> = {
  KeyW: "Andar", KeyA: "Andar", KeyS: "Andar", KeyD: "Andar",
  ArrowUp: "Andar", ArrowDown: "Andar", ArrowLeft: "Andar", ArrowRight: "Andar",
  Enter: "Chat", NumpadEnter: "Chat", Escape: "Fechar janelas / limpar alvo", Tab: "Navegação",
  F1: "Ajuda", F5: "Modo ofensivo", F6: "Modo equilibrado", F7: "Modo defensivo", F8: "Seguir o alvo", F9: "Ataque automático",
  KeyQ: "Poção de vida", KeyE: "Poção de mana", KeyI: "Equipamento e mochila", KeyK: "Habilidades", KeyO: "Roupas",
  KeyL: "Diário de missões", KeyJ: "Conquistas", KeyR: "Ranking", KeyB: "Bestiário", KeyM: "Mapa", KeyH: "Atalhos",
};

const baseCode = (key: string) => (key.startsWith(SHIFT_PREFIX) ? key.slice(SHIFT_PREFIX.length) : key);

/** Para que o jogo usa esta tecla (null = livre). O numpad inteiro é movimento. */
export function reservedFor(key: string): string | null {
  const base = baseCode(key);
  if (base.startsWith("Numpad")) return "Andar (teclado numérico)";
  return RESERVED_KEYS[base] ?? null;
}

/** Tecla aceitável como atalho (formato, lista de teclas e não reservada). */
export function isHotkeyKey(key: unknown): key is string {
  if (typeof key !== "string" || key.length > 24) return false;
  return HOTKEY_CODES.has(baseCode(key)) && !reservedFor(key);
}

/** Rótulos das teclas de símbolo no teclado americano (o cliente troca pelo layout real quando o navegador informa). */
const SYMBOL: Record<string, string> = {
  Minus: "-", Equal: "=", Backquote: "`", BracketLeft: "[", BracketRight: "]", Semicolon: ";", Quote: "'",
  Comma: ",", Period: ".", Slash: "/", Backslash: "\\", IntlBackslash: "\\", IntlRo: "/", Space: "Espaço",
};

/**
 * Rótulo curto da tecla para o slot e o painel ("Shift+Digit1" → "⇧1", "KeyF" → "F"). `layout` = rótulos reais do
 * teclado do jogador por código (navigator.keyboard.getLayoutMap), quando disponível.
 */
export function keyLabel(key: string, layout?: ReadonlyMap<string, string>): string {
  const shift = key.startsWith(SHIFT_PREFIX);
  const base = baseCode(key);
  const real = base !== "Space" ? layout?.get(base) : undefined;
  const txt = /^Digit\d$/.test(base) ? base.slice(5)
    : /^Key[A-Z]$/.test(base) ? base.slice(3)
    : real ? real.toUpperCase() : SYMBOL[base] ?? base;
  return (shift ? "⇧" : "") + txt;
}

/**
 * Lista recebida do cliente → lista válida: até HOTKEY_MAX linhas, tecla válida e sem repetir, magia que a vocação
 * pode usar (pode ser de level ainda não alcançado: a barra mostra bloqueada). Linhas inválidas são descartadas.
 */
export function sanitizeHotkeys(raw: unknown, vocation: Vocation): Hotkey[] {
  if (!Array.isArray(raw)) return [];
  const out: Hotkey[] = [];
  const keys = new Set<string>();
  for (const r of raw.slice(0, HOTKEY_MAX * 2)) {
    if (out.length >= HOTKEY_MAX) break;
    if (!r || typeof r !== "object") continue;
    const { key, spellId } = r as Record<string, unknown>;
    if (!isHotkeyKey(key) || keys.has(key) || typeof spellId !== "string") continue;
    const def = spellDef(spellId);
    if (!def || !def.vocations.includes(vocation)) continue;
    keys.add(key);
    out.push({ key, spellId });
  }
  return out;
}

/** Teclas da barra padrão: 1, 2, ..., 9, 0. */
export const DEFAULT_KEYS: readonly string[] = [...Array.from({ length: 9 }, (_, i) => `Digit${i + 1}`), "Digit0"];

/** Atalhos padrão da vocação: magias em ordem de level nas teclas 1–0. */
export function defaultHotkeys(vocation: Vocation): Hotkey[] {
  return spellsFor(vocation).slice(0, DEFAULT_KEYS.length).map((s, i) => ({ key: DEFAULT_KEYS[i]!, spellId: s.id }));
}

/**
 * Migração da barra antiga (ordem salva no navegador, slot i = tecla i+1): mesmas magias nas mesmas teclas; as
 * magias que não estavam na barra entram nas teclas livres seguintes (até 0).
 */
export function hotkeysFromOrder(order: readonly (string | null)[] | null, vocation: Vocation): Hotkey[] {
  if (!order) return defaultHotkeys(vocation);
  const out: Hotkey[] = [];
  const used = new Set<string>();
  order.slice(0, 8).forEach((id, i) => {
    if (id && !used.has(id) && spellDef(id)?.vocations.includes(vocation)) { out.push({ key: DEFAULT_KEYS[i]!, spellId: id }); used.add(id); }
  });
  const freeKeys = DEFAULT_KEYS.filter((k) => !out.some((h) => h.key === k));
  for (const s of spellsFor(vocation)) {
    if (used.has(s.id) || !freeKeys.length) continue;
    out.push({ key: freeKeys.shift()!, spellId: s.id });
    used.add(s.id);
  }
  return sanitizeHotkeys(out.sort((a, b) => DEFAULT_KEYS.indexOf(a.key) - DEFAULT_KEYS.indexOf(b.key)), vocation);
}
