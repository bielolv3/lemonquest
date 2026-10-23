// Largar no chão por arrasto: itens valiosos pedem confirmação (qualquer um pode pegar o que cai no chão).
// Regra pura, separada do dnd.ts (que depende do DOM) para ter teste unitário.
import { RARITIES, type ItemInstance, type Rarity } from "@lemonquest/shared";

/** A partir desta raridade, soltar no mundo abre um "tem certeza?" (mesma linha de corte do "Vender tudo"). */
export const DROP_CONFIRM_FROM: Rarity = "rare";

/** Soltar este item no chão (fora dos painéis) pede confirmação? Comum/incomum larga direto. */
export function needsDropConfirm(inst: Pick<ItemInstance, "rarity">): boolean {
  return RARITIES.indexOf(inst.rarity) >= RARITIES.indexOf(DROP_CONFIRM_FROM);
}

/** Texto do diálogo de confirmação. `rarityText` é o rótulo em português (ex.: "Raro"). */
export function dropConfirmText(name: string, rarityText: string): string {
  return `Largar ${name} (${rarityText.toLowerCase()}) no chão? Qualquer um pode pegar.`;
}
