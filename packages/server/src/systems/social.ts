// Social: emotes (/e), sussurro (/w, /r), lista de amigos (/amigo, /amigos) e quem está online (/quem). Tudo chega como
// comando do chat.
import {
  EMOTES, MAX_CHAT_LEN, S2C, emoteByName, partyLevelsOk, type ChatMessage, type EmoteMsg, type NoticeMsg, type Vocation,
} from "@lemonquest/shared";
import { nameKey } from "../persistence/db.ts";
import type { CharacterRecord } from "../persistence/types.ts";
import type { PlayerState } from "../state.ts";
import { sanitizeText } from "./chat.ts";

export const EMOTE_COOLDOWN_MS = 1500;
export const WHISPER_COOLDOWN_MS = 500;
export const MAX_FRIENDS = 30;

export interface SocialHost {
  players(): Iterable<PlayerState>;
  record(id: string): CharacterRecord | undefined;
  send(id: string, type: string, msg: unknown): void;
  /** Nome canônico de um personagem que existe (online ou não), ou undefined. */
  exists(name: string): string | undefined;
  /** Ms de silêncio restantes (0 = pode falar). */
  muted(p: PlayerState): number;
  broadcast(type: string, msg: unknown): void;
  /** Nome da zona do mapa no tile (o mesmo do banner de zona); null = fora de qualquer zona. Ausente = /quem sem zona. */
  zoneAt?(x: number, y: number): string | null;
  /** Personagem ainda no mundo, mas sem ninguém no controle (saiu ou caiu e espera a reconexão). Ausente = nunca. */
  away?(id: string): boolean;
  /** Tile em zona de proteção (quem está na PZ pode ter a zona mostrada a todos no /quem). Ausente = ninguém. */
  inPz?(x: number, y: number): boolean;
  /** Os dois estão no mesmo grupo. Ausente = nunca. */
  sameParty?(a: string, b: string): boolean;
  now?(): number;
}

const VOCATION_LABEL: Record<Vocation, string> = { knight: "Cavaleiro", paladin: "Paladino", sorcerer: "Feiticeiro", druid: "Druida" };

export class SocialSystem {
  private readonly lastEmote = new Map<string, number>();
  private readonly lastWhisper = new Map<string, number>();
  /** Com quem cada um falou por último (para /r). */
  private readonly replyTo = new Map<string, string>();

  constructor(private readonly o: SocialHost) {}

  private now() { return this.o.now?.() ?? Date.now(); }
  private notice(id: string, text: string, kind: NoticeMsg["kind"] = "info", log = false) {
    this.o.send(id, S2C.Notice, { text, kind, log } satisfies NoticeMsg);
  }

  private byName(name: string): PlayerState | undefined {
    const want = nameKey(name);
    for (const q of this.o.players()) if (nameKey(q.name) === want) return q;
    return undefined;
  }

  /** "Qa Ab oi tudo bem" → jogador online "Qa Ab" (o maior nome que abre o texto) + "oi tudo bem". Nomes têm espaço. */
  private splitTarget(p: PlayerState, arg: string): { target: PlayerState; rest: string } | null {
    const key = nameKey(arg);
    let best: PlayerState | undefined;
    for (const q of this.o.players()) {
      if (q.id === p.id) continue;
      const k = nameKey(q.name);
      if ((key === k || key.startsWith(k + " ")) && (!best || k.length > nameKey(best.name).length)) best = q;
    }
    if (!best) return null;
    // `nameKey` pode mudar o tamanho (NFC/minúsculas): corta pelas palavras do nome.
    const words = best.name.trim().split(/\s+/).length;
    return { target: best, rest: arg.trim().split(/\s+/).slice(words).join(" ") };
  }

