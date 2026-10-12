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
  /** Itens usáveis: poções (cura/mana instantâneas) e comida (`food`: regeneração ao longo do tempo). */
  use?: { heal?: number; mana?: number; food?: { hpPerTick: number; manaPerTick: number; durationMs: number }; cooldownMs: number };
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

// ---------------------------------------------------------------------------
// Ícones de equipamento: atlas gerado por tools/icons/generate.mjs (assets/icons/gear.png, 16x16, 12 colunas).
// Ordem do atlas: para cada forma (GEAR_SHAPES) 8 tiers (GEAR_TIERS); depois, para cada tier, anel e amuleto.
// ---------------------------------------------------------------------------
export const GEAR_SHAPES = [
  "helmet_cap", "helmet_full", "helmet_horned", "helmet_wizard", "armor_vest", "armor_plate", "armor_robe",
  "legs_pants", "legs_greaves", "boots", "shield_round", "shield_kite", "shield_tower",
] as const;
export const GEAR_TIERS = ["leather", "bronze", "iron", "steel", "gold", "mithril", "dragon", "arcane"] as const;
export type GearShape = (typeof GEAR_SHAPES)[number];
export type GearTier = (typeof GEAR_TIERS)[number];

/** Número do frame no atlas gear.png. */
export function gearFrame(shape: GearShape | "ring" | "amulet", tier: GearTier): number {
  const ti = GEAR_TIERS.indexOf(tier);
  if (shape === "ring") return GEAR_SHAPES.length * 8 + ti * 2;
  if (shape === "amulet") return GEAR_SHAPES.length * 8 + ti * 2 + 1;
  return GEAR_SHAPES.indexOf(shape) * 8 + ti;
}
const gear = (shape: GearShape | "ring" | "amulet", tier: GearTier): ItemIcon =>
  ({ url: "icons/gear.png", frame: gearFrame(shape, tier), frameWidth: 16, frameHeight: 16 });

/** Ícones de materiais: atlas tools/icons/materials.mjs (assets/icons/materials.png, 16x16, 8 colunas; ordem = esta lista). */
export const MATERIAL_ICONS = ["cheese","slime_goo","herb","bee_sting","wolf_pelt","wolf_fang","snake_skin","spider_silk","spider_eye","bat_wing","bone","goblin_tooth","ectoplasm","lizard_scale","ember"] as const;
const matIcon = (name: (typeof MATERIAL_ICONS)[number]): ItemIcon =>
  ({ url: "icons/materials.png", frame: MATERIAL_ICONS.indexOf(name), frameWidth: 16, frameHeight: 16 });

const N = "ninja/Items/";
const img = (path: string, tint?: number): ItemIcon => (tint === undefined ? { url: N + path } : { url: N + path, tint });

const ITEM_LIST: ItemDef[] = [];
const add = (d: ItemDef): void => { ITEM_LIST.push(d); };

// Níveis e preços por tier (1..5). Preço base; a loja compra a ~30%.
const TIER_LEVEL = [1, 8, 15, 25, 35];

// ---------------------------------------------------------------------------
// Moeda, poções e comida
// ---------------------------------------------------------------------------
add({ id: "gold_coin", name: "Moeda de Ouro", kind: "material", stackable: true, maxStack: 1_000_000, value: 1, icon: img("Treasure/GoldCoin.png") });

const potion = (id: string, name: string, icon: ItemIcon, value: number, level: number, use: { heal?: number; mana?: number }, description: string): void =>
  add({ id, name, kind: "potion", stackable: true, value, level, use: { ...use, cooldownMs: 1000 }, icon, description });
