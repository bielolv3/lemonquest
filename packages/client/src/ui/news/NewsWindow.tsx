// Janela "Novidades": abre sozinha uma vez por versão (para quem já joga) e pelo botão da ajuda (F1).
import { isTyping } from "../focus.ts";
import { LATEST_NEWS_ID, NEWS } from "@lemonquest/shared";
import { useEffect } from "preact/hooks";
import { session } from "../../session.ts";
import { useStore } from "../hud/store.ts";
import { meStore } from "../hud/world.ts";
import { markNewsSeen, newsOpen, seenNews } from "./news.ts";
import { shouldAutoShowNews } from "./newsLogic.ts";
import "./news.css";

export function NewsWindow() {
  const open = useStore(newsOpen);
  const me = useStore(meStore);
  const name = session.myName;

  // Abre sozinha uma vez por versão.
  useEffect(() => {
    if (!me || !name || new URLSearchParams(location.search).has("e2e")) return; // testes E2E não são interrompidos
    if (shouldAutoShowNews({ seen: seenNews(name), level: me.level, xp: me.xp }, LATEST_NEWS_ID)) newsOpen.set(true);
  }, [!!me, name]);

  const close = () => { if (name) markNewsSeen(name); newsOpen.set(false); };
  useEffect(() => {
    if (!open) return;
    // Em captura e parando aí: o Esc fecha só esta janela (não tira o alvo).
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !isTyping()) { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  if (!open) return null;
  return (
    <div class="news-window panel" role="dialog" aria-label="Novidades">
      <div class="news-head"><b>Novidades</b><button class="news-x" onClick={close} aria-label="Fechar">×</button></div>
      <div class="news-body">
        {NEWS.map((n, idx) => (
          <section key={n.id} class={`news-entry${idx === 0 ? " latest" : ""}`}>
            <h3>{n.title} <span class="news-date">{n.date}</span></h3>
            <ul>{n.items.map((i) => <li key={i}>{i}</li>)}</ul>
          </section>
        ))}
      </div>
      <div class="news-foot"><button class="party-btn primary" onClick={close}>Entendi</button></div>
    </div>
  );
}
