import type { Client, Room } from "@colyseus/core";
import { MAX_CHAT_LEN, S2C, type ChatMessage, type ChatSendMsg, type NoticeMsg } from "@lemonquest/shared";

export const UNKNOWN_COMMAND = "Comando desconhecido. Digite /ajuda para ver os comandos.";
import type { PlayerState } from "../state.ts";

const RATE_MAX = 5;
const RATE_WINDOW_MS = 5000;
const recent = new Map<string, number[]>(); // sessionId -> timestamps

/** Retorna true se a mensagem pode passar; registra o uso. */
export function checkRate(sessionId: string, now = Date.now()): boolean {
  const list = (recent.get(sessionId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (list.length >= RATE_MAX) {
    recent.set(sessionId, list);
    return false;
  }
  list.push(now);
  recent.set(sessionId, list);
  return true;
}

/** Remove caracteres de controle/formatação (quebras de linha, RTL override, zero-width, surrogates soltos). */
export const sanitizeText = (s: string): string => s.replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu, "");

export function clearChatState(sessionId: string): void {
  recent.delete(sessionId);
}

export interface ChatHooks {
  /** Palavras mágicas: retorna true se o texto é uma magia (já tratada; não vai para o chat). */
  castWords?: (p: PlayerState, text: string) => boolean;
  /** Comandos (dev): retorna true se tratou. Texto com "/" NUNCA vai para o chat (desconhecido → aviso). */
  command?: (p: PlayerState, text: string) => boolean;
  /** Silenciado por admin: ms restantes (0 = pode falar). Magias e comandos continuam funcionando. */
  muted?: (p: PlayerState) => number;
  /** Canal "party": entrega só aos membros do grupo (false = sem grupo; o gancho já avisou). Ausente = canal recusado. */
  partyChat?: (p: PlayerState, text: string) => boolean;
}

export function handleChat(room: Room, client: Client, from: PlayerState, msg: ChatSendMsg, hooks: ChatHooks = {}): void {
  if (!msg || typeof msg.text !== "string") return;
  if (msg.channel !== "global" && msg.channel !== "party") return;
  if (msg.channel === "party" && !hooks.partyChat) return;
  const text = sanitizeText(msg.text.slice(0, MAX_CHAT_LEN * 4)).trim().slice(0, MAX_CHAT_LEN).trim();
  if (!text) return;
  if (text.startsWith("/")) {
    if (!hooks.command?.(from, text)) client.send(S2C.Notice, { text: UNKNOWN_COMMAND, kind: "warn" } satisfies NoticeMsg);
    return;
  }
  // Magia: as palavras aparecem sobre o conjurador via S2C.SpellCast (cliente), nunca no log do chat.
  if (hooks.castWords?.(from, text)) return;

  const muted = hooks.muted?.(from) ?? 0;
  if (muted > 0) {
    const min = Math.max(1, Math.ceil(muted / 60_000));
    client.send(S2C.Notice, { text: `Você está silenciado (mais ${min} min).`, kind: "warn" } satisfies NoticeMsg);
    return;
  }

  if (!checkRate(client.sessionId)) {
    const notice: NoticeMsg = { text: "Calma! Você está falando rápido demais.", kind: "warn" };
    client.send(S2C.Notice, notice);
    return;
  }

  if (msg.channel === "party") {
    if (hooks.partyChat?.(from, text)) console.log(`[grupo] ${from.name}: ${text}`);
    return;
  }

  const out: ChatMessage = { from: from.name, text, channel: "global", ts: Date.now() };
  console.log(`[chat] ${out.from}: ${out.text}`);
  room.broadcast(S2C.Chat, out);
}
