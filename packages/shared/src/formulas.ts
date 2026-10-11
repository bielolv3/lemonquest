import { BASE_STEP_MS, DIAGONAL_COST } from "./constants.ts";
import { Dir, isDiagonal } from "./types.ts";

/** Duração de um passo. Fica ~15% mais rápido até o level 40. */
export function stepDuration(level: number, dir: Dir): number {
  const speedup = 1 + Math.min(level - 1, 39) * 0.004;
  const base = BASE_STEP_MS / speedup;
  return Math.round(isDiagonal(dir) ? base * DIAGONAL_COST : base);
}
