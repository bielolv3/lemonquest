// Barra de ações (1–8) centralizada na área visível, com overlay radial de cooldown.
import { useEffect, useRef, useState } from "preact/hooks";
import { activateSlot, ACTION_SLOTS, cooldownStore, flashStore, shakeStore, slotsStore, type Cooldown, type SlotAction } from "./actionbar.ts";
import { useStore } from "./store.ts";
import { playersStore, selectMe } from "./world.ts";

export function ActionBar() {
  const slots = useStore(slotsStore);
  const cds = useStore(cooldownStore);
  const flashes = useStore(flashStore);
  const shakes = useStore(shakeStore);
  const me = selectMe(useStore(playersStore));
  const now = useCooldownClock(cds);

  return (
    <div class="action-bar" role="toolbar" aria-label="Barra de ações">
      {Array.from({ length: ACTION_SLOTS }, (_, i) => (
        <ActionSlot key={i} index={i} action={slots[i]} cd={cds[i]} now={now} flash={flashes[i]} shake={shakes[i]} level={me?.level ?? 1} mana={me?.mana ?? 0} />
      ))}
    </div>
  );
}

/** Relógio que só "anda" (rAF) enquanto há algum cooldown ativo. */
function useCooldownClock(cds: (Cooldown | null)[]): number {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!cds.some((c) => c && c.end > performance.now())) return;
    let raf = 0;
    const tick = () => {
      const t = performance.now();
      setNow(t);
      if (cds.some((c) => c && c.end > t)) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cds]);
  return now;
}

interface SlotProps { index: number; action: SlotAction | null; cd: Cooldown | null; now: number; flash: number; shake: number; level: number; mana: number }

const fmtCd = (ms: number) => `${(ms / 1000).toFixed(ms % 1000 ? 1 : 0).replace(".", ",")} s`;

function ActionSlot({ index, action, cd, now, flash, shake, level, mana }: SlotProps) {
  const el = useRef<HTMLButtonElement>(null);
  const first = useRef(true);

  // Reinicia a animação de "pressionado" a cada flash.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const b = el.current;
    if (!b) return;
    b.classList.remove("flash");
    void b.offsetWidth;
    b.classList.add("flash");
  }, [flash]);

  // Tremida quando a magia falha.
  const firstShake = useRef(true);
  useEffect(() => {
    if (firstShake.current) { firstShake.current = false; return; }
    const b = el.current;
    if (!b) return;
    b.classList.remove("shake");
    void b.offsetWidth;
    b.classList.add("shake");
  }, [shake]);

  const active = cd && cd.end > now;
  const remain = active ? cd.end - now : 0;
  const frac = active ? remain / (cd.end - cd.start) : 0;
  const key = String(index + 1);
  const locked = !!action?.level && level < action.level;
  const noMana = !!action && !locked && action.mana != null && mana < action.mana;
  const sub = action?.spellId
    ? [`Mana ${action.mana}`, `Recarga ${fmtCd(action.cooldownMs ?? 0)}`, `Level ${action.level}`].join(" · ")
    : action?.mana ? `${action.mana} de mana` : undefined;

  return (
    <button
      ref={el}
      class={`slot action-slot${action ? " filled" : ""}${active ? " cooling" : ""}${locked ? " locked" : ""}${noMana ? " nomana" : ""}`}
      style={action?.color ? ({ "--el": action.color } as any) : undefined}
      onClick={() => activateSlot(index)}
      onAnimationEnd={(e) => (e.currentTarget as HTMLElement).classList.remove("flash", "shake")}
      data-tip={action ? action.label : `Atalho ${key}`}
      data-tip-sub={action ? sub : "Vazio"}
      data-tip-words={action?.words}
      data-tip-desc={action?.desc ? (locked ? `${action.desc} (Requer level ${action.level})` : action.desc) : undefined}
    >
      <span class="action-key">{key}</span>
      {action?.icon && <img src={action.icon} alt="" draggable={false} />}
      {action && !action.icon && <span class="action-abbr">{action.label.slice(0, 2)}</span>}
      {action?.mana != null && !locked && <span class="action-mana">{action.mana}</span>}
      {locked && (
        <span class="action-lock">
          <svg width="9" height="10" viewBox="0 0 9 10" shape-rendering="crispEdges" aria-hidden="true"><path d="M2 4V3a2.5 2.5 0 0 1 5 0v1h1v6H1V4zm1 0h3V3a1.5 1.5 0 0 0-3 0z" fill="currentColor" fill-rule="evenodd" /></svg>
          Lv {action!.level}
        </span>
      )}
      {active && (
        <>
          <span class="action-cd" style={{ "--cd": `${(frac * 360).toFixed(1)}deg` } as any} />
          <span class="action-cd-num">{remain >= 1000 ? Math.ceil(remain / 1000) : (remain / 1000).toFixed(1).replace(".", ",")}</span>
        </>
      )}
    </button>
  );
}