potion("health_potion", "Poção de Vida", img("Potion/LifePot.png"), 40, 1, { heal: 60 }, "Recupera 60 de vida.");
potion("health_potion_medium", "Poção de Vida Média", img("Potion/Medipack.png"), 120, 15, { heal: 180 }, "Recupera 180 de vida.");
potion("health_potion_large", "Poção de Vida Grande", img("Potion/Heart.png"), 300, 30, { heal: 450 }, "Recupera 450 de vida.");
potion("mana_potion", "Poção de Mana", img("Potion/WaterPot.png"), 45, 1, { mana: 50 }, "Recupera 50 de mana.");
potion("mana_potion_medium", "Poção de Mana Média", img("Potion/WaterPot.png", 0x9a9aff), 130, 15, { mana: 150 }, "Recupera 150 de mana.");
potion("mana_potion_large", "Poção de Mana Grande", img("Potion/MilkPot.png", 0xb070ff), 320, 30, { mana: 400 }, "Recupera 400 de mana.");

/** Comida: estado "alimentado" (regen a cada FOOD_TICK_MS). Sem cura instantânea; recarga própria de 1 s. */
export const FOOD_TICK_MS = 2000;
/** Máximo de tempo "alimentado" acumulado (comer estende, até este teto). */
export const FOOD_MAX_MS = 20 * 60_000;

const food = (id: string, name: string, icon: ItemIcon, value: number, level: number | undefined, hp: number, mana: number, minutes: number, description: string): void =>
  add({
    id, name, kind: "food", stackable: true, value, ...(level ? { level } : {}),
    use: { food: { hpPerTick: hp, manaPerTick: mana, durationMs: minutes * 60_000 }, cooldownMs: 1000 }, icon, description,
  });
// iniciais (lv 1)
food("nuts", "Nozes", img("Food/Nut.png"), 5, undefined, 1, 1, 3, "Petisco simples. Um pouco de vida e mana.");
food("fish", "Peixe Grelhado", img("Food/Fish.png"), 8, undefined, 2, 0, 3, "Peixe fresco do rio.");
food("meat", "Carne Assada", img("Food/Meat.png"), 12, undefined, 3, 0, 4, "Um pedaço de carne bem passado.");
// foco em mana
food("honey", "Mel", img("Food/Honey.png"), 35, 5, 1, 3, 4, "Doce e revigorante. Favorece a mana.");
food("noodle", "Macarrão", img("Food/Noodle.png"), 60, 10, 2, 4, 6, "Uma tigela quente que acalma a mente.");
food("calamari", "Lula Frita", img("Food/Calamari.png"), 80, 15, 3, 5, 6, "Crocante. Ótima para conjuradores.");
// foco em vida / equilibrados
food("onigiri", "Bolinho de Arroz", img("Food/Onigiri.png"), 45, 5, 4, 3, 5, "Leve e nutritivo. Equilibrado.");
food("beaf", "Bife", img("Food/Beaf.png"), 75, 10, 6, 1, 6, "Bife suculento para guerreiros.");
food("yakitori", "Yakitori", img("Food/Yakitori.png"), 120, 15, 7, 2, 8, "Espetinho defumado. Muita vida.");
// premium (lv 20)
food("sushi", "Banquete de Sushi", img("Food/Sushi.png"), 200, 20, 8, 8, 10, "Refeição de gala. Vida e mana em abundância.");

// ---------------------------------------------------------------------------
// Materiais de monstros (vendáveis) e gemas
// ---------------------------------------------------------------------------
const mat = (id: string, name: string, icon: ItemIcon, value: number, description: string, maxStack = 100): void =>
  add({ id, name, kind: "material", stackable: true, maxStack, value, icon, description });
