// Desafios da semana: 3 metas medidas pelo ganho desde segunda-feira (ver weekly.ts); cada uma dá uma recompensa e,
// resgatando as 3, há um bônus. Zeram na virada da semana. Dados puros (servidor e cliente).
import { xpForLevel } from "../formulas.ts";
import type { WeeklyKey } from "./weekly.ts";

export interface ChallengeReward {
  xp?: number;
  gold?: number;
  items?: { itemId: string; count: number }[];
}

export interface ChallengeDef {
  id: string;
  name: string;
  /** Texto da meta; `{n}` vira a quantidade. */
  desc: string;
  key: WeeklyKey;
  /** Quantidade fixa, ou função do level que o personagem tinha ao começar a semana. */
  target: number | ((level: number) => number);
  reward: ChallengeReward;
}

export const CHALLENGES: readonly ChallengeDef[] = [
  {
    id: "cacada", name: "Caçada da semana", desc: "Derrote {n} monstros", key: "kills", target: 150,
    reward: { gold: 400, items: [{ itemId: "health_potion", count: 10 }] },
  },
  {
    id: "pescaria", name: "Pescaria da semana", desc: "Pesque {n} peixes", key: "fish", target: 12,
    reward: { gold: 300, items: [{ itemId: "salmon", count: 3 }] },
  },
  {
    // Meta de XP = um level inteiro do personagem no começo da semana (nunca menos que 300).
    id: "evolucao", name: "Evolução da semana", desc: "Ganhe {n} de XP", key: "xp",
    target: (level) => Math.max(300, xpForLevel(level + 1) - xpForLevel(level)),
    reward: { gold: 500, items: [{ itemId: "mana_potion", count: 10 }] },
  },
];

/** Bônus por resgatar todos os desafios da semana. */
export const CHALLENGE_BONUS: ChallengeReward = { xp: 200, gold: 1500, items: [{ itemId: "health_potion_medium", count: 5 }] };

export const challengeDef = (id: string): ChallengeDef | undefined => CHALLENGES.find((c) => c.id === id);

export function challengeTarget(def: ChallengeDef, startLevel: number): number {
  return Math.max(1, Math.floor(typeof def.target === "function" ? def.target(Math.max(1, startLevel)) : def.target));
}

/** Estado enviado ao cliente (S2C.Challenges). */
export interface ChallengeView {
  id: string;
  name: string;
  desc: string;
  progress: number;
  target: number;
  claimed: boolean;
  reward: ChallengeReward;
}
export interface ChallengesMsg {
  weekEndsAt: number;
  goals: ChallengeView[];
  bonus: { reward: ChallengeReward; claimed: boolean };
}

/** C2S.Challenge */
export type ChallengeActionMsg = { action: "list" } | { action: "claim"; id: string } | { action: "claimBonus" };
