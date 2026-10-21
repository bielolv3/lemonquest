// Mochila com itens reais (arrastar, usar, equipar), 4 por linha. O tamanho vem do servidor (cresce com o level:
// backpackCapacity). O ouro fica no cabeçalho.
import { BACKPACK_LEVELS_PER_SLOT, BACKPACK_MAX, BACKPACK_SIZE } from "@lemonquest/shared";
import { GoldLabel } from "../items/Gold.tsx";
import { inventoryStore } from "../items/inventory.ts";
import { ItemSlot } from "../items/ItemSlot.tsx";
import { PixelIcon } from "./icons.tsx";
import { Section } from "./Section.tsx";
import { useStore } from "./store.ts";

export function Backpack() {
  const inv = useStore(inventoryStore);
  const bp = inv?.backpack ?? [];
  const slots = bp.length || BACKPACK_SIZE;
  const used = bp.filter(Boolean).length;
  return (
    <Section
      id="backpack"
      title="Mochila"
      size="backpack"
      aside={
        <span class="bag-aside">
          <GoldLabel gold={inv?.gold ?? 0} />
          <span class="count-chip" data-tip="Espaço usado" data-tip-sub={slots < BACKPACK_MAX ? `A mochila ganha 1 espaço a cada ${BACKPACK_LEVELS_PER_SLOT} levels (até ${BACKPACK_MAX})` : `Mochila no máximo (${BACKPACK_MAX})`}>{used}/{slots}</span>
        </span>
      }
    >
      <div class={`bag-grid${used === 0 ? " empty" : ""}`}>
        {Array.from({ length: slots }, (_, i) => (
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
