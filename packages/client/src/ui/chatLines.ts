// Histórico do chat (puro, testável): cada aba guarda as últimas MAX_LINES linhas.
import type { ChatMessage } from "@lemonquest/shared";
import type { FeedEntry } from "./items/loot.ts";

export const MAX_LINES = 80;

/** Linha do chat: mensagem normal ou notícia do servidor (S2C.Feed). `key` = id local crescente (chave estável). */
export type Line = ChatMessage & { feed?: FeedEntry; key: number };
let nextKey = 0;

/** Aba do chat: "global" (Geral: global + sistema + feed) ou "party" (Grupo: só o canal do grupo). */
export type Tab = "global" | "party";
export const tabOf = (m: Pick<Line, "channel">): Tab => (m.channel === "party" ? "party" : "global");
export const inTab = (m: Line, tab: Tab) => tabOf(m) === tab;

/** Acrescenta a linha; cada aba guarda as últimas MAX_LINES (um grupo falante não apaga o histórico do Geral). */
export function pushLine(l: readonly Line[], m: Omit<Line, "key">): Line[] {
  const out = [...l, { ...m, key: ++nextKey }];
  const tab = tabOf(m);
  let extra = out.filter((x) => tabOf(x) === tab).length - MAX_LINES;
  if (extra <= 0) return out;
  return out.filter((x) => !(extra > 0 && tabOf(x) === tab && extra-- > 0));
}
