// Edição dos atalhos no painel (puro, sem DOM: testável). As regras de validade são as do servidor (shared/hotkeys.ts).
import {
  HOTKEY_MAX, SHIFT_PREFIX, isHotkeyKey, nextFreeKey, reservedFor, spellsFor,
  type Hotkey, type Vocation,
} from "@lemonquest/shared";

export { nextFreeKey };

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

/** Troca a magia da linha `i`. Se a magia já está em outra linha, as duas linhas trocam de magia (sem repetir). */
export function setRowSpell(list: readonly Hotkey[], i: number, spellId: string): Hotkey[] {
  const out = list.map((h) => ({ ...h }));
  const row = out[i];
  if (!row) return out;
  const j = out.findIndex((h, k) => k !== i && h.spellId === spellId);
  if (j >= 0) out[j]!.spellId = row.spellId;
  row.spellId = spellId;
  return out;
}

export function removeRow(list: readonly Hotkey[], i: number): Hotkey[] {
  return list.filter((_, k) => k !== i).map((h) => ({ ...h }));
}

/** Nova linha: tecla livre + a primeira magia da vocação que ainda não tem atalho. */
export function addRow(list: readonly Hotkey[], vocation: Vocation): EditResult {
  const out = list.map((h) => ({ ...h }));
  if (out.length >= HOTKEY_MAX) return { list: out, error: true, message: `No máximo ${HOTKEY_MAX} atalhos.` };
  const spell = spellsFor(vocation).find((s) => !out.some((h) => h.spellId === s.id));
  if (!spell) return { list: out, error: true, message: "Todas as suas magias já têm atalho." };
  const key = nextFreeKey(out.map((h) => h.key));
  if (!key) return { list: out };
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
