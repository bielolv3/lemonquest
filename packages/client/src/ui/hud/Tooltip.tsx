// Tooltip global: qualquer elemento com data-tip="..." ganha um balão (fixo, nunca cortado por overflow).
// data-tip-sub="..." adiciona uma segunda linha discreta.
import { useEffect, useRef, useState } from "preact/hooks";

interface Tip { text: string; sub: string; words: string; desc: string; x: number; y: number; below: boolean }

const DELAY_MS = 220;

export function Tooltip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const el = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    let current: HTMLElement | null = null;
    let timer = 0;
    const show = (t: HTMLElement) => {
      const r = t.getBoundingClientRect();
      const below = r.top < 64;
      setTip({
        text: t.dataset.tip ?? "",
        sub: t.dataset.tipSub ?? "",
        words: t.dataset.tipWords ?? "",
        desc: t.dataset.tipDesc ?? "",
        x: r.left + r.width / 2,
        y: below ? r.bottom + 8 : r.top - 8,
        below,
      });
    };
    const over = (e: MouseEvent) => {
      const t = (e.target as HTMLElement | null)?.closest?.("[data-tip]") as HTMLElement | null;
      if (t === current) return;
      current = t;
      clearTimeout(timer);
      if (!t || !t.dataset.tip) { setTip(null); return; }
      timer = window.setTimeout(() => show(t), DELAY_MS);
    };
    const hide = () => { current = null; clearTimeout(timer); setTip(null); };
    document.addEventListener("mouseover", over);
    document.addEventListener("mousedown", hide);
    // Teclas (Esc/O...) podem fechar a janela sob o mouse: o elemento some sem "mouseover".
    document.addEventListener("keydown", hide);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("mouseover", over);
      document.removeEventListener("mousedown", hide);
      document.removeEventListener("keydown", hide);
      window.removeEventListener("blur", hide);
      clearTimeout(timer);
    };
  }, []);

  // Mantém o balão dentro da janela.
  useEffect(() => {
    if (!tip || !el.current) { setPos(null); return; }
    const w = el.current.offsetWidth, h = el.current.offsetHeight;
    const left = Math.max(6, Math.min(window.innerWidth - w - 6, tip.x - w / 2));
    const top = tip.below ? tip.y : tip.y - h;
    setPos({ left, top });
  }, [tip]);

  return (
    <div
      ref={el}
      class={`hud-tooltip${tip && pos ? " show" : ""}`}
      style={pos ? { left: `${pos.left}px`, top: `${pos.top}px` } : { left: "-9999px", top: "0" }}
      role="tooltip"
    >
      {tip?.words ? <b class="hud-tooltip-name">{tip.text}</b> : tip?.text}
      {tip?.words && <span class="hud-tooltip-words">{tip.words}</span>}
      {tip?.desc && <span class="hud-tooltip-desc">{tip.desc}</span>}
      {tip?.sub && <span class="hud-tooltip-sub">{tip.sub}</span>}
    </div>
  );
}
