// Mochila 4x5. Itens chegam no M4.
import { PixelIcon } from "./icons.tsx";
import { Section } from "./Section.tsx";

export const BACKPACK_SLOTS = 20;

export interface BagItem { name: string; icon: string; count?: number }

export function Backpack({ items = [] }: { items?: (BagItem | null)[] }) {
  const used = items.filter(Boolean).length;
  return (
    <Section id="backpack" title="Mochila" aside={<span class="count-chip">{used}/{BACKPACK_SLOTS}</span>}>
      <div class={`bag-grid${used === 0 ? " empty" : ""}`}>
        {Array.from({ length: BACKPACK_SLOTS }, (_, i) => {
          const it = items[i];
          return (
            <div key={i} class={`slot bag-slot${it ? " filled" : ""}`} data-tip={it?.name}>
              {it && <img src={it.icon} alt="" draggable={false} />}
              {it?.count && it.count > 1 && <span class="slot-count">{it.count}</span>}
            </div>
          );
        })}
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
