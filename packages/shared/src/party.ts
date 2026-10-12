// Grupo (party) estilo Tibia: constantes e regras puras da experiência compartilhada (servidor e cliente).

/** Máximo de membros num grupo. */
export const PARTY_MAX = 6;
/** Convite expira depois disso. */
export const PARTY_INVITE_MS = 60_000;
/** Distância máxima (tiles, Chebyshev) do abate para receber a parte da XP. */
export const PARTY_SHARE_RANGE = 12;
/** Membro "ativo" = atacou um monstro ou curou alguém do grupo nesse intervalo. */
export const PARTY_ACTIVE_MS = 60_000;
/** Bônus por membro extra que divide a XP (+20% cada). */
export const PARTY_SHARE_BONUS = 0.2;

/** Regra de level (Tibia): o menor level precisa ser ≥ 2/3 do maior. */
export function partyLevelsOk(levels: readonly number[]): boolean {
  if (levels.length === 0) return true;
  const min = Math.min(...levels), max = Math.max(...levels);
  return min * 3 >= max * 2;
}

/** Menor level aceito no grupo dado o maior (2/3, arredondado para cima). */
export const partyMinLevel = (maxLevel: number): number => Math.ceil((maxLevel * 2) / 3);

/** XP de cada um quando `n` membros dividem `total`: total × (1 + 0,2 × (n−1)) ÷ n (mín. 1). */
export function partyShareEach(total: number, n: number): number {
  if (total <= 0) return 0;
  if (n <= 1) return total;
  return Math.max(1, Math.round((total * (1 + PARTY_SHARE_BONUS * (n - 1))) / n));
}

/** Motivo de a XP compartilhada estar inativa. */
export type PartyShareReason = "alone" | "levels";
export const PARTY_SHARE_REASON_TEXT: Record<PartyShareReason, string> = {
  alone: "Só você no grupo",
  levels: "Diferença de level grande demais",
};
