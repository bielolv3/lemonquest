// Paper doll no layout do Tibia. Itens chegam no M4: hoje só slots vazios com silhueta.
import { PixelIcon, type IconName } from "./icons.tsx";
import { Section } from "./Section.tsx";

export type EquipSlot = "amulet" | "helmet" | "backpack" | "weapon" | "armor" | "shield" | "ring" | "legs" | "accessory" | "boots";

export interface EquippedItem { name: string; icon: string; count?: number }

const SLOT_META: Record<EquipSlot, { label: string; icon: IconName }> = {
  amulet: { label: "Amuleto", icon: "amulet" },
  helmet: { label: "Elmo", icon: "helmet" },
  backpack: { label: "Mochila", icon: "backpack" },
  weapon: { label: "Arma", icon: "weapon" },
  armor: { label: "Armadura", icon: "armor" },
  shield: { label: "Escudo", icon: "shield" },
  ring: { label: "Anel", icon: "ring" },
  legs: { label: "Calças", icon: "legs" },
  accessory: { label: "Acessório", icon: "gem" },
  boots: { label: "Botas", icon: "boots" },
};

/** Ordem do grid 3 colunas (null = célula de estatística). */
const GRID: (EquipSlot | "cap" | "arm")[] = [
  "amulet", "helmet", "backpack",
  "weapon", "armor", "shield",
  "ring", "legs", "accessory",
  "cap", "boots", "arm",
];

interface Props {
  items?: Partial<Record<EquipSlot, EquippedItem>>;
  cap?: { used: number; max: number };
  armor?: number;
}

export function EquipmentPanel({ items = {}, cap = { used: 0, max: 400 }, armor = 0 }: Props) {
  return (
    <Section id="equipment" title="Equipamento">
      <div class="equip-grid">
        {GRID.map((cell) => {
          if (cell === "cap") {
            return (
              <div key={cell} class="equip-stat" data-tip="Capacidade" data-tip-sub="Peso carregado / máximo">
                <span class="equip-stat-k">Cap</span>
                <span class="equip-stat-v">{cap.used}<small>/{cap.max}</small></span>
              </div>
            );
          }
          if (cell === "arm") {
            return (
              <div key={cell} class="equip-stat" data-tip="Armadura" data-tip-sub="Reduz o dano físico recebido">
                <span class="equip-stat-k">Arm</span>
                <span class="equip-stat-v">{armor}</span>
              </div>
            );
          }
          const meta = SLOT_META[cell];
          const it = items[cell];
          return (
            <div
              key={cell}
              class={`slot equip-slot${it ? " filled" : ""}`}
              data-tip={it ? it.name : meta.label}
              data-tip-sub={it ? meta.label : "Vazio"}
            >
              {it ? <img src={it.icon} alt="" draggable={false} /> : <PixelIcon name={meta.icon} size={20} class="slot-ghost" />}
              {it?.count && it.count > 1 && <span class="slot-count">{it.count}</span>}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
