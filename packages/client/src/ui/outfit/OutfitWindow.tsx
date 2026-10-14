// Janela de roupas estilo Tibia: prévia animada grande, grade de roupas, 2 addons, OK/Cancelar.
import { useEffect, useState } from "preact/hooks";
import { OUTFIT_LIST, resolveOutfit, unlockRequirement, type Facing } from "@lemonquest/shared";
import { useStore } from "../hud/store.ts";
import { meStore } from "../hud/world.ts";
import { OutfitCanvas } from "./OutfitCanvas.tsx";
import { PixelIcon } from "../hud/icons.tsx";
import { achievementsStore, outfitUnlockedFor } from "../achievements/achievements.ts";
import "../achievements/achievements.css";
import { closeOutfit, outfitOpen, sendOutfit } from "./outfit.ts";
import "./outfit.css";

const FACINGS: Facing[] = ["down", "left", "up", "right"];
const FACING_LABEL: Record<Facing, string> = { down: "frente", left: "esquerda", up: "costas", right: "direita" };
/** ms por frame da caminhada na prévia. */
const WALK_MS = 150;
/** Gira sozinho a cada N ms (até o jogador usar as setas). */
const ROTATE_MS = 2400;

export function OutfitWindow() {
  const open = useStore(outfitOpen);
  if (!open) return null;
  return <OutfitDialog />;
}

