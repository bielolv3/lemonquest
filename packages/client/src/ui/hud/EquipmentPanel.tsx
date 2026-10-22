// Paper doll: itens reais do servidor (S2C.Inventory). Cap e Arm (stats.armor) abaixo.
import { shieldArmorBonus, type EquipSlot } from "@lemonquest/shared";
import { inventoryStore } from "../items/inventory.ts";
import { ItemSlot } from "../items/ItemSlot.tsx";
import { SLOT_LABEL } from "../items/itemInfo.ts";
import { PixelIcon, type IconName } from "./icons.tsx";
import { Section } from "./Section.tsx";
import { useStore } from "./store.ts";
import { meStore } from "./world.ts";

const SLOT_ICON: Record<EquipSlot, IconName> = {
  amulet: "amulet", helmet: "helmet", weapon: "weapon", armor: "armor", shield: "shield", ring: "ring", legs: "legs", boots: "boots",
};

/** Grid 3 colunas no estilo do Tibia (null = célula vazia). */
const GRID: (EquipSlot | null)[] = [
  "amulet", "helmet", null,
  "weapon", "armor", "shield",
  "ring", "legs", "boots",
];

export function EquipmentPanel() {
  const inv = useStore(inventoryStore);
  const cap = inv?.cap ?? { used: 0, max: 0 };
  const me = useStore(meStore);
  // stats.armor soma só os itens; com escudo equipado o servidor ainda soma o bônus da skill Escudo (combat.ts).
  const itemArmor = inv?.stats.armor ?? 0;
  const shieldBonus = inv?.equipment.shield ? shieldArmorBonus(me?.skillShield ?? 10) : 0;
  const armor = itemArmor + shieldBonus;
  return (
    <Section id="equipment" title="Equipamento">
      <div class="equip-grid">
        {GRID.map((slot, i) =>
          slot ? (
            <ItemSlot
              key={slot}
              loc={{ where: "equip", slot }}
              inst={inv?.equipment[slot]}
              size={42}
              class="equip-slot"
              tip={SLOT_LABEL[slot]}
              tipSub="Vazio"
              ghost={<PixelIcon name={SLOT_ICON[slot]} size={20} class="slot-ghost" />}
            />
          ) : (
            <span key={`gap${i}`} />
          ),
        )}
      </div>
      <div class="equip-stats">
        <div class="equip-stat wide" data-tip="Capacidade" data-tip-sub="Peso carregado / máximo">
          <span class="equip-stat-k">Cap</span>
          <span class="equip-stat-v">{cap.used}<small>/{cap.max}</small></span>
        </div>
        <div class="equip-stat wide" data-tip="Armadura" data-tip-sub={shieldBonus ? `Reduz o dano físico recebido · itens ${itemArmor} + Escudo ${shieldBonus}` : "Reduz o dano físico recebido"}>
          <span class="equip-stat-k">Arm</span>
          <span class="equip-stat-v">{armor}</span>
        </div>
      </div>
    </Section>
  );
}
