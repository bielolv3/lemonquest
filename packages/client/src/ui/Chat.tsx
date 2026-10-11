import { useEffect, useRef, useState } from "preact/hooks";
import { C2S, S2C, type ChatMessage, type ChatSendMsg } from "@tibinha/shared";
import { session } from "../session.ts";

const MAX_LINES = 50;
const hhmm = (ts: number) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function Chat() {
  const [lines, setLines] = useState<ChatMessage[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => session.onRoom((room) => {
    room.onMessage(S2C.Chat, (m: ChatMessage) => setLines((l) => [...l, m].slice(-MAX_LINES)));
  }), []);

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [lines, collapsed]);

  // Enter (fora de campos de texto) abre o chat.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || typing) return;
      if (document.activeElement instanceof HTMLInputElement) return;
      e.preventDefault();
      setCollapsed(false);
      setTyping(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [typing]);

  useEffect(() => {
    if (typing) input.current?.focus();
  }, [typing]);

  const close = () => {
    setTyping(false);
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
    <div class={`panel chat${collapsed ? " collapsed" : ""}`}>
      <button class="chat-head" onClick={() => setCollapsed((c) => !c)}>
        Chat {collapsed ? "+" : "-"}
      </button>
      {!collapsed && (
        <>
          <div class="chat-log" ref={log}>
            {lines.map((m, i) => (
              <div key={i} class={`chat-line${m.from === session.myName ? " mine" : ""}`}>
                <span class="chat-time">[{hhmm(m.ts)}]</span> <b class="chat-from">{m.from}:</b> {m.text}
              </div>
            ))}
          </div>
          {typing ? (
            <input
              ref={input}
              class="chat-input"
              value={text}
              maxLength={200}
              placeholder="Mensagem... (Enter envia, Esc fecha)"
              onInput={(e) => setText((e.target as HTMLInputElement).value)}
              onKeyDown={onKeyDown}
              onBlur={() => setTyping(false)}
            />
          ) : (
            <div class="chat-hint">Enter para falar</div>
          )}
        </>
      )}
    </div>
  );
}
