// Roupas (outfits) e addons: validação, carga/gravação no registro e troca (C2S.SetOutfit).
import { ADDON_BITS, OUTFITS, resolveOutfit, type SetOutfitMsg } from "@lemonquest/shared";
import type { PlayerState } from "../state.ts";
import type { CharacterRecord } from "../persistence/types.ts";

/**
 * Gancho das conquistas: a roupa `outfitId` (addonBit = 0) ou o addon (addonBit = 1 | 2) está liberado para o personagem?
 * Hoje TUDO é liberado para todos. Quando houver conquistas, consulte `rec.data` / `OUTFITS[id].unlock` aqui.
 */
export function isOutfitUnlocked(_rec: CharacterRecord | undefined, outfitId: string, _addonBit: 0 | 1 | 2): boolean {
  return outfitId in OUTFITS;
}

/** Máscara de addons válida (só bits 1|2). */
export function sanitizeAddons(v: unknown): number {
  return typeof v === "number" && Number.isInteger(v) ? v & ADDON_BITS : 0;
}

/** Roupa do registro (legado sem o campo, ou id desconhecido → padrão da vocação). */
export function loadOutfit(rec: CharacterRecord): { outfit: string; addons: number } {
  const o = resolveOutfit(rec.data.outfit, rec.vocation);
  const addons = o.id === rec.data.outfit ? sanitizeAddons(rec.data.addons) : 0;
  return { outfit: o.id, addons };
}

/** Valida um pedido de troca. null = inválido (id desconhecido, bits fora do intervalo, bloqueado). */
export function validateSetOutfit(m: unknown, rec?: CharacterRecord): { outfit: string; addons: number } | null {
  if (!m || typeof m !== "object") return null;
  const { outfit, addons } = m as Partial<SetOutfitMsg>;
  if (typeof outfit !== "string" || outfit.length > 32 || !Object.hasOwn(OUTFITS, outfit)) return null;
  if (typeof addons !== "number" || !Number.isInteger(addons) || addons < 0 || addons > ADDON_BITS) return null;
  if (!isOutfitUnlocked(rec, outfit, 0)) return null;
  for (const bit of [1, 2] as const) if ((addons & bit) && !isOutfitUnlocked(rec, outfit, bit)) return null;
  return { outfit, addons };
}

/** Aplica a troca no estado (todos veem) e no registro (persistido no próximo save). */
export function applySetOutfit(p: PlayerState, rec: CharacterRecord | undefined, m: unknown): boolean {
  const v = validateSetOutfit(m, rec);
  if (!v) return false;
  p.outfit = v.outfit;
  p.addons = v.addons;
  if (rec) { rec.data.outfit = v.outfit; rec.data.addons = v.addons; }
  return true;
}
