// Mochila 4x5 com itens reais (arrastar, usar, equipar). O ouro fica no cabeçalho.
import { BACKPACK_SIZE } from "@lemonquest/shared";
import { GoldLabel } from "../items/Gold.tsx";
import { inventoryStore } from "../items/inventory.ts";
import { ItemSlot } from "../items/ItemSlot.tsx";
import { PixelIcon } from "./icons.tsx";
import { Section } from "./Section.tsx";
import { useStore } from "./store.ts";

export const BACKPACK_SLOTS = BACKPACK_SIZE;

export function Backpack() {
  const inv = useStore(inventoryStore);
  const bp = inv?.backpack ?? [];
  const used = bp.filter(Boolean).length;
  return (
    <Section
      id="backpack"
      title="Mochila"
      aside={
        <span class="bag-aside">
          <GoldLabel gold={inv?.gold ?? 0} />
          <span class="count-chip" data-tip="Espaço usado">{used}/{BACKPACK_SLOTS}</span>
        </span>
      }
    >
      <div class={`bag-grid${used === 0 ? " empty" : ""}`}>
        {Array.from({ length: BACKPACK_SLOTS }, (_, i) => (
          <ItemSlot key={i} loc={{ where: "backpack", index: i }} inst={bp[i]} size={40} class="bag-slot" />
        ))}
        {used === 0 && (
          <div class="bag-empty">
            <PixelIcon name="backpack" size={18} />
            <span>Mochila vazia</span>
          </div>
        )}
      </div>
    </Section>
  );
}