mat("cheese", "Queijo", matIcon("cheese"), 10, "Um pedaço de queijo mordiscado. Ratos adoram.");
mat("slime_goo", "Gosma", matIcon("slime_goo"), 12, "Gosma verde e viscosa.");
mat("herb", "Erva Medicinal", matIcon("herb"), 15, "Erva usada em poções e unguentos.");
mat("branch", "Galho Seco", img("Resource/Branch.png"), 5, "Um galho seco. Serve de lenha.");
mat("bee_sting", "Ferrão de Abelha", matIcon("bee_sting"), 15, "Pequeno, afiado e irritante.");
mat("wolf_pelt", "Couro de Lobo", matIcon("wolf_pelt"), 40, "Pele grossa de lobo. Curtumes pagam bem.");
mat("wolf_fang", "Presa de Lobo", matIcon("wolf_fang"), 30, "Presa afiada de lobo.");
mat("snake_skin", "Pele de Cobra", matIcon("snake_skin"), 55, "Pele escamosa de cobra.");
mat("spider_silk", "Seda de Aranha", matIcon("spider_silk"), 70, "Fios resistentes de seda.");
mat("spider_eye", "Olho de Aranha", matIcon("spider_eye"), 90, "Brilha no escuro. Ingrediente de poções.");
mat("bat_wing", "Asa de Morcego", matIcon("bat_wing"), 85, "Asa membranosa de morcego.");
mat("bone", "Osso", matIcon("bone"), 50, "Osso antigo de um esqueleto.");
mat("goblin_tooth", "Dente de Goblin", matIcon("goblin_tooth"), 110, "Dente amarelado de goblin.");
mat("iron_bar", "Barra de Ferro", img("Resource/BarIron.png"), 200, "Ferro bruto. Ferreiros compram.");
mat("ectoplasm", "Ectoplasma", matIcon("ectoplasm"), 180, "Resíduo gelado deixado por fantasmas.");
mat("lizard_scale", "Escama de Lagarto", matIcon("lizard_scale"), 250, "Escama dura e esverdeada.");
mat("ember", "Brasa Eterna", matIcon("ember"), 300, "Brasa que nunca se apaga.");
mat("gem_green", "Esmeralda", img("Resource/GemGreen.png"), 400, "Gema verde lapidada.", 50);
mat("gem_yellow", "Topázio", img("Resource/GemYellow.png"), 600, "Gema amarela lapidada.", 50);
mat("gem_purple", "Ametista", img("Resource/GemPurple.png"), 900, "Gema roxa lapidada.", 50);
mat("mithril_bar", "Barra de Mithril", img("Resource/BarMithril.png"), 2500, "Metal raríssimo azul-esverdeado.", 50);

// Chaves e itens de missão
add({ id: "crypt_key", name: "Chave da Cripta", kind: "key", value: 0, icon: img("Treasure/SilverKey.png"), description: "Abre o portão selado da Cripta. Cai do Lich do Pântano." });
add({ id: "goblin_crown", name: "Coroa do Rei Goblin", kind: "quest", value: 0, icon: img("Treasure/GoldCup.png"), description: "Prova de que o Rei Goblin caiu." });

// ---------------------------------------------------------------------------
// Armas
// ---------------------------------------------------------------------------
type WOpts = { range?: number; kind?: DamageKind; twoHanded?: boolean; stats?: Stats };
const weapon = (id: string, name: string, wt: WeaponType, voc: Vocation, icon: ItemIcon, tier: number, attack: number, value: number, description: string, o: WOpts = {}): void =>
  add({
    id, name, kind: "weapon", slot: "weapon", icon, vocations: [voc], level: TIER_LEVEL[tier - 1], weaponType: wt,
    range: o.range ?? 1, damageKind: o.kind ?? "physical", ...(o.twoHanded ? { twoHanded: true } : {}),
    stats: { attack, ...o.stats }, value, description,
  });
const W = "Weapons/";

