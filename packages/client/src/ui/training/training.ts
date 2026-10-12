// Treino offline: estado da janela de escolha de skill (estátua) e do resumo ao voltar.
import {
  C2S, S2C, type SkillId, type TrainOfflineMsg, type TrainOpenMsg, type TrainingOpenMsg, type TrainingResultMsg,
} from "@lemonquest/shared";
import { session } from "../../session.ts";
import { createStore } from "../hud/store.ts";
import { send } from "../items/net.ts";

export const SKILL_NAMES: Record<SkillId, string> = { melee: "Corpo a corpo", distance: "Distância", magic: "Magic Level", shield: "Escudo" };
export const SKILL_ORDER: SkillId[] = ["melee", "distance", "magic", "shield"];

export const trainingOpenStore = createStore<TrainingOpenMsg | null>(null);
export const trainingResultStore = createStore<TrainingResultMsg | null>(null);

/** Última skill escolhida (a tela de "treinando" depois do fechamento 4101 usa o nome). */
let lastSkill: SkillId | null = null;
export const trainingSkill = (): SkillId | null => lastSkill;

/** Clique numa estátua adjacente: pede ao servidor a escolha (abre quando chegar S2C.TrainingOpen). */
export function openStatue(statueId: string): void {
  send(C2S.TrainOpen, { statueId } satisfies TrainOpenMsg);
}

export function closeTraining(): void { trainingOpenStore.set(null); }

export function startTraining(skill: SkillId): void {
  lastSkill = skill;
  trainingOpenStore.set(null);
  send(C2S.TrainOffline, { skill } satisfies TrainOfflineMsg);
}

/** "3h12", "45 min", "1h". */
export function fmtDuration(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  const h = Math.floor(m / 60), r = m % 60;
  if (h === 0) return `${m} min`;
  return r === 0 ? `${h}h` : `${h}h${String(r).padStart(2, "0")}`;
}

/** Texto do resumo: "Você treinou Magic Level por 3h12: +2 níveis (agora 14)". */
export function resultText(r: TrainingResultMsg): string {
  const name = SKILL_NAMES[r.skill] ?? r.skill;
  if (r.minutes < 1) return `Você voltou cedo demais: ${name} não treinou (menos de 1 minuto).`;
  const gained = r.levelsGained === 0
    ? `${r.pct}% rumo ao próximo nível`
    : `+${r.levelsGained} ${r.levelsGained === 1 ? "nível" : "níveis"} (agora ${r.newLevel})`;
  return `Você treinou ${name} por ${fmtDuration(r.minutes)}: ${gained}`;
}

session.onRoom((room) => {
  trainingOpenStore.set(null);
  room.onMessage(S2C.TrainingOpen, (m: TrainingOpenMsg) => trainingOpenStore.set(m));
  room.onMessage(S2C.TrainingResult, (m: TrainingResultMsg) => trainingResultStore.set(m));
});
