import { BASE_STEP_MS, DIAGONAL_COST } from "./constants.ts";
import { Dir, isDiagonal } from "./types.ts";

/** Duração de um passo. Fica ~15% mais rápido até o level 40. */
export function stepDuration(level: number, dir: Dir): number {
  const speedup = 1 + Math.min(level - 1, 39) * 0.004;
  const base = BASE_STEP_MS / speedup;
  return Math.round(isDiagonal(dir) ? base * DIAGONAL_COST : base);
}

/** Direção de um passo unitário (dx,dy em {-1,0,1}); null se (dx,dy) não for vizinho. */
export function dirFromDelta(dx: number, dy: number): Dir | null {
  if (dx === 0 && dy === -1) return Dir.N;
  if (dx === 1 && dy === -1) return Dir.NE;
  if (dx === 1 && dy === 0) return Dir.E;
  if (dx === 1 && dy === 1) return Dir.SE;
  if (dx === 0 && dy === 1) return Dir.S;
  if (dx === -1 && dy === 1) return Dir.SW;
  if (dx === -1 && dy === 0) return Dir.W;
  if (dx === -1 && dy === -1) return Dir.NW;
  return null;
}

/** Valida uma direção vinda da rede (inteiro 0..7). */
export const isValidDir = (d: unknown): d is Dir => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 7;

import type { Vocation } from "./types.ts";

/** XP total necessária para ATINGIR o level (level 1 = 0). Curva rápida no início, como no plano. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  const l = level - 1;
  return Math.round(50 * l + 25 * l * l + 2 * l * l * l);
}

const VOC_GROWTH: Record<Vocation, { hp: number; mana: number }> = {
  knight: { hp: 15, mana: 5 },
  paladin: { hp: 10, mana: 15 },
  sorcerer: { hp: 5, mana: 30 },
  druid: { hp: 5, mana: 30 },
};

/** HP/mana máximos por vocação e level. Ajustável no balanceamento (M7). */
export function baseStats(vocation: Vocation, level: number): { maxHp: number; maxMana: number } {
  const g = VOC_GROWTH[vocation] ?? VOC_GROWTH.knight;
  return { maxHp: 150 + g.hp * (level - 1), maxMana: 50 + g.mana * (level - 1) };
}
