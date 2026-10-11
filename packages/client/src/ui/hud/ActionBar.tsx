// Barra de ações (1–6) centralizada na área visível, com overlay radial de cooldown.
import { useEffect, useRef, useState } from "preact/hooks";
import { activateSlot, ACTION_SLOTS, cooldownStore, flashStore, slotsStore, type Cooldown, type SlotAction } from "./actionbar.ts";
import { useStore } from "./store.ts";

export function ActionBar() {
  const slots = useStore(slotsStore);
  const cds = useStore(cooldownStore);
  const flashes = useStore(flashStore);
  const now = useCooldownClock(cds);

  return (
    <div class="action-bar" role="toolbar" aria-label="Barra de ações">
      {Array.from({ length: ACTION_SLOTS }, (_, i) => (
        <ActionSlot key={i} index={i} action={slots[i]} cd={cds[i]} now={now} flash={flashes[i]} />
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

interface SlotProps { index: number; action: SlotAction | null; cd: Cooldown | null; now: number; flash: number }

function ActionSlot({ index, action, cd, now, flash }: SlotProps) {
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

  const active = cd && cd.end > now;
  const remain = active ? cd.end - now : 0;
  const frac = active ? remain / (cd.end - cd.start) : 0;
  const key = String(index + 1);

  return (
    <button
      ref={el}
      class={`slot action-slot${action ? " filled" : ""}${active ? " cooling" : ""}`}
      onClick={() => activateSlot(index)}
      onAnimationEnd={(e) => (e.currentTarget as HTMLElement).classList.remove("flash")}
      data-tip={action ? action.label : `Atalho ${key}`}
      data-tip-sub={action ? (action.mana ? `${action.mana} de mana` : undefined) : "Vazio — magias chegam em breve"}
    >
      <span class="action-key">{key}</span>
      {action?.icon && <img src={action.icon} alt="" draggable={false} />}
      {action && !action.icon && <span class="action-abbr">{action.label.slice(0, 2)}</span>}
      {action?.mana != null && <span class="action-mana">{action.mana}</span>}
      {active && (
        <>
          <span class="action-cd" style={{ "--cd": `${(frac * 360).toFixed(1)}deg` } as any} />
          <span class="action-cd-num">{remain >= 1000 ? Math.ceil(remain / 1000) : (remain / 1000).toFixed(1).replace(".", ",")}</span>
        </>
      )}
    </button>
  );
}