// Cavaleiro (corpo a corpo). T1 lv1, T2 lv8, T3 lv15, T4 lv25, T5 lv35.
weapon("short_sword", "Espada Curta", "sword", "knight", img(W + "Sword/Sprite.png"), 1, 9, 60, "Lâmina simples de treino.");
weapon("wooden_club", "Clava de Madeira", "club", "knight", img(W + "Club/Sprite.png"), 1, 8, 45, "Pesada e barata.");
weapon("longsword", "Espada Longa", "sword", "knight", img(W + "Sword2/Sprite.png"), 2, 22, 700, "Equilibrada e confiável.");
weapon("hand_axe", "Machado de Mão", "axe", "knight", img(W + "Axe/Sprite.png"), 2, 24, 750, "Corta fundo, mas é lento de manejar.");
weapon("iron_sword", "Espada de Ferro", "sword", "knight", img(W + "Rapier/Sprite.png", 0xb8c0d0), 3, 36, 3000, "Forjada em ferro de boa qualidade.", { stats: { melee: 1 } });
weapon("war_hammer", "Martelo de Guerra", "club", "knight", img(W + "Hammer/Sprite.png"), 3, 44, 3600, "Esmaga armaduras. Duas mãos.", { twoHanded: true });
weapon("steel_blade", "Lâmina de Aço", "sword", "knight", img(W + "BigSword/Sprite.png", 0xc0d8f0), 4, 52, 11000, "Aço temperado. Presente de mestres ferreiros.", { stats: { melee: 1 } });
weapon("battle_axe", "Machado de Batalha", "axe", "knight", img(W + "Axe/Sprite.png", 0xb0c0d8), 4, 62, 13000, "Enorme e brutal. Duas mãos.", { twoHanded: true });
weapon("mithril_katana", "Katana de Mithril", "sword", "knight", img(W + "Katana/Sprite.png", 0x70f0e0), 5, 70, 38000, "Leve como pluma, afiada como a noite.", { stats: { melee: 2, crit: 2 } });
weapon("dragon_axe", "Machado do Dragão", "axe", "knight", img(W + "Axe/Sprite.png", 0xff6a5a), 5, 84, 46000, "Forjado no sopro de um dragão. Duas mãos.", { twoHanded: true, stats: { melee: 2, crit: 3 } });

// Paladino (arcos, alcance 6, físico, duas mãos).
const BOW = { range: 6, twoHanded: true } as const;
weapon("short_bow", "Arco Curto", "bow", "paladin", img(W + "Bow/Sprite.png"), 1, 8, 70, "Arco de madeira para iniciantes.", BOW);
weapon("hunting_bow", "Arco de Caça", "bow", "paladin", img(W + "Bow2/Sprite.png"), 2, 19, 700, "Silencioso e preciso.", BOW);
weapon("long_bow", "Arco Longo", "bow", "paladin", img(W + "Bow/Sprite.png", 0xd0b070), 3, 32, 3000, "Alcança longe com força.", { ...BOW, stats: { distance: 1 } });
weapon("composite_bow", "Arco Composto", "bow", "paladin", img(W + "Bow2/Sprite.png", 0xb0c0d8), 4, 46, 11000, "Chifre, madeira e tendão.", { ...BOW, stats: { distance: 2 } });
weapon("elven_bow", "Arco Élfico", "bow", "paladin", img(W + "Bow2/Sprite.png", 0x70f0e0), 5, 62, 38000, "Canta quando a corda é solta.", { ...BOW, stats: { distance: 3, crit: 2 } });

// Feiticeiro (varinhas, alcance 4, energia/fogo).
const WAND = { range: 4 } as const;
weapon("apprentice_wand", "Varinha de Aprendiz", "wand", "sorcerer", img(W + "MagicWand/Sprite.png"), 1, 6, 70, "Faísca fraca, mas é um começo.", { ...WAND, kind: "energy" });
weapon("oak_wand", "Varinha de Carvalho", "wand", "sorcerer", img(W + "MagicWand/Sprite.png", 0xd0a060), 2, 15, 700, "Crepita de energia.", { ...WAND, kind: "energy", stats: { magic: 1 } });
weapon("storm_wand", "Varinha da Tempestade", "wand", "sorcerer", img(W + "MagicWand/Sprite.png", 0x80b8ff), 3, 25, 3000, "Raios curtos e nervosos.", { ...WAND, kind: "energy", stats: { magic: 1 } });
weapon("ember_wand", "Varinha Flamejante", "wand", "sorcerer", img(W + "MagicWand/Sprite.png", 0xff8040), 4, 38, 11000, "Quente ao toque.", { ...WAND, kind: "fire", stats: { magic: 2, manaMax: 40 } });
weapon("inferno_wand", "Varinha do Inferno", "wand", "sorcerer", img(W + "MagicWand/Sprite.png", 0xff3030), 5, 52, 38000, "Guarda uma chama que não morre.", { ...WAND, kind: "fire", stats: { magic: 3, manaMax: 80 } });