  /** Trata /e, /w, /r, /amigo e /amigos. Devolve true se o comando era daqui. */
  command(p: PlayerState, text: string): boolean {
    const m = /^\/(\S+)\s*(.*)$/s.exec(text.trim());
    if (!m) return false;
    const cmd = m[1]!.toLowerCase(), arg = m[2]!.trim();
    switch (cmd) {
      case "e": case "emote": this.emote(p, arg); return true;
      case "w": case "sussurrar": case "msg": case "pm": this.whisper(p, arg); return true;
      case "r": case "responder": this.reply(p, arg); return true;
      case "amigo": case "friend": this.toggleFriend(p, arg); return true;
      case "amigos": case "friends": this.listFriends(p); return true;
      case "quem": case "who": this.who(p); return true;
      default: return false;
    }
  }

  // --- emotes ---------------------------------------------------------------------------------------------------

  private emote(p: PlayerState, arg: string) {
    const def = arg ? emoteByName(arg) : undefined;
    if (!def) {
      this.notice(p.id, `Emotes: ${EMOTES.map((e) => e.id).join(", ")}. Use /e <nome>.`, "info", true);
      return;
    }
    const now = this.now();
    if (now - (this.lastEmote.get(p.id) ?? -Infinity) < EMOTE_COOLDOWN_MS) return;
    this.lastEmote.set(p.id, now);
    this.o.broadcast(S2C.Emote, { id: p.id, emote: def.id } satisfies EmoteMsg);
  }

  // --- sussurro -------------------------------------------------------------------------------------------------

  private whisper(p: PlayerState, arg: string) {
    if (!arg) { this.notice(p.id, "Use /w <nome> <mensagem>.", "warn"); return; }
    const sp = this.splitTarget(p, arg);
    if (!sp) {
      const first = arg.split(/\s+/)[0] ?? arg;
      this.notice(p.id, `"${first}" não está online (nomes com espaço: /w Nome Sobrenome mensagem).`, "warn");
      return;
    }
    this.deliver(p, sp.target, sp.rest);
  }

  private reply(p: PlayerState, text: string) {
    const to = this.replyTo.get(p.id);
    const target = to ? [...this.o.players()].find((q) => q.id === to) : undefined;
    if (!target) { this.notice(p.id, "Ninguém para responder (o último contato saiu ou ainda não houve).", "warn"); return; }
    this.deliver(p, target, text);
  }

  private deliver(p: PlayerState, target: PlayerState, raw: string) {
    const text = sanitizeText(raw.slice(0, MAX_CHAT_LEN * 4)).trim().slice(0, MAX_CHAT_LEN).trim();
    if (!text) { this.notice(p.id, "Use /w <nome> <mensagem>.", "warn"); return; }
    const muted = this.o.muted(p);
    if (muted > 0) { this.notice(p.id, `Você está silenciado (mais ${Math.max(1, Math.ceil(muted / 60_000))} min).`, "warn"); return; }
    const now = this.now();
    if (now - (this.lastWhisper.get(p.id) ?? -Infinity) < WHISPER_COOLDOWN_MS) { this.notice(p.id, "Calma! Você está falando rápido demais.", "warn"); return; }
    this.lastWhisper.set(p.id, now);
    const msg: ChatMessage = { from: p.name, to: target.name, text, channel: "whisper", ts: Date.now() };
    this.o.send(p.id, S2C.Chat, msg);
    this.o.send(target.id, S2C.Chat, msg);
    this.replyTo.set(p.id, target.id);
    this.replyTo.set(target.id, p.id);
  }

  // --- quem está online -----------------------------------------------------------------------------------------

