// Cola de atalhos de teclado.
import { useEffect, useRef } from "preact/hooks";
import { helpOpen } from "./uiState.ts";
import { newsOpen } from "../news/news.ts";

const GROUPS: { title: string; rows: { keys: string[]; label: string }[] }[] = [
  {
    title: "Movimento",
    rows: [
      { keys: ["W", "A", "S", "D"], label: "Andar (ou setas)" },
      { keys: ["7", "9", "1", "3"], label: "Diagonais (numpad)" },
      { keys: ["Ctrl", "←↑→↓"], label: "Virar sem andar" },
      { keys: ["Clique"], label: "Andar até o ponto" },
    ],
  },
  {
    title: "Combate",
    rows: [
      { keys: ["1", "–", "8"], label: "Magias da barra (arraste para reordenar)" },
      { keys: ["Q", "E"], label: "Poção de vida / mana" },
      { keys: ["F5", "F6", "F7"], label: "Modo de luta" },
      { keys: ["F8"], label: "Seguir o alvo" },
      { keys: ["F9"], label: "Ataque automático" },
      { keys: ["Esc"], label: "Fechar chat · limpar alvo" },
    ],
  },
  {
    title: "Janelas",
    rows: [
      { keys: ["Enter"], label: "Abrir/enviar chat" },
      { keys: ["/ajuda"], label: "Comandos do chat (grupo…)" },
      { keys: ["M"], label: "Mapa do mundo" },
      { keys: ["K"], label: "Habilidades" },
      { keys: ["L"], label: "Diário de missões" },
      { keys: ["I"], label: "Equipamento e mochila" },
      { keys: ["O"], label: "Roupas e addons" },
      { keys: ["J"], label: "Conquistas" },
      { keys: ["R"], label: "Ranking" },
      { keys: ["B"], label: "Bestiário" },
      { keys: ["F1"], label: "Esta ajuda (ou ?)" },
    ],
  },
];

export function HelpPopover() {
  const el = useRef<HTMLDivElement>(null);

  // Clique fora fecha.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (el.current?.contains(t)) return;
      if ((t as HTMLElement).closest?.(".hud-rail")) return; // o botão "?" alterna sozinho
      helpOpen.set(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div class="hud-card help-pop" ref={el} role="dialog" aria-label="Atalhos de teclado">
      <div class="help-title">Atalhos</div>
      {GROUPS.map((g) => (
        <section key={g.title} class="help-group">
          <div class="help-sub">{g.title}</div>
          <ul class="help-list">
            {g.rows.map((r) => (
              <li key={r.label}>
                <span class="help-keys">
                  {r.keys.map((k, i) => (k === "–" ? <span key={i} class="help-dash">–</span> : <kbd key={i}>{k}</kbd>))}
                </span>
                <span class="help-label">{r.label}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <button class="btn help-news" onClick={() => { helpOpen.set(false); newsOpen.set(true); }}>Novidades</button>
    </div>
  );
}
