// Cartão do "olhar" (criatura, jogador, NPC, baú): título e linhas, perto do ponto do clique, sempre dentro da tela.
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { useStore } from "../hud/store.ts";
import { lookStore } from "./look.ts";
import "./look.css";

export function LookCardView() {
  const card = useStore(lookStore);
  const el = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!card || !el.current) { setPos(null); return; }
    const w = el.current.offsetWidth, h = el.current.offsetHeight;
    const left = Math.max(6, Math.min(window.innerWidth - w - 6, card.x + 14));
    const top = Math.max(6, Math.min(window.innerHeight - h - 6, card.y - h / 2));
    setPos({ left, top });
  }, [card]);

  if (!card) return null;
  return (
    <div
      ref={el}
      class="hud-card look-card"
      role="dialog"
      aria-label={`Olhar: ${card.title}`}
      style={pos ? { left: `${pos.left}px`, top: `${pos.top}px` } : { left: "-9999px", top: "0" }}
    >
      <div class="look-title" style={card.color ? { color: card.color } : undefined}>{card.title}</div>
      {card.lines.map((l, i) => <div key={i} class="look-line">{l}</div>)}
    </div>
  );
}
