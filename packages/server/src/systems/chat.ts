import type { Client, Room } from "colyseus";
import { MAX_CHAT_LEN, S2C, type ChatMessage, type ChatSendMsg, type NoticeMsg } from "@tibinha/shared";
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

export function clearChatState(sessionId: string): void {
  recent.delete(sessionId);
}

export function handleChat(room: Room, client: Client, from: PlayerState, msg: ChatSendMsg): void {
  if (!msg || typeof msg.text !== "string") return;
  if (msg.channel !== "global") return; // party virá depois
  const text = msg.text.trim().slice(0, MAX_CHAT_LEN).trim();
  if (!text) return;

  if (!checkRate(client.sessionId)) {
    const notice: NoticeMsg = { text: "Calma! Você está falando rápido demais.", kind: "warn" };
    client.send(S2C.Notice, notice);
    return;
  }

  const out: ChatMessage = { from: from.name, text, channel: "global", ts: Date.now() };
  console.log(`[chat] ${out.from}: ${out.text}`);
  room.broadcast(S2C.Chat, out);
}
