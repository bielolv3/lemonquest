// Histórico do chat (puro, testável): cada aba guarda as últimas MAX_LINES linhas.
import type { ChatMessage } from "@lemonquest/shared";
import type { FeedEntry } from "./items/loot.ts";

export const MAX_LINES = 80;

/**
 * Linha do chat: mensagem normal ou notícia do servidor (S2C.Feed). `key` = id local crescente (chave estável).
 * `dim` = cópia de um aviso (toast "warn"): esmaecida e sem contar como não lida.
 */
export type Line = ChatMessage & { feed?: FeedEntry; dim?: boolean; key: number };
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

/** Mesmo aviso repetido dentro desta janela não vira outra linha (tecla de poção sem poção, magia sem mana…). */
export const NOTICE_REPEAT_MS = 5000;

/** Avisos guardados no chat; acima disso sai o aviso mais antigo (a conversa não é empurrada para fora). */
export const MAX_NOTICE_LINES = 15;

/** Texto sem os números: "(mais 42 s)" e "(mais 39 s)" contam como o mesmo aviso. */
const noticeKey = (text: string) => text.replace(/\d+/g, "#");

/** Copia um aviso para o chat (linha esmaecida do Geral), sem repetir o mesmo aviso em seguida. */
export function pushNotice(l: readonly Line[], text: string, ts: number): Line[] {
  const key = noticeKey(text);
  for (let i = l.length - 1; i >= 0 && i >= l.length - 5; i--) {
    const x = l[i]!;
    if (x.dim && noticeKey(x.text) === key && ts - x.ts < NOTICE_REPEAT_MS) return l as Line[];
  }
  let out = l;
  let extra = l.filter((x) => x.dim).length + 1 - MAX_NOTICE_LINES;
  if (extra > 0) out = l.filter((x) => !(x.dim && extra-- > 0));
  return pushLine(out, { from: "", text, channel: "system", ts, dim: true });
}
