import type { Vocation } from "./types.ts";

export type SkillId = "melee" | "distance" | "magic" | "shield";
export const SKILLS: SkillId[] = ["melee", "distance", "magic", "shield"];

export const SKILL_START: Record<SkillId, number> = { melee: 10, distance: 10, magic: 0, shield: 10 };

/** Multiplicador de dificuldade por vocação (menor = sobe mais rápido), estilo Tibia. */
export const SKILL_RATE: Record<Vocation, Record<SkillId, number>> = {
  knight: { melee: 1.1, distance: 1.4, magic: 3.0, shield: 1.1 },
  paladin: { melee: 1.2, distance: 1.1, magic: 1.4, shield: 1.1 },
  sorcerer: { melee: 2.0, distance: 2.0, magic: 1.1, shield: 1.5 },
  druid: { melee: 1.8, distance: 1.8, magic: 1.1, shield: 1.5 },
};

/** "Tentativas" para sair do nível `level` para o próximo (golpes; para magic = mana gasta). */
export function skillTriesFor(skill: SkillId, level: number, vocation: Vocation): number {
  const rate = SKILL_RATE[vocation][skill];
  const base = skill === "magic" ? 120 : 30;
  const from = skill === "magic" ? level : level - SKILL_START[skill];
  return Math.round(base * Math.pow(rate * 1.15, Math.max(0, from)));
}