function OutfitDialog() {
  const me = useStore(meStore);
  const current = resolveOutfit(me?.outfit, me?.vocation ?? "knight");
  const [sel, setSel] = useState(current.id);
  const [addons, setAddons] = useState(me?.outfit === current.id ? me?.addons ?? 0 : 0);
  const [face, setFace] = useState(0);
  const [auto, setAuto] = useState(true);
  const [row, setRow] = useState(0);
  const [walk, setWalk] = useState(true);
  const outfit = resolveOutfit(sel, me?.vocation ?? "knight");
  const ach = useStore(achievementsStore);
  // Liberado = conquista/roupa padrão/o que já veste. Sem o estado do servidor ainda, só o que veste.
  const voc = me?.vocation ?? "knight";
  const open = (id: string, bit: 0 | 1 | 2) => outfitUnlockedFor(ach, voc, current.id, me?.addons ?? 0, id, bit);
  const outfitOk = open(outfit.id, 0);
  const addonOk = (bit: 1 | 2) => outfitOk && open(outfit.id, bit);
  const effAddons = addons & ((addonOk(1) ? 1 : 0) | (addonOk(2) ? 2 : 0));
  const lockedMsg = !outfitOk ? unlockRequirement(outfit.id, 0)
    : ([1, 2] as const).filter((b) => (addons & b) && !addonOk(b)).map((b) => unlockRequirement(outfit.id, b))[0];

  useEffect(() => {
    const t = window.setInterval(() => setRow((r) => (r + 1) % 4), WALK_MS);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (!auto) return;
    const t = window.setInterval(() => setFace((f) => (f + 1) % 4), ROTATE_MS);
    return () => window.clearInterval(t);
  }, [auto]);

  const rotate = (d: number) => { setAuto(false); setFace((f) => (f + d + 4) % 4); };
  const ok = () => { if (!outfitOk) return; sendOutfit(outfit.id, effAddons); closeOutfit(); };

  // Esc fecha; Enter confirma; setas giram (sem roubar teclas do jogo quando fechada).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); closeOutfit(); }
      else if (e.key === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); ok(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopImmediatePropagation(); rotate(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); e.stopImmediatePropagation(); rotate(1); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const facing = FACINGS[face];
  const toggleAddon = (bit: number) => setAddons((a) => a ^ bit);

  return (
    <div class="outfit-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) closeOutfit(); }}>
      <div class="hud-card hud-window outfit-win" role="dialog" aria-label="Roupas">
        <div class="win-title">
          <span class="win-grip" aria-hidden="true" />
          <span>Roupas</span>
          <button class="win-close" onClick={closeOutfit} data-tip="Fechar" data-tip-sub="O ou Esc">×</button>
        </div>
        <div class="outfit-body">
          <div class="outfit-stage">
            <div class="outfit-preview" onClick={() => setWalk((w) => !w)} data-tip={walk ? "Parar" : "Andar"}>
              <OutfitCanvas outfit={outfit} addons={effAddons} facing={facing} row={walk ? row : 0} scale={6} />
            </div>
            <div class="outfit-rotate">
              <button class="outfit-arrow" onClick={() => rotate(-1)} aria-label="Girar para a esquerda" data-tip="Girar" data-tip-sub="Seta ←"><span class="outfit-tri left" aria-hidden="true" /></button>
              <span class="outfit-facing">{FACING_LABEL[facing]}</span>
              <button class="outfit-arrow" onClick={() => rotate(1)} aria-label="Girar para a direita" data-tip="Girar" data-tip-sub="Seta →"><span class="outfit-tri" aria-hidden="true" /></button>
            </div>
            <div class="outfit-name">{outfit.name}</div>
            <div class="outfit-addons">
              {outfit.addons.map((a, i) => {
                const bit = 1 << i;
                const okA = addonOk((bit as 1 | 2));
                return (
                  <label
                    key={a.id}
                    class={`outfit-addon${effAddons & bit ? " on" : ""}${okA ? "" : " locked"}`}
                    data-tip={okA ? undefined : a.name}
                    data-tip-sub={okA ? undefined : unlockRequirement(outfit.id, bit as 1 | 2)}
                  >
                    <input type="checkbox" checked={(effAddons & bit) !== 0} disabled={!okA} onChange={() => toggleAddon(bit)} />
                    <span class="outfit-check" aria-hidden="true" />
                    <span class="outfit-addon-name"><small>Addon {i + 1}</small>{a.name}</span>
                    {!okA && <span class="outfit-lock" style={{ position: "static", marginLeft: "auto" }}><PixelIcon name="lock" size={14} /></span>}
                  </label>
                );
              })}
            </div>
          </div>
          <ul class="outfit-grid" role="listbox" aria-label="Roupas disponíveis">
            {OUTFIT_LIST.map((o) => {
              const locked = !open(o.id, 0);
              return (
              <li key={o.id}>
                <button
                  class={`outfit-cell${o.id === outfit.id ? " sel" : ""}${o.id === current.id ? " cur" : ""}${locked ? " locked" : ""}`}
                  role="option"
                  aria-selected={o.id === outfit.id}
                  onClick={() => { if (o.id !== sel) { setSel(o.id); setAddons(o.id === current.id ? me?.addons ?? 0 : addons); } }}
                  onDblClick={() => { if (!locked) { sendOutfit(o.id, o.id === outfit.id ? effAddons : 0); closeOutfit(); } }}
                  data-tip={o.name}
                  data-tip-sub={locked ? unlockRequirement(o.id, 0) : o.id === current.id ? "Roupa atual" : "Clique para ver · duplo clique veste"}
                  data-locked={locked ? "true" : undefined}
                >
                  <OutfitCanvas outfit={o} addons={o.id === outfit.id ? effAddons : 0} scale={2} tight />
                  <span>{o.name}</span>
                  {locked && <span class="outfit-lock" aria-label="Bloqueada"><PixelIcon name="lock" size={12} /></span>}
                </button>
              </li>
              );
            })}
          </ul>
        </div>
        <div class="outfit-foot">
          <span class={`outfit-hint${lockedMsg ? " outfit-req" : ""}`}>{lockedMsg ?? "Conquistas (J) desbloqueiam novas roupas e addons."}</span>
          <button class="outfit-btn" onClick={closeOutfit}>Cancelar</button>
          <button class="outfit-btn primary" onClick={ok} disabled={!outfitOk}>OK</button>
        </div>
      </div>
    </div>
  );
}
