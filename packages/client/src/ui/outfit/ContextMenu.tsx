// Menu de contexto pequeno (botão direito no mundo). Fecha ao clicar fora, Esc ou ao escolher.
import { useEffect, useRef } from "preact/hooks";
import { useStore } from "../hud/store.ts";
import { closeCtxMenu, ctxMenuStore } from "./outfit.ts";

export function ContextMenu() {
  const m = useStore(ctxMenuStore);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!m) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) closeCtxMenu(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); closeCtxMenu(); } };
    // no próximo tique: o mesmo clique que abriu não fecha
    const t = window.setTimeout(() => window.addEventListener("pointerdown", onDown, true), 0);
    window.addEventListener("keydown", onKey, true);
    return () => { window.clearTimeout(t); window.removeEventListener("pointerdown", onDown, true); window.removeEventListener("keydown", onKey, true); };
  }, [m]);
  if (!m) return null;
  const x = Math.min(m.x, window.innerWidth - 170), y = Math.min(m.y, window.innerHeight - 12 - m.items.length * 28);
  return (
    <div ref={ref} class="hud-card ctx-menu" style={{ left: `${x}px`, top: `${y}px` }} role="menu" onContextMenu={(e) => e.preventDefault()}>
      {m.items.map((it) => (
        <button key={it.label} class="ctx-item" role="menuitem" onClick={() => { closeCtxMenu(); it.run(); }}>{it.label}</button>
      ))}
    </div>
  );
}
