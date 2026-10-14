// Janela de habilidades (tecla K): arrastável pela barra de título, posição lembrada.
import { Dir, stepDuration, type SkillId } from "@lemonquest/shared";
import { useEffect, useRef, useState } from "preact/hooks";
import { StatBar } from "./StatBar.tsx";
import { fmt, xpProgress } from "./StatusPanel.tsx";
import { persistedJson, useStore } from "./store.ts";
import { skillsOpen } from "./uiState.ts";
import { meStore, type PlayerSnap } from "./world.ts";

const W = 248;
const posStore = persistedJson<{ x: number; y: number }>("skillsPos", { x: -1, y: -1 });

export interface SkillValue { level: number; pct: number }
export const SKILL_LABELS: Record<SkillId, string> = { melee: "Corpo a corpo", distance: "Distância", magic: "Magic Level", shield: "Escudo" };
const ORDER: SkillId[] = ["magic", "melee", "distance", "shield"];

function skillValues(me: PlayerSnap): Record<SkillId, SkillValue> {
  return {
    magic: { level: me.magicLevel, pct: me.magicPct },
    melee: { level: me.skillMelee, pct: me.meleePct },
    distance: { level: me.skillDistance, pct: me.distancePct },
    shield: { level: me.skillShield, pct: me.shieldPct },
  };
}

function clampPos(x: number, y: number) {
  return {
    x: Math.max(4, Math.min(window.innerWidth - W - 4, x)),
    y: Math.max(4, Math.min(window.innerHeight - 60, y)),
  };
}

export function SkillsWindow() {
  const open = useStore(skillsOpen);
  const me = useStore(meStore);
  const stored = useStore(posStore);
  const [drag, setDrag] = useState(false);
  const win = useRef<HTMLDivElement>(null);

  const pos = stored.x < 0 ? clampPos(window.innerWidth - 228 - 34 - W - 16, 72) : clampPos(stored.x, stored.y);

  // Arrastar pela barra de título (pointer capture: funciona mesmo saindo da janela).
  const onDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const sx = e.clientX - pos.x, sy = e.clientY - pos.y;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    setDrag(true);
    const move = (ev: PointerEvent) => posStore.set(clampPos(ev.clientX - sx, ev.clientY - sy));
    const up = () => {
      setDrag(false);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  };

  // Mantém na tela ao redimensionar.
  useEffect(() => {
    const onResize = () => { if (posStore.get().x >= 0) posStore.set((p) => clampPos(p.x, p.y)); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!open || !me) return null;
  const xp = xpProgress(me.level, me.xp);
  const tilesPerSec = 1000 / stepDuration(me.level, Dir.E);

  return (
    <div
      ref={win}
      class={`hud-card hud-window skills-win${drag ? " dragging" : ""}`}
      style={{ left: `${pos.x}px`, top: `${pos.y}px`, width: `${W}px` }}
      role="dialog"
      aria-label="Habilidades"
    >
      <div class="win-title" onPointerDown={onDown}>
        <span class="win-grip" aria-hidden="true" />
        <span>Habilidades</span>
        <button class="win-close" onClick={() => skillsOpen.set(false)} data-tip="Fechar" data-tip-sub="K ou Esc">×</button>
      </div>
      <div class="win-body">
        <dl class="kv">
          <Row k="Level" v={fmt(me.level)} strong />
          <Row k="Experiência" v={fmt(me.xp)} />
          <Row k="Para o próximo" v={fmt(xp.left)} />
        </dl>
        <StatBar kind="xp" thin value={xp.into} max={xp.span} tip={`${xp.pct.toFixed(1).replace(".", ",")}% do level ${me.level}`} />
        <div class="kv-sep" />
        <dl class="kv">
          <Row k="Vida" v={`${fmt(me.hp)} / ${fmt(me.maxHp)}`} accent="#e2706b" />
          <Row k="Mana" v={`${fmt(me.mana)} / ${fmt(me.maxMana)}`} accent="#7fa3ec" />
          <Row k="Velocidade" v={`${tilesPerSec.toFixed(1).replace(".", ",")} sqm/s`} />
        </dl>
        <div class="kv-sep" />
        <ul class="skill-list">
          {ORDER.map((id) => {
            const v = skillValues(me)[id];
            const pct = Math.max(0, Math.min(100, v.pct));
            return (
              <li key={id} class="skill-row" data-tip={SKILL_LABELS[id]} data-tip-sub={`${pct.toFixed(0)}% para o ${v.level + 1}`}>
                <div class="skill-top">
                  <span>{SKILL_LABELS[id]}</span>
                  <b>{v.level}</b>
                </div>
                <div class="skill-track"><span style={{ width: `${pct}%` }} /></div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Row({ k, v, strong, accent }: { k: string; v: string; strong?: boolean; accent?: string }) {
  return (
    <div class={`kv-row${strong ? " strong" : ""}`}>
      <dt>{k}</dt>
      <dd style={accent ? { color: accent } : undefined}>{v}</dd>
    </div>
  );
}
