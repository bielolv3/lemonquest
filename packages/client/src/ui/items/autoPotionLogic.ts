// Decisão da poção automática (pura: sem DOM nem stores) para poder testar.

export interface AutoPotionSettings { hp: number; mana: number }
/** Limites em % (0 = desligado, passo de 5, no máximo 90). */
export const AUTO_POTION_MAX = 90;

const clamp = (n: unknown): number => {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n / 5) * 5 : 0;
  return Math.max(0, Math.min(AUTO_POTION_MAX, v));
};

/** Lê o que foi salvo, com tolerância a lixo. */
export function parseSettings(raw: string | null): AutoPotionSettings {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<AutoPotionSettings>) : {};
    return { hp: clamp(v.hp), mana: clamp(v.mana) };
  } catch {
    return { hp: 0, mana: 0 };
  }
}

/** Deve beber agora? `pct` = limite (0 = desligado); vivo; abaixo ou no limite; e passou o intervalo mínimo. */
export function shouldDrink(cur: number, max: number, pct: number, now: number, lastAt: number, gapMs = 1200): boolean {
  if (pct <= 0 || max <= 0 || cur <= 0) return false;
  if ((cur / max) * 100 > pct) return false;
  return now - lastAt >= gapMs;
}