// Druida (bastões, alcance 4, gelo/terra).
weapon("twig_rod", "Graveto Encantado", "rod", "druid", img(W + "Stick/Sprite.png"), 1, 6, 70, "Um graveto que ainda lembra da floresta.", { ...WAND, kind: "ice" });
weapon("thorn_rod", "Bastão de Espinhos", "rod", "druid", img(W + "Stick/Sprite.png", 0x70c060), 2, 15, 700, "Espinhos que pulsam com a terra.", { ...WAND, kind: "earth", stats: { magic: 1 } });
weapon("frost_rod", "Bastão de Gelo", "rod", "druid", img(W + "Stick/Sprite.png", 0x90d8ff), 3, 25, 3000, "Cristais de gelo no topo.", { ...WAND, kind: "ice", stats: { magic: 1 } });
weapon("moss_rod", "Bastão do Pântano", "rod", "druid", img(W + "Stick/Sprite.png", 0x50a070), 4, 38, 11000, "Cheira a terra úmida.", { ...WAND, kind: "earth", stats: { magic: 2, manaMax: 40 } });
weapon("glacier_rod", "Bastão Glacial", "rod", "druid", img(W + "Stick/Sprite.png", 0xc8f4ff), 5, 52, 38000, "Frio de mil invernos.", { ...WAND, kind: "ice", stats: { magic: 3, manaMax: 80 } });

// ---------------------------------------------------------------------------
// Armaduras
// ---------------------------------------------------------------------------
type Piece = { slot: "helmet" | "armor" | "legs" | "boots" | "shield"; shape: GearShape };
const PIECES: Record<Piece["slot"], GearShape> = { helmet: "helmet_cap", armor: "armor_vest", legs: "legs_pants", boots: "boots", shield: "shield_round" };

interface SetSpec {
  prefix: string;
  tier: number;                  // 1..5 (define o level)
  palette: GearTier;
  names: string[];               // nomes por peça, na ordem de `slots`
  slots: Piece["slot"][];
  shapes: Partial<Record<Piece["slot"], GearShape>>;
  armor: number[];               // armor por peça
  values: number[];
  extra?: Partial<Record<Piece["slot"], Stats>>;
  vocations?: Vocation[];
  level?: number;
  blurb: string;
}
function buildSet(s: SetSpec): void {
  s.slots.forEach((slot, i) => {
    const shape = s.shapes[slot] ?? PIECES[slot];
    const stats: Stats = { ...(s.armor[i] ? { armor: s.armor[i] } : {}), ...(s.extra?.[slot] ?? {}) };
    add({
      id: `${s.prefix}_${slot}`, name: s.names[i]!, kind: slot, slot, icon: gear(shape, s.palette),
      ...(s.vocations ? { vocations: s.vocations } : {}), level: s.level ?? TIER_LEVEL[s.tier - 1], stats, value: s.values[i]!,
      description: s.blurb,
    });
  });
}
const MELEE: Piece["slot"][] = ["helmet", "armor", "legs", "boots", "shield"];
const GEAR4: Piece["slot"][] = ["helmet", "armor", "legs", "boots"];

// Cavaleiro/geral: 5 peças por tier. Armadura total: 3 / 5 / 7 / 10 / 14.
buildSet({ prefix: "leather", tier: 1, palette: "leather", slots: MELEE, shapes: {}, armor: [1, 1, 0, 0, 1], values: [20, 40, 15, 15, 30],
  names: ["Gorro de Couro", "Colete de Couro", "Calças de Couro", "Botas de Couro", "Escudo de Madeira"],
  extra: { legs: { hpMax: 10 }, boots: { speed: 2 }, shield: { shield: 1 } }, blurb: "Equipamento básico de aventureiro." });
buildSet({ prefix: "bronze", tier: 2, palette: "bronze", slots: MELEE, shapes: { helmet: "helmet_full" }, armor: [1, 2, 1, 0, 1], values: [150, 350, 200, 100, 200],
  names: ["Elmo de Bronze", "Armadura de Bronze", "Grevas de Bronze", "Botas de Bronze", "Escudo de Bronze"],
  vocations: ["knight"], extra: { boots: { speed: 3 }, shield: { shield: 2 } }, blurb: "Bronze polido, pesado e confiável." });
