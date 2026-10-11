import type { DamageKind, Vocation } from "../types.ts";

export type EquipSlot = "helmet" | "amulet" | "armor" | "weapon" | "shield" | "legs" | "ring" | "boots";
export const EQUIP_SLOTS: EquipSlot[] = ["helmet", "amulet", "armor", "weapon", "shield", "legs", "ring", "boots"];

export type ItemKind =
  | "weapon" | "shield" | "helmet" | "armor" | "legs" | "boots" | "ring" | "amulet"
  | "potion" | "material" | "key" | "quest" | "food";

export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export const RARITIES: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];
/** Cores de raridade (UI, brilho do loot, feed). */
export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#b5b9c6", uncommon: "#5fd17a", rare: "#4a9df0", epic: "#b36cf0", legendary: "#f0a33a",
};
export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Comum", uncommon: "Incomum", rare: "Raro", epic: "Épico", legendary: "Lendário",
};

/** Atributos que itens (e bônus aleatórios) podem dar. */
export type StatId =
  | "attack"      // dano base da arma (substitui o dano "desarmado" da vocação)
  | "armor"       // redução fixa de dano recebido
  | "hpMax" | "manaMax"
  | "magic" | "melee" | "distance" | "shield"   // bônus de skill
  | "speed"       // % de velocidade
  | "crit"        // % de chance de crítico
  | "hpRegen" | "manaRegen"; // por tick de regen

export type Stats = Partial<Record<StatId, number>>;

/** Ícone: imagem única (url) ou frame de um atlas (url + frame + frameWidth/Height). Caminho relativo a assets/. */
export interface ItemIcon {
  url: string;
  frame?: number;
  frameWidth?: number;
  frameHeight?: number;
  tint?: number;
}

export type WeaponType = "sword" | "axe" | "club" | "bow" | "wand" | "rod";

export interface ItemDef {
  id: string;
  name: string;            // PT-BR
  kind: ItemKind;
  slot?: EquipSlot;        // obrigatório para equipáveis
  icon: ItemIcon;
  /** Vocações que podem equipar (ausente = todas). */
  vocations?: Vocation[];
  /** Level mínimo para equipar. */
  level?: number;
  stats?: Stats;
  weaponType?: WeaponType;
  /** Alcance do ataque automático com esta arma (1 = corpo a corpo). */
  range?: number;
  /** Tipo de dano do ataque automático com esta arma. */
  damageKind?: DamageKind;
  /** Duas mãos: impede escudo. */
  twoHanded?: boolean;
  stackable?: boolean;
  maxStack?: number;       // padrão 100 se stackable
  /** Preço base em ouro (a loja vende por ~este valor e compra por ~30%). */
  value: number;
  /** Itens usáveis (poções). */
  use?: { heal?: number; mana?: number; cooldownMs: number };
  description?: string;    // PT-BR, curta
}

/** Instância de item (o que fica na mochila/equipamento/depot). */
export interface ItemInstance {
  uid: string;             // único por instância
  defId: string;
  count: number;           // 1 para não-empilháveis
  rarity: Rarity;
  /** Bônus aleatórios da raridade (0–3), somados aos `stats` da definição. */
  bonuses: { stat: StatId; value: number }[];
}

export interface LootEntry {
  itemId: string;
  /** Chance por abate, 0–1. */
  chance: number;
  min?: number;
  max?: number;
}

export const BACKPACK_SIZE = 20;
export const DEPOT_SIZE = 60;

/** Catálogo. O agente de conteúdo completa. */
export const ITEMS: Record<string, ItemDef> = {
  gold_coin: {
    id: "gold_coin", name: "Moeda de Ouro", kind: "material", stackable: true, maxStack: 1_000_000, value: 1,
    icon: { url: "ninja/Items/Treasure/GoldCoin.png" },
  },
  health_potion: {
    id: "health_potion", name: "Poção de Vida", kind: "potion", stackable: true, value: 40,
    use: { heal: 60, cooldownMs: 1000 }, icon: { url: "ninja/Items/Potion/LifePot.png" },
    description: "Recupera um pouco de vida.",
  },
};

export const itemDef = (id: string): ItemDef | undefined => ITEMS[id];
export const isEquipable = (d: ItemDef): boolean => d.slot != null;
