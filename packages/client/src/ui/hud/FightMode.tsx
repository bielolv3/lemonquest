// Modos de batalha (estilo Tibia): postura ofensiva/equilibrada/defensiva + seguir o alvo. Fica no cabeçalho da Batalha.
import { useEffect } from "preact/hooks";
import { C2S, type FightModeMsg, type FightStance } from "@lemonquest/shared";
import { send } from "../items/net.ts";
import { PixelIcon } from "./icons.tsx";
import { createStore, useStore } from "./store.ts";
import { meStore } from "./world.ts";

export const STANCES: { id: FightStance; label: string; tip: string; key: string }[] = [
  { id: "offensive", label: "Ofensivo", tip: "+20% dano causado, +15% dano recebido", key: "F5" },
  { id: "balanced", label: "Equilibrado", tip: "Dano causado e recebido normais", key: "F6" },
  { id: "defensive", label: "Defensivo", tip: "−20% dano causado, −25% dano recebido", key: "F7" },
];

/** Valor otimista enquanto o servidor não confirma (limpo quando o estado chega ou após 1,2 s). */
const pending = createStore<FightModeMsg | null>(null);
let pendingTimer = 0;

export function currentFightMode(): FightModeMsg {
  const me = meStore.get();
  return pending.get() ?? { stance: me?.stance ?? "balanced", chase: me?.chase ?? false };
}

export function setFightMode(patch: Partial<FightModeMsg>): void {
  const next = { ...currentFightMode(), ...patch };
  send(C2S.FightMode, next);
  pending.set(next);
  clearTimeout(pendingTimer);
  pendingTimer = window.setTimeout(() => pending.set(null), 1200);
}
export const toggleChase = (): void => setFightMode({ chase: !currentFightMode().chase });

/** Pequeno bitmap próprio (12x12) para equilíbrio / seguir / parado. */
const BMP = {
  balance: [
    ".....##.....",
    ".....##.....",
    "############",
    ".....##.....",
    "..#..##..#..",
    ".###.##.###.",
    "#...#..#...#",
    "............",
    ".....##.....",
    ".....##.....",
    "...######...",
    "............",
  ],
  chase: [
    "............",
    "............",
    "......#.....",
    ".......#....",
    "..#.....#...",
    "#########.#.",
    "..#.....#...",
    ".......#....",
    "......#.....",
    "............",
    "............",
    "............",
  ],
  stay: [
    "............",
    "...######...",
    "..########..",
    "..###..###..",
    "..##....##..",
    "..##....##..",
    "..###..###..",
    "..########..",
    "...######...",
    "............",
    "............",
    "............",
  ],
} as const;

function Bmp({ name, size = 14 }: { name: keyof typeof BMP; size?: number }) {
  let d = "";
  BMP[name].forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== "#") { x++; continue; }
      let len = 0;
      while (row[x + len] === "#") len++;
      d += `M${x} ${y}h${len}v1h-${len}z`;
      x += len;
    }
  });
  return (
    <svg class="px-icon" width={size} height={size} viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true">
      <path d={d} fill="currentColor" />
    </svg>
  );
}

function StanceIcon({ id }: { id: FightStance }) {
  if (id === "offensive") return <PixelIcon name="swords" size={14} />;
  if (id === "defensive") return <PixelIcon name="shield" size={14} />;
  return <Bmp name="balance" />;
}

export function FightModeControls() {
  const me = useStore(meStore);
  const p = useStore(pending);
  // O estado real chegou (ou mudou): descarta o valor otimista.
  useEffect(() => {
    if (p && me && me.stance === p.stance && me.chase === p.chase) pending.set(null);
  }, [me?.stance, me?.chase, p]);
  const stance = p?.stance ?? me?.stance ?? "balanced";
  const chase = p?.chase ?? me?.chase ?? false;
  return (
    <div class="fight-modes" role="group" aria-label="Modo de batalha">
      {STANCES.map((s) => (
        <button
          key={s.id}
          class={`fm-btn stance-${s.id}${stance === s.id ? " active" : ""}`}
          onClick={() => setFightMode({ stance: s.id })}
          data-tip={s.label}
          data-tip-sub={`${s.tip} · ${s.key}`}
          aria-pressed={stance === s.id}
        >
          <StanceIcon id={s.id} />
        </button>
      ))}
      <span class="fm-sep" />
      <button
        class={`fm-btn chase${chase ? " active" : ""}`}
        onClick={toggleChase}
        data-tip={chase ? "Seguir" : "Parado"}
        data-tip-sub={chase ? "Seguir: persegue o alvo automaticamente · F8" : "Parado: não sai do lugar ao atacar · F8"}
        aria-pressed={chase}
      >
        <Bmp name={chase ? "chase" : "stay"} />
      </button>
    </div>
  );
}
