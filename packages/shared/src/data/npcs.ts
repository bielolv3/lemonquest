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
const C = "ninja/Actor/Character/";
const sells = (...ids: string[]): NpcShopEntry[] => ids.map((itemId) => ({ itemId }));

export const NPCS: Record<string, NpcDef> = {
  shop: {
    id: "shop", name: "Bento, o Mercador", sprite: C + "Noble/SpriteSheet.png",
    greeting: "Bem-vindo! Dê uma olhada nas minhas mercadorias. Compro armas, armaduras e o que você tirar dos monstros.",
    shop: {
      sells: sells(
        "health_potion", "health_potion_medium", "mana_potion", "mana_potion_medium", "nuts", "meat", "fish", "onigiri", "beaf", "sushi",
        // tier 1 (lv 1): todas as vocações
        "short_sword", "wooden_club", "short_bow", "apprentice_wand", "twig_rod",
        "leather_helmet", "leather_armor", "leather_legs", "leather_boots", "leather_shield",
        // tier 2 (lv 8)
        "longsword", "hand_axe", "hunting_bow", "oak_wand", "thorn_rod",
        "bronze_helmet", "bronze_armor", "bronze_legs", "bronze_boots", "bronze_shield",
      ),
      buys: ["weapon", "shield", "helmet", "armor", "legs", "boots", "ring", "amulet", "material"],
    },
    idleLines: [
      "Promoção! Poções de vida pela metade do preço... de ontem.",
      "Esse couro de lobo vale ouro, sabia?",
      "Já viu o preço dessas botas? Roubo é o que não é!",
    ],
  },
  priest: {
    id: "priest", name: "Sacerdotisa Liora", sprite: C + "Monk2/SpriteSheet.png",
    greeting: "A luz te guarde, viajante. Aqui você está a salvo; lá fora, caminhe com cuidado.",
    idleLines: [
      "Que a luz guie seus passos.",
      "Quem cai, levanta. Quem desiste, não.",
      "Rezo por todos que partem para a floresta.",
      "A cripta guarda mais do que ossos...",
    ],
  },
  depot: {
    id: "depot", name: "Guarda-Volumes", sprite: C + "OldMan2/SpriteSheet.png", depot: true,
    greeting: "Precisa guardar algo? Seus pertences ficam seguros comigo.",
    idleLines: [
      "Tudo etiquetado, tudo no lugar.",
      "Mochila cheia? Deixe o peso comigo.",
    ],
  },
  guard_captain: {
    id: "guard_captain", name: "Capitão Rodrigo", sprite: C + "Samurai/SpriteSheet.png",
    greeting: "Mantenha a ordem e a espada afiada. A vila conta com gente como você.",
    idleLines: [
      "Os lobos andam ousados nas últimas semanas.",
      "Sem briga na praça, ouviram?",
      "Dizem que um rei goblin se esconde nas ruínas...",
      "Alerta nos portões! Ah, falso alarme. Foi só um gato.",
    ],
  },
  old_hunter: {
    id: "old_hunter", name: "Velho Caçador Tomé", sprite: C + "Hunter/SpriteSheet.png",
    greeting: "Ah, um novato. Quer aprender a mirar de verdade? Tenho arcos e equipamento de patrulheiro. Compro peles e ossos também.",
    shop: {
      sells: sells("short_bow", "hunting_bow", "ranger_helmet", "ranger_armor", "ranger_legs", "ranger_boots", "health_potion", "meat", "fish", "beaf", "yakitori"),
      buys: ["material", "food"],
    },
    idleLines: [
      "Paciência, garoto. A caça vem a quem espera.",
      "Já abati um urso com um graveto. Bem... quase.",
      "O vento mudou. Chuva à noite.",
    ],
  },
  herbalist: {
    id: "herbalist", name: "Dona Marta, Ervanária", sprite: C + "Princess/SpriteSheet.png",
    greeting: "Ervas, poções e mantos para quem estuda a magia. O que procura, meu bem?",
    shop: {
      sells: sells(
        "health_potion", "health_potion_medium", "mana_potion", "mana_potion_medium", "honey", "noodle", "calamari",
        "apprentice_wand", "oak_wand", "twig_rod", "thorn_rod",
        "apprentice_helmet", "apprentice_armor", "apprentice_legs", "apprentice_boots",
        "adept_helmet", "adept_armor", "adept_legs", "adept_boots",
      ),
      buys: ["material", "potion", "food"],
    },
    idleLines: [
      "Erva-doce para a tosse, erva-azeda para o mau humor.",
      "Gosma de slime? Ótima para unguentos!",
      "Cuidado com as abelhas: o mel compensa, o ferrão não.",
    ],
  },
  bounty_board: {
    id: "bounty_board", name: "Quadro de Recompensas", sprite: C + "Inspector/SpriteSheet.png",
    greeting: "Em breve, recompensas por cabeças de monstros serão afixadas aqui. Volte mais tarde!",
    idleLines: [
      "Em breve: recompensas!",
      "Procura-se: aventureiros corajosos.",
    ],
  },
};

export const npcDef = (id: string): NpcDef | undefined => NPCS[id];
