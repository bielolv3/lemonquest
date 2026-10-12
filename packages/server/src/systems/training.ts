// Centro de treinamento: estátuas de treino offline. O jogador escolhe uma skill numa estátua adjacente, o servidor
// salva `offlineTraining` e o desconecta (CLOSE_TRAINING). Ao entrar de novo o progresso é aplicado (ver applyOffline).
import {
  S2C, SKILLS, findTrainingStatues, statueDistance, offlineTrainingMinutes, offlineTrainingTries, skillTriesFor,
  type NoticeMsg, type SkillId, type TrainingStatue, type TrainOfflineMsg, type TrainOpenMsg, type TrainingOpenMsg, type TrainingResultMsg,
} from "@lemonquest/shared";
import type { PlayerState } from "../state.ts";
import type { CharacterData } from "../persistence/types.ts";
import type { SkillSystem } from "./skills.ts";

export type OfflineTraining = NonNullable<CharacterData["offlineTraining"]>;

export type Statue = TrainingStatue;

/** Estátuas de treino do mapa: objetos "training_statue" (prop `statueId`; sem ela usa o nome do objeto). */
export const parseStatues = findTrainingStatues;

export interface TrainingOptions {
  statues: Statue[];
  skills: Pick<SkillSystem, "addTries" | "get">;
  inCombat: (playerId: string, now: number) => boolean;
  send: (sessionId: string, type: string, msg: unknown) => void;
  /** Tile andável e livre (sem NPC/monstro/jogador/portal) — para colocar o jogador ao lado da estátua. */
  isFree: (x: number, y: number, selfId: string) => boolean;
}

export const NOTICE_TRAIN_FAR = "Chegue mais perto de uma estátua de treino.";

export class TrainingSystem {
  constructor(private readonly o: TrainingOptions) {}

  get statues(): readonly Statue[] { return this.o.statues; }

  /** Estátua a até 1 tile (Chebyshev) do jogador; se `id` vier, só ela. */
  adjacentStatue(p: PlayerState, id?: string): Statue | undefined {
    return this.o.statues.find((s) => (id === undefined || s.id === id) && statueDistance(s, p.x, p.y) <= 1);
  }

  private notice(p: PlayerState, text: string, kind: NoticeMsg["kind"] = "warn") {
    this.o.send(p.id, S2C.Notice, { text, kind } satisfies NoticeMsg);
  }

  /** C2S.TrainOpen: abre a escolha de skill (S2C.TrainingOpen) se estiver ao lado da estátua. */
  onOpen(p: PlayerState, msg: TrainOpenMsg): void {
    if (!msg || typeof msg.statueId !== "string" || p.hp <= 0) return;
    const st = this.adjacentStatue(p, msg.statueId);
    if (!st) { this.notice(p, NOTICE_TRAIN_FAR); return; }
    this.o.send(p.id, S2C.TrainingOpen, { statueId: st.id } satisfies TrainingOpenMsg);
  }

  /**
   * C2S.TrainOffline: valida (skill conhecida, viva, ao lado de uma estátua, fora de combate) e devolve o registro a salvar
   * (o chamador salva o personagem e desconecta com CLOSE_TRAINING). null = recusado (o jogador recebe um aviso).
   */
  begin(p: PlayerState, msg: TrainOfflineMsg, now: number): OfflineTraining | null {
    const skill = msg?.skill;
    if (typeof skill !== "string" || !SKILLS.includes(skill as SkillId)) return null;
    if (p.hp <= 0) return null;
    const st = this.adjacentStatue(p);
    if (!st) { this.notice(p, NOTICE_TRAIN_FAR); return null; }
    if (this.o.inCombat(p.id, now)) { this.notice(p, "Você está em combate. Espere alguns segundos para treinar offline."); return null; }
    return { skill: skill as SkillId, sinceMs: now, statueId: st.id };
  }

  /** Tile andável ao lado da estátua (null = estátua desconhecida/sem espaço → o chamador usa o spawn). */
  returnTile(statueId: string | undefined, selfId: string): { x: number; y: number } | null {
    const st = this.o.statues.find((s) => s.id === statueId);
    if (!st) return null;
    // Anel ao redor da pegada 2x2 (x..x+1, y-1..y); prefere o lado de baixo.
    for (let y = st.y + 1; y >= st.y - 2; y--)
      for (let x = st.x - 1; x <= st.x + 2; x++)
        if (statueDistance(st, x, y) === 1 && this.o.isFree(x, y, selfId)) return { x, y };
    return null;
  }

  /**
   * Aplica o treino offline pendente: minutos = (agora − início) limitados a [0, 12 h]; tentativas por
   * offlineTrainingTries; sobe quantos níveis couber. Não mexe em posição/vida (o chamador faz).
   */
  applyOffline(p: PlayerState, t: OfflineTraining, now: number): TrainingResultMsg {
    const minutes = offlineTrainingMinutes(t.sinceMs, now);
    const before = this.o.skills.get(p.id, t.skill)?.level ?? 0;
    const tries = offlineTrainingTries(t.skill, minutes, p.vocation, p.level);
    if (tries > 0) this.o.skills.addTries(p, t.skill, tries);
    const cur = this.o.skills.get(p.id, t.skill);
    const level = cur?.level ?? before;
    const need = skillTriesFor(t.skill, level, p.vocation);
    const pct = cur && need > 0 ? Math.min(99, Math.floor((cur.tries * 100) / need)) : 0;
    return { skill: t.skill, minutes: Math.floor(minutes), levelsGained: Math.max(0, level - before), newLevel: level, pct };
  }
}
