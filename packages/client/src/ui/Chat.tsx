import { useEffect, useRef, useState } from "preact/hooks";
import { C2S, MAX_CHAT_LEN, S2C, type ChatMessage, type ChatSendMsg, type NoticeMsg } from "@lemonquest/shared";
import { session } from "../session.ts";
import { isTyping } from "./focus.ts";
import { persistedBool, useStore } from "./hud/store.ts";
import { FEED_COLOR, onFeed, type FeedEntry } from "./items/loot.ts";
import { rarityColor } from "./items/itemInfo.ts";

const MAX_LINES = 80;

/** Linha do chat: mensagem normal ou notícia do servidor (S2C.Feed). */
type Line = ChatMessage & { feed?: FeedEntry };
const hhmm = (ts: number) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const collapsedStore = persistedBool("chatCollapsed", false);

export function Chat() {
  const [lines, setLines] = useState<Line[]>([]);
  const collapsed = useStore(collapsedStore);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [unread, setUnread] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;

  useEffect(() => session.onRoom((room) => {
    room.onMessage(S2C.Chat, (m: ChatMessage) => {
      setLines((l) => [...l, m].slice(-MAX_LINES));
      if (collapsedRef.current) setUnread((n) => n + 1);
    });
    // Respostas de comandos de admin (Notice com log): ficam no chat, copiáveis (ex.: código de recuperação).
    room.onMessage(S2C.Notice, (m: NoticeMsg) => {
      if (!m?.log || typeof m.text !== "string") return;
      setLines((l) => [...l, { from: "", text: m.text, channel: "system", ts: Date.now() } as Line].slice(-MAX_LINES));
    });
  }), []);

  useEffect(() => onFeed((f) => {
    setLines((l) => [...l, { from: "Servidor", text: f.text, channel: "system", ts: f.ts, feed: f } as Line].slice(-MAX_LINES));
    if (collapsedRef.current) setUnread((n) => n + 1);
  }), []);

  useEffect(() => { if (!collapsed) setUnread(0); }, [collapsed]);

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [lines, collapsed]);

  // Enter (fora de campos de texto) abre o chat. O input já existe no DOM (só fica recolhido), então o
  // foco é síncrono: as teclas digitadas logo depois do Enter já caem no campo e nada se perde.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.repeat || isTyping()) return;
      e.preventDefault();
      collapsedStore.set(false);
      input.current?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Clicar fora do chat (ex.: no mapa) devolve o teclado ao jogo. O Phaser cancela o mousedown do
  // canvas, então o navegador não tira o foco sozinho. O texto digitado é mantido.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (document.activeElement !== input.current) return;
      if ((e.target as HTMLElement | null)?.closest?.(".chat")) return;
      input.current?.blur();
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, []);

  const close = () => {
    setText("");
    input.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation(); // o jogo não pode receber as teclas digitadas
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const t = text.trim();
      if (t) {
        const msg: ChatSendMsg = { text: t, channel: "global" };
        session.room?.send(C2S.Chat, msg);
      }
      close();
    }
  };

  return (
    <div class={`panel chat${collapsed ? " collapsed" : ""}${typing ? " typing" : ""}`}>
      <div class="chat-head">
        <div class="chat-tabs" role="tablist">
          <button class="chat-tab active" role="tab" aria-selected="true" onClick={() => collapsedStore.set(false)}>
            Geral
            {collapsed && unread > 0 && <span class="chat-unread">{unread > 9 ? "9+" : unread}</span>}
          </button>
          <button class="chat-tab" role="tab" aria-selected="false" aria-disabled="true" data-tip="Grupo" data-tip-sub="Em breve">
            Grupo
          </button>
        </div>
        <span class="chat-hint">{typing ? "Esc fecha" : "Enter para falar"}</span>
        <button
          class="chat-fold"
          onClick={() => collapsedStore.set((c) => !c)}
          data-tip={collapsed ? "Mostrar chat" : "Recolher chat"}
          aria-expanded={!collapsed}
        >
          <span class={`chat-caret${collapsed ? " up" : ""}`} aria-hidden="true" />
        </button>
      </div>
      <div class="chat-log" ref={log}>
        {lines.length === 0 && <div class="chat-empty">Nenhuma mensagem ainda. Diga oi!</div>}
        {lines.map((m, i) => (
          <div key={i} class={`chat-line ${m.channel}${m.from === session.myName ? " mine" : ""}`}>
            <span class="chat-time">{hhmm(m.ts)}</span>
            {m.feed ? (
              <span class="chat-text chat-feed" style={{ color: m.feed.rarity ? rarityColor(m.feed.rarity) : FEED_COLOR[m.feed.kind] }}>
                <b class="chat-from">[Servidor]</b> {m.text}
              </span>
            ) : m.channel === "system" ? (
              <span class="chat-text">{m.text}</span>
            ) : (
              <span class="chat-text"><b class="chat-from">{m.from}</b> {m.text}</span>
            )}
          </div>
        ))}
      </div>
      <div class="chat-input-wrap">
        <input
          ref={input}
          class="chat-input"
          value={text}
          maxLength={MAX_CHAT_LEN}
          tabIndex={-1}
          placeholder="Mensagem para Geral…"
          aria-label="Mensagem do chat"
          onInput={(e) => setText((e.target as HTMLInputElement).value)}
          onKeyDown={onKeyDown}
          onFocus={() => { setTyping(true); collapsedStore.set(false); }}
          onBlur={() => setTyping(false)}
        />
      </div>
    </div>
  );
}