buildSet({ prefix: "iron", tier: 3, palette: "iron", slots: MELEE, shapes: { helmet: "helmet_full", armor: "armor_plate", legs: "legs_greaves", shield: "shield_kite" }, armor: [1, 2, 1, 1, 2], values: [650, 1600, 900, 450, 900],
  names: ["Elmo de Ferro", "Peitoral de Ferro", "Grevas de Ferro", "Botas de Ferro", "Escudo de Ferro"],
  vocations: ["knight"], extra: { boots: { speed: 4 }, shield: { shield: 3 } }, blurb: "Ferro forjado para soldados veteranos." });
buildSet({ prefix: "steel", tier: 4, palette: "steel", slots: MELEE, shapes: { helmet: "helmet_horned", armor: "armor_plate", legs: "legs_greaves", shield: "shield_tower" }, armor: [2, 3, 2, 1, 2], values: [2400, 5600, 3200, 1600, 3200],
  names: ["Elmo Cornífero de Aço", "Armadura de Aço", "Grevas de Aço", "Botas de Aço", "Escudo-Torre de Aço"],
  vocations: ["knight"], extra: { boots: { speed: 5 }, shield: { shield: 4 } }, blurb: "Aço azulado, digno de cavaleiros." });
buildSet({ prefix: "mithril", tier: 5, palette: "mithril", slots: MELEE, shapes: { helmet: "helmet_horned", armor: "armor_plate", legs: "legs_greaves", shield: "shield_tower" }, armor: [2, 5, 3, 1, 3], values: [7500, 17500, 10000, 5000, 10000],
  names: ["Elmo de Mithril", "Armadura de Mithril", "Grevas de Mithril", "Botas de Mithril", "Escudo de Mithril"],
  vocations: ["knight"], extra: { boots: { speed: 6 }, shield: { shield: 5 }, helmet: { melee: 1 }, armor: { hpMax: 60 } }, blurb: "Mithril: leve como couro, duro como diamante." });

// Paladino (4 peças, sem escudo: arcos usam as duas mãos). Armadura total 4 / 7.
buildSet({ prefix: "ranger", tier: 2, palette: "iron", slots: GEAR4, shapes: {}, armor: [1, 2, 1, 0], values: [100, 300, 200, 100],
  names: ["Capuz de Patrulheiro", "Colete de Patrulheiro", "Calças de Patrulheiro", "Botas de Patrulheiro"],
  vocations: ["paladin"], extra: { helmet: { distance: 1 }, boots: { speed: 3 } }, blurb: "Leve e silencioso, para quem atira de longe." });
buildSet({ prefix: "sniper", tier: 4, palette: "mithril", slots: GEAR4, shapes: { helmet: "helmet_full", armor: "armor_plate" }, armor: [2, 3, 1, 1], values: [1700, 4800, 3100, 1400],
  names: ["Elmo de Franco-Atirador", "Couraça de Franco-Atirador", "Calças de Franco-Atirador", "Botas de Franco-Atirador"],
  vocations: ["paladin"], extra: { helmet: { distance: 1 }, armor: { distance: 1 }, boots: { speed: 5 } }, blurb: "Camuflagem e proteção para o arqueiro experiente." });

// Magos (sorcerer/druid): 4 peças com manaMax e magic. Armadura total 3 / 4 / 6 / 8.
const MAGE: Vocation[] = ["sorcerer", "druid"];
const mageSet = (prefix: string, tier: number, palette: GearTier, names: string[], armor: number[], values: number[], mana: number[], magic: number[], speed: number): void =>
  buildSet({ prefix, tier, palette, slots: GEAR4, shapes: { helmet: "helmet_wizard", armor: "armor_robe" }, armor, values, vocations: MAGE,
    names, extra: {
      helmet: { manaMax: mana[0]!, ...(magic[0] ? { magic: magic[0] } : {}) }, armor: { manaMax: mana[1]!, ...(magic[1] ? { magic: magic[1] } : {}) },
      legs: { manaMax: mana[2]!, ...(magic[2] ? { magic: magic[2] } : {}) }, boots: { manaMax: mana[3]!, speed },
    }, blurb: "Tecido encantado que amplifica a mana." });
