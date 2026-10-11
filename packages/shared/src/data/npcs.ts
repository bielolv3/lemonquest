/** NPCs. O `id` bate com a propriedade `npcId` dos objetos "npc" do mapa (assets/maps/world.json). */
export interface NpcShopEntry {
  itemId: string;
  /** Preço de venda ao jogador (ausente = ItemDef.value). */
  price?: number;
}

export interface NpcDef {
  id: string;
  name: string;              // PT-BR
  /** Sprite de personagem do pack (sheet 64x112 no layout dos jogadores), relativo a assets/. */
  sprite: string;
  greeting: string;          // fala ao abrir
  /** Loja: o que vende; `buys` = tipos de item que compra (ausente = não compra). */
  shop?: { sells: NpcShopEntry[]; buys?: ("weapon" | "shield" | "helmet" | "armor" | "legs" | "boots" | "ring" | "amulet" | "potion" | "material" | "food")[] };
  depot?: boolean;
  /** Falas aleatórias que aparecem sobre a cabeça de vez em quando (ambientação). */
  idleLines?: string[];
}

/** Distância máxima (Chebyshev, em tiles) para interagir com um NPC. */
export const NPC_RANGE = 3;

/** Catálogo. O agente de conteúdo completa (shop, priest, depot, guard_captain, old_hunter, herbalist, bounty_board). */
export const NPCS: Record<string, NpcDef> = {
  shop: {
    id: "shop", name: "Bento, o Mercador", sprite: "ninja/Actor/Character/Noble/SpriteSheet.png",
    greeting: "Bem-vindo! Dê uma olhada nas minhas mercadorias.",
    shop: { sells: [{ itemId: "health_potion" }], buys: ["weapon", "shield", "helmet", "armor", "legs", "boots", "ring", "amulet", "material"] },
  },
};

export const npcDef = (id: string): NpcDef | undefined => NPCS[id];
