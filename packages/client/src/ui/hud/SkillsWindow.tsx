// Janela de habilidades (tecla K): arrastável pela barra de título (useWindowDrag), posição lembrada.
import { Dir, stepDuration, type SkillId } from "@lemonquest/shared";
import { bindOverlay } from "../overlays.ts";
import { StatBar } from "./StatBar.tsx";
import { fmt, xpProgress } from "./StatusPanel.tsx";
import { useStore } from "./store.ts";
import { skillsOpen } from "./uiState.ts";
import { useDialogFocus } from "./useDialogFocus.ts";
import { clampWindowPos, useWindowDrag } from "./useWindowDrag.ts";
import { meStore, type PlayerSnap } from "./world.ts";

const W = 248;

// Esc pela pilha de sobreposições (registrado no instante em que abre: a última janela aberta fecha primeiro).
bindOverlay("skills", skillsOpen, (v) => v, () => skillsOpen.set(false));

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

/** Posição inicial: à esquerda da barra lateral (chave "skillsPos", a mesma de antes do hook). */
const defaultPos = () => clampWindowPos(window.innerWidth - 228 - 34 - W - 16, 72, W);

export function SkillsWindow() {
  const open = useStore(skillsOpen);
  const me = useStore(meStore);
  const drag = useWindowDrag("skills", defaultPos);
  useDialogFocus(drag.ref, open);

  if (!open || !me) return null;
  const xp = xpProgress(me.level, me.xp);
  const tilesPerSec = 1000 / stepDuration(me.level, Dir.E);

  return (
    <div
      ref={drag.ref}
      class={`hud-card hud-window skills-win${drag.dragging ? " dragging" : ""}`}
      style={{ ...drag.style, width: `${W}px` }}
      role="dialog"
      aria-label="Habilidades"
    >
      <div class="win-title" onPointerDown={drag.onTitleDown}>
        <span class="win-grip" aria-hidden="true" />
        <span>Habilidades</span>
        <button class="win-close" onClick={() => skillsOpen.set(false)} data-tip="Fechar" data-tip-sub="K ou Esc" aria-label="Fechar">×</button>
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
