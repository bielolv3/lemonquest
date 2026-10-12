// Cola de atalhos de teclado.
import { useEffect, useRef } from "preact/hooks";
import { helpOpen } from "./uiState.ts";

const ROWS: { keys: string[]; label: string }[] = [
  { keys: ["W", "A", "S", "D"], label: "Andar (ou setas)" },
  { keys: ["7", "9", "1", "3"], label: "Diagonais (numpad)" },
  { keys: ["Ctrl", "←↑→↓"], label: "Virar sem andar" },
  { keys: ["Clique"], label: "Andar até o ponto" },
  { keys: ["Enter"], label: "Abrir/enviar chat" },
  { keys: ["Esc"], label: "Fechar chat · limpar alvo" },
  { keys: ["M"], label: "Mapa do mundo" },
  { keys: ["K"], label: "Habilidades" },
  { keys: ["O"], label: "Roupas e addons" },
  { keys: ["1", "–", "8"], label: "Magias da barra" },
  { keys: ["?"], label: "Esta ajuda" },
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
      <ul class="help-list">
        {ROWS.map((r) => (
          <li key={r.label}>
            <span class="help-keys">
              {r.keys.map((k, i) => (k === "–" ? <span key={i} class="help-dash">–</span> : <kbd key={i}>{k}</kbd>))}
            </span>
            <span class="help-label">{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
