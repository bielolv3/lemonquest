import { BASE_STEP_MS, DIAGONAL_COST } from "./constants.ts";
import { Dir, isDiagonal } from "./types.ts";

/**
 * Duração de um passo. Fica ~15% mais rápido até o level 40.
 * `groundSpeed` = velocidade do chão do tile de ORIGEM (onde o passo começa), como no Tibia:
 * porcentagem, 100 = normal, maior = mais lento (lama 150), menor = mais rápido (estrada 85).
 * Servidor e predição do cliente DEVEM chamar com os mesmos argumentos (ver GroundSpeedGrid).
 */
export function stepDuration(level: number, dir: Dir, groundSpeed = 100): number {
  const speedup = 1 + Math.min(level - 1, 39) * 0.004;
  const base = BASE_STEP_MS / speedup;
  const ms = Math.round(isDiagonal(dir) ? base * DIAGONAL_COST : base);
  return groundSpeed === 100 ? ms : Math.round((ms * groundSpeed) / 100);
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

// ---------------------------------------------------------------------------
// Combate (M2). Funções puras; `rng` = () => [0,1) para testes determinísticos.
// ---------------------------------------------------------------------------

/** Intervalo do ataque automático do jogador (ms), igual para todas as vocações. */
export const PLAYER_ATTACK_MS = 2000;
/** Sem dar/receber dano por este tempo = fora de combate (regen normal). */
export const OUT_OF_COMBAT_MS = 6000;
/** Intervalo da regeneração de HP/mana (ms). */
export const REGEN_INTERVAL_MS = 2000;
export const CRIT_CHANCE = 0.07;
export const CRIT_MULT = 1.5;
export const MISS_CHANCE = 0.05;
/** Fração da XP do level atual perdida ao morrer. */
export const DEATH_PENALTY_PCT = 0.1;

export interface VocationAttack {
  /** Alcance (Chebyshev). 1 = corpo a corpo. */
  range: number;
  kind: "physical" | "energy" | "ice";
  ranged: boolean;
  /** Pode dar crítico (knight/paladin). */
  canCrit: boolean;
}

export const VOCATION_ATTACK: Record<Vocation, VocationAttack> = {
  knight: { range: 1, kind: "physical", ranged: false, canCrit: true },
  paladin: { range: 6, kind: "physical", ranged: true, canCrit: true },
  sorcerer: { range: 4, kind: "energy", ranged: true, canCrit: false },
  druid: { range: 4, kind: "ice", ranged: true, canCrit: false },
};

const VOC_DAMAGE: Record<Vocation, { base: number; perLevel: number }> = {
  knight: { base: 6, perLevel: 1.6 },
  paladin: { base: 5, perLevel: 1.4 },
  sorcerer: { base: 4, perLevel: 1.1 },
  druid: { base: 4, perLevel: 1.1 },
};

/** Faixa [min,max] do ataque básico do jogador (média ±25%). */
export function playerDamageRange(vocation: Vocation, level: number): [number, number] {
  const d = VOC_DAMAGE[vocation] ?? VOC_DAMAGE.knight;
  const avg = d.base + Math.max(1, level) * d.perLevel;
  return [Math.max(1, Math.floor(avg * 0.75)), Math.max(1, Math.ceil(avg * 1.25))];
}

/** Inteiro uniforme em [min,max]. */
export function rollInt(min: number, max: number, rng: () => number): number {
  const lo = Math.min(min, max), hi = Math.max(min, max);
  return lo + Math.min(hi - lo, Math.floor(rng() * (hi - lo + 1)));
}

export interface AttackRoll { amount: number; crit: boolean; miss: boolean }

/** Rola um ataque básico do jogador (antes da armadura do alvo): 5% de errar; 7% de crítico ×1.5 (knight/paladin). */
export function playerAttackDamage(vocation: Vocation, level: number, rng: () => number): AttackRoll {
  if (rng() < MISS_CHANCE) return { amount: 0, crit: false, miss: true };
  const [min, max] = playerDamageRange(vocation, level);
  let amount = rollInt(min, max, rng);
  const crit = (VOCATION_ATTACK[vocation] ?? VOCATION_ATTACK.knight).canCrit && rng() < CRIT_CHANCE;
  if (crit) amount = Math.round(amount * CRIT_MULT);
  return { amount, crit, miss: false };
}

/** Dano após a armadura (redução fixa), nunca negativo. */
export function mitigate(raw: number, armor: number): number {
  return Math.max(0, Math.round(raw - Math.max(0, armor)));
}

/** Level correspondente a uma XP total. */
export function levelForXp(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}

/** XP perdida ao morrer: 10% da XP entre o início do level atual e o próximo; nunca derruba o level. */
export function deathPenalty(level: number, xp: number): number {
  const start = xpForLevel(level);
  const span = xpForLevel(level + 1) - start;
  return Math.max(0, Math.min(Math.round(span * DEATH_PENALTY_PCT), xp - start));
}

/** Divide `total` de XP proporcionalmente ao dano causado (arredondado, mínimo 1 por participante). */
export function splitXp(total: number, damage: Iterable<[string, number]>): Map<string, number> {
  const entries = [...damage].filter(([, d]) => d > 0);
  const sum = entries.reduce((s, [, d]) => s + d, 0);
  const out = new Map<string, number>();
  if (sum <= 0 || total <= 0) return out;
  for (const [id, d] of entries) out.set(id, Math.max(1, Math.round((total * d) / sum)));
  return out;
}

/** HP/mana recuperados por tique de regeneração (a cada REGEN_INTERVAL_MS, fora de combate). ×3 em zona de proteção. */
export function regenAmount(max: number, level: number, inPz: boolean): number {
  const base = Math.max(1, Math.round(max * 0.01 + level * 0.25));
  return inPz ? base * 3 : base;
}