  /**
   * /quem: uma linha por jogador online (maior level primeiro): nome · lv · vocação · zona, e "✓ grupo" para quem
   * dividiria XP num grupo com quem perguntou (regra dos 2/3, a mesma do grupo); "(ausente)" para quem está no mundo sem
   * ninguém no controle (saiu em combate ou caiu e espera a reconexão). O cabeçalho é um aviso (toast + chat);
   * as linhas vão só para o chat (linhas de sistema), para não empilhar 10 toasts.
   */
  private who(p: PlayerState) {
    const all = [...this.o.players()].sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
    this.notice(p.id, `Online (${all.length}): veja a lista no chat. ✓ grupo = divide XP com você.`, "info", true);
    const friends = (this.o.record(p.id)?.data.friends ?? []).map(nameKey);
    for (const q of all) {
      const parts = [q.name, `lv ${q.level}`, VOCATION_LABEL[q.vocation] ?? q.vocation];
      // A zona só de você, dos seus amigos, do seu grupo e de quem está em zona de proteção: a zona de todo mundo
      // virava um radar de vítimas para o PvP (decisão do dono, ciclo 9).
      const showZone = q.id === p.id || friends.includes(nameKey(q.name)) || !!this.o.sameParty?.(p.id, q.id) || !!this.o.inPz?.(q.x, q.y);
      if (this.o.zoneAt && showZone) parts.push(this.o.zoneAt(q.x, q.y) ?? "fora das zonas");
      const tag = q.id === p.id ? " (você)" : (this.o.away?.(q.id) ? " (ausente)" : "") + (partyLevelsOk([p.level, q.level]) ? " ✓ grupo" : "");
      this.o.send(p.id, S2C.Chat, { from: "", text: parts.join(" · ") + tag, channel: "system", ts: this.now() } satisfies ChatMessage);
    }
  }

  // --- amigos ---------------------------------------------------------------------------------------------------

  private friendsOf(p: PlayerState): string[] | null {
    const rec = this.o.record(p.id);
    if (!rec) return null;
    return (rec.data.friends ??= []);
  }

  private toggleFriend(p: PlayerState, arg: string) {
    const list = this.friendsOf(p);
    if (!list) return;
    if (!arg) { this.notice(p.id, "Use /amigo <nome> para adicionar ou remover; /amigos mostra a lista.", "warn"); return; }
    const name = this.o.exists(arg);
    if (!name) { this.notice(p.id, `Personagem "${arg}" não encontrado.`, "warn"); return; }
    if (nameKey(name) === nameKey(p.name)) { this.notice(p.id, "Você já é seu melhor amigo.", "warn"); return; }
    const i = list.findIndex((n) => nameKey(n) === nameKey(name));
    if (i >= 0) { list.splice(i, 1); this.notice(p.id, `${name} saiu da sua lista de amigos.`, "info", true); return; }
    if (list.length >= MAX_FRIENDS) { this.notice(p.id, `Lista cheia (máximo ${MAX_FRIENDS}).`, "warn"); return; }
    list.push(name);
    this.notice(p.id, `${name} entrou na sua lista de amigos.`, "good", true);
  }

  private listFriends(p: PlayerState) {
    const list = this.friendsOf(p);
    if (!list) return;
    if (list.length === 0) { this.notice(p.id, "Sua lista de amigos está vazia. Use /amigo <nome>.", "info", true); return; }
    const on = new Set([...this.o.players()].map((q) => nameKey(q.name)));
    this.notice(p.id, `Amigos (${list.length}): ${list.map((n) => `${n} ${on.has(nameKey(n)) ? "●" : "○"}`).join(" · ")}  (● online)`, "info", true);
  }

  /** Quem tem `p` na lista de amigos recebe o aviso; `p` ao entrar vê quais amigos estão online. */
  onJoin(p: PlayerState) {
    this.notifyFriendsOf(p, "entrou no jogo");
    const list = this.o.record(p.id)?.data.friends ?? [];
    if (!list.length) return;
    const on = [...this.o.players()].filter((q) => q.id !== p.id && list.some((n) => nameKey(n) === nameKey(q.name))).map((q) => q.name);
    if (on.length) this.notice(p.id, `Amigos online: ${on.join(", ")}.`, "info");
  }

  onLeave(p: PlayerState) {
    this.notifyFriendsOf(p, "saiu do jogo");
    this.lastEmote.delete(p.id);
    this.lastWhisper.delete(p.id);
    this.replyTo.delete(p.id);
    for (const [k, v] of this.replyTo) if (v === p.id) this.replyTo.delete(k);
  }

  private notifyFriendsOf(p: PlayerState, what: string) {
    for (const q of this.o.players()) {
      if (q.id === p.id) continue;
      if (this.o.record(q.id)?.data.friends?.some((n) => nameKey(n) === nameKey(p.name))) this.notice(q.id, `${p.name} (amigo) ${what}.`, "info");
    }
  }
}