mageSet("apprentice", 2, "leather", ["Chapéu de Aprendiz", "Túnica de Aprendiz", "Calças de Aprendiz", "Sandálias de Aprendiz"], [1, 1, 1, 0], [120, 300, 250, 130], [8, 16, 10, 6], [0, 1, 0, 0], 3);
mageSet("adept", 3, "steel", ["Chapéu de Adepto", "Manto de Adepto", "Calças de Adepto", "Botas de Adepto"], [1, 2, 1, 0], [500, 1400, 1000, 600], [16, 32, 20, 12], [1, 1, 0, 0], 4);
mageSet("arcane", 4, "arcane", ["Chapéu Arcano", "Manto Arcano", "Calças Arcanas", "Botas Arcanas"], [1, 3, 1, 1], [1800, 5200, 3400, 2600], [28, 56, 35, 21], [1, 1, 1, 0], 5);
mageSet("archmage", 5, "gold", ["Chapéu do Arquimago", "Manto do Arquimago", "Calças do Arquimago", "Botas do Arquimago"], [2, 3, 2, 1], [5500, 15000, 9500, 5000], [44, 88, 55, 33], [2, 2, 1, 0], 6);

// ---------------------------------------------------------------------------
// Anéis e amuletos (level 10+)
// ---------------------------------------------------------------------------
const trinket = (id: string, name: string, slot: "ring" | "amulet", tier: GearTier, level: number, stats: Stats, value: number, description: string): void =>
  add({ id, name, kind: slot, slot, icon: gear(slot, tier), level, stats, value, description });
trinket("ring_vigor", "Anel do Vigor", "ring", "bronze", 10, { hpRegen: 1 }, 450, "Acelera a recuperação de vida.");
trinket("ring_mente", "Anel da Mente", "ring", "steel", 15, { manaRegen: 2 }, 800, "Acalma a mente e devolve mana.");
trinket("ring_pressa", "Anel da Pressa", "ring", "gold", 20, { speed: 6 }, 2500, "Seus passos ficam mais rápidos.");
trinket("ring_furia", "Anel da Fúria", "ring", "iron", 25, { crit: 4, melee: 1, distance: 1 }, 5000, "Golpes mais precisos e letais.");
trinket("ring_dragon", "Anel do Dragão", "ring", "dragon", 35, { crit: 5, hpRegen: 2 }, 20000, "Escama de dragão trabalhada em anel.");
trinket("amulet_vida", "Amuleto da Vida", "amulet", "leather", 10, { hpMax: 60 }, 700, "Aumenta a vida máxima.");
trinket("amulet_arcano", "Amuleto Arcano", "amulet", "arcane", 15, { manaMax: 70 }, 900, "Aumenta a mana máxima.");
trinket("amulet_protecao", "Amuleto de Proteção", "amulet", "iron", 20, { armor: 2, hpMax: 40 }, 3000, "Um escudo invisível no peito.");
trinket("amulet_lich", "Amuleto do Lich", "amulet", "arcane", 28, { magic: 2, manaMax: 100 }, 12000, "Arrancado do pescoço do Lich do Pântano.");
trinket("amulet_goblin_king", "Amuleto do Rei Goblin", "amulet", "gold", 38, { armor: 3, hpMax: 150, melee: 2 }, 30000, "Roubado por goblins, usado por um rei.");

/** Catálogo (derivado das listas acima). */
export const ITEMS: Record<string, ItemDef> = Object.fromEntries(ITEM_LIST.map((d) => [d.id, d]));

export const itemDef = (id: string): ItemDef | undefined => (Object.hasOwn(ITEMS, id) ? ITEMS[id] : undefined);
export const isEquipable = (d: ItemDef): boolean => d.slot != null;
