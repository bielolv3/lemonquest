// Edição dos atalhos no painel (puro, sem DOM: testável). As regras de validade são as do servidor (shared/hotkeys.ts).
import {
  DEFAULT_KEYS, HOTKEY_CODES, HOTKEY_MAX, SHIFT_PREFIX, isHotkeyKey, reservedFor, spellsFor,
  type Hotkey, type Vocation,
} from "@lemonquest/shared";

export interface EditResult {
  list: Hotkey[];
  /** Mensagem para o jogador (erro ou aviso de troca). */
  message?: string;
  error?: boolean;
}

/** Teclas de modificador sozinhas não contam (o jogador ainda vai apertar a tecla de verdade). */
export const isModifierCode = (code: string) => /^(Shift|Control|Alt|Meta|OS|CapsLock)/.test(code);

/**
 * Põe `key` na linha `i`. Tecla do jogo → erro "Tecla usada por: …"; tecla de outra linha → as duas linhas trocam de
 * tecla (aviso). `label` formata a tecla para a mensagem.
 */
export function assignKey(list: readonly Hotkey[], i: number, key: string, label: (k: string) => string): EditResult {
  const out = list.map((h) => ({ ...h }));
  const row = out[i];
  if (!row) return { list: out };
  const used = reservedFor(key);
  if (used) return { list: out, error: true, message: `Tecla ${label(key)} usada por: ${used}` };
  if (!isHotkeyKey(key)) return { list: out, error: true, message: `A tecla ${label(key)} não pode ser atalho.` };
  if (row.key === key) return { list: out };
  const j = out.findIndex((h, k) => k !== i && h.key === key);
  if (j >= 0) {
    out[j]!.key = row.key;
    row.key = key;
    return { list: out, message: `${label(key)} era de outra magia: as duas trocaram de tecla.` };
  }
  row.key = key;
  return { list: out };
}

export function setRowSpell(list: readonly Hotkey[], i: number, spellId: string): Hotkey[] {
  return list.map((h, k) => (k === i ? { ...h, spellId } : { ...h }));
}

export function removeRow(list: readonly Hotkey[], i: number): Hotkey[] {
  return list.filter((_, k) => k !== i).map((h) => ({ ...h }));
}

/** Próxima tecla livre: 1–0, depois letras livres, depois as mesmas com Shift. */
export function nextFreeKey(list: readonly Hotkey[]): string | null {
  const taken = new Set(list.map((h) => h.key));
  const letters = [...HOTKEY_CODES].filter((c) => c.startsWith("Key"));
  const plain = [...DEFAULT_KEYS, ...letters];
  for (const k of [...plain, ...plain.map((c) => SHIFT_PREFIX + c)]) if (!taken.has(k) && isHotkeyKey(k)) return k;
  return null;
}

/** Nova linha: tecla livre + a primeira magia da vocação que ainda não tem atalho (ou a primeira de todas). */
export function addRow(list: readonly Hotkey[], vocation: Vocation): EditResult {
  const out = list.map((h) => ({ ...h }));
  if (out.length >= HOTKEY_MAX) return { list: out, error: true, message: `No máximo ${HOTKEY_MAX} atalhos.` };
  const key = nextFreeKey(out);
  const spells = spellsFor(vocation);
  const spell = spells.find((s) => !out.some((h) => h.spellId === s.id)) ?? spells[0];
  if (!key || !spell) return { list: out };
  out.push({ key, spellId: spell.id });
  return { list: out };
}

/** Tecla do evento no formato dos atalhos ("Shift+KeyF"); null com Ctrl/Alt/Meta (não são atalhos). */
export function keyFromEvent(e: Pick<KeyboardEvent, "code" | "shiftKey" | "ctrlKey" | "altKey" | "metaKey">): string | null {
  if (e.ctrlKey || e.altKey || e.metaKey || !e.code) return null;
  return (e.shiftKey ? SHIFT_PREFIX : "") + e.code;
}

/** Índice do atalho desta tecla (−1 = nenhum). */
export function hotkeyIndex(list: readonly Hotkey[], key: string | null): number {
  return key ? list.findIndex((h) => h.key === key) : -1;
}

/** Troca as magias de dois atalhos (as teclas ficam). Índices inválidos/iguais devolvem a mesma lista. */
export function swapHotkeySpells(list: readonly Hotkey[], a: number, b: number): Hotkey[] {
  const out = list.map((h) => ({ ...h }));
  if (a === b || !out[a] || !out[b]) return out;
  [out[a].spellId, out[b].spellId] = [out[b].spellId, out[a].spellId];
  return out;
}
