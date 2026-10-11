// Barra de HP/mana/XP com transição suave e "fantasma" de dano (segmento claro que encolhe com atraso).
import { useEffect, useRef, useState } from "preact/hooks";

export type BarKind = "hp" | "mana" | "xp";

const GHOST_DELAY_MS = 380;

const pctOf = (v: number, max: number) => (max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0);

interface Props {
  kind: BarKind;
  value: number;
  max: number;
  /** Rótulo à esquerda dentro da barra (ex.: "HP"). */
  label?: string;
  /** Texto à direita dentro da barra; padrão "valor/máx". */
  text?: string;
  /** Barra fina, sem textos internos. */
  thin?: boolean;
  tip?: string;
  tipSub?: string;
}

export function StatBar({ kind, value, max, label, text, thin, tip, tipSub }: Props) {
  const pct = pctOf(value, max);
  const prev = useRef(pct);
  const [ghost, setGhost] = useState(pct);
  const [hit, setHit] = useState(0); // incrementa a cada perda → reinicia a animação de "pancada"

  useEffect(() => {
    const before = prev.current;
    prev.current = pct;
    if (pct < before - 0.01) {
      setHit((h) => h + 1);
      const t = setTimeout(() => setGhost(pct), GHOST_DELAY_MS);
      return () => clearTimeout(t);
    }
    setGhost(pct);
  }, [pct]);

  const low = kind === "hp" && pct < 30;
  return (
    <div
      class={`stat-bar ${kind}${thin ? " thin" : ""}${low ? " low" : ""}`}
      data-tip={tip}
      data-tip-sub={tipSub}
    >
      <div class="stat-track">
        <div class="stat-ghost" style={{ width: `${Math.max(ghost, pct)}%` }} />
        <div class="stat-fill" style={{ width: `${pct}%` }} />
        {hit > 0 && <div key={hit} class="stat-hit" />}
      </div>
      {!thin && (
        <div class="stat-text">
          {label && <span class="stat-label">{label}</span>}
          <span class="stat-num">{text ?? `${Math.max(0, Math.round(value))}/${max}`}</span>
        </div>
      )}
    </div>
  );
}
