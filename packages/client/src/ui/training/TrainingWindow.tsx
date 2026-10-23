// "Treinamento offline": escolha da skill ao clicar numa estátua, e o resumo ao voltar do treino.
import type { SkillId } from "@lemonquest/shared";
import { useStore } from "../hud/store.ts";
import { useWindowDrag } from "../hud/useWindowDrag.ts";
import { meStore, type PlayerSnap } from "../hud/world.ts";
import { bindOverlay } from "../overlays.ts";
import {
  SKILL_NAMES, SKILL_ORDER, closeTraining, resultText, startTraining, trainingOpenStore, trainingResultStore,
} from "./training.ts";
import "./training.css";

// Esc pela pilha de sobreposições: fecha só esta janela (não tira o alvo).
bindOverlay("training", trainingOpenStore, (m) => m != null, closeTraining);

function levelOf(me: PlayerSnap | null | undefined, s: SkillId): { level: number; pct: number } {
  if (!me) return { level: 0, pct: 0 };
  switch (s) {
    case "melee": return { level: me.skillMelee, pct: me.meleePct };
    case "distance": return { level: me.skillDistance, pct: me.distancePct };
    case "magic": return { level: me.magicLevel, pct: me.magicPct };
    default: return { level: me.skillShield, pct: me.shieldPct };
  }
}

export function TrainingWindow() {
  const open = useStore(trainingOpenStore);
  const result = useStore(trainingResultStore);
  const me = useStore(meStore);
  const drag = useWindowDrag("training");

  return (
    <>
      {open && (
        <div ref={drag.ref} class={`hud-card hud-window train-window${drag.dragging ? " dragging" : ""}`} style={drag.style} role="dialog" aria-label="Treinamento offline">
          <div class="win-title" onPointerDown={drag.onTitleDown}>
            <span class="win-grip" />
            <span>Treinamento offline</span>
            <button class="win-close" onClick={closeTraining} data-tip="Fechar" data-tip-sub="Esc" aria-label="Fechar">×</button>
          </div>
          <div class="train-body">
            <p class="train-text">Seu personagem treina enquanto você estiver offline (até 12 h). Ao voltar, recebe o progresso.</p>
            <ul class="train-list">
              {SKILL_ORDER.map((s) => {
                const v = levelOf(me, s);
                const pct = Math.max(0, Math.min(99, v.pct));
                return (
                  <li key={s}>
                    <button class="train-skill" onClick={() => startTraining(s)}>
                      <span class="train-name">{SKILL_NAMES[s]}</span>
                      <span class="train-lvl">nível {v.level} <small>({pct}%)</small></span>
                      <span class="skill-track"><span style={{ width: `${pct}%` }} /></span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p class="train-hint">Ao escolher, você será desconectado.</p>
          </div>
        </div>
      )}
      {result && (
        <div class="hud-card train-result" role="status">
          <div class="train-result-title">Treino offline</div>
          <div>{resultText(result)}</div>
          <button class="btn ghost" onClick={() => trainingResultStore.set(null)}>Ok</button>
        </div>
      )}
    </>
  );
}
