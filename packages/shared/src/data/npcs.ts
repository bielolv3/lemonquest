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
        // tier 3 (lv 15): só armas — depois que o punho deixou de acompanhar o level, a arma do tier importa e a de
        // tier 3 não caía de nenhum monstro para cavaleiro e feiticeiro.
        "iron_sword", "war_hammer", "long_bow", "storm_wand", "frost_rod",
        // tier 4 (lv 25): destino para o ouro que sobra a partir do lv 20 (11–13 mil: ~1–2 h de jogo). O tier 5 continua
        // só no loot, nos chefes e nos baús.
        "steel_blade", "battle_axe", "composite_bow", "ember_wand", "moss_rod",
        "steel_helmet", "steel_armor", "steel_legs", "steel_boots", "steel_shield",
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
      sells: sells("short_bow", "hunting_bow", "long_bow", "composite_bow", "ranger_helmet", "ranger_armor", "ranger_legs", "ranger_boots",
        "hunter_helmet", "hunter_armor", "hunter_legs", "hunter_boots", "sniper_helmet", "sniper_armor", "sniper_legs", "sniper_boots",
        "health_potion", "meat", "fish", "beaf", "yakitori", "fishing_rod"),
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
        "apprentice_wand", "oak_wand", "storm_wand", "twig_rod", "thorn_rod", "frost_rod",
        "apprentice_helmet", "apprentice_armor", "apprentice_legs", "apprentice_boots",
        "adept_helmet", "adept_armor", "adept_legs", "adept_boots",
        "ember_wand", "moss_rod", "arcane_helmet", "arcane_armor", "arcane_legs", "arcane_boots",
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
    greeting: "Cartazes novos todos os dias às 6h: três recompensas por cabeças de monstros, pagas em ouro, experiência e um Baú de Recompensa.",
    idleLines: [
      "Procura-se: aventureiros corajosos.",
      "Recompensas novas todo dia às 6h!",
      "Paga-se bem por cabeças de monstros.",
    ],
  },
  arena_master: {
    id: "arena_master", name: "Mestre do Coliseu", sprite: C + "RedGladiator/SpriteSheet.png",
    greeting: "Bem-vindo ao Coliseu! Forme seu grupo, escolha uma arena e enfrente as ondas de monstros. Quanto mais longe for, maior a glória.",
    idleLines: [
      "Sangue, areia e glória! Quem entra no Coliseu?",
      "Grupos formados rendem mais glória. Chame seus amigos!",
      "Cada onda é mais feroz que a anterior.",
    ],
  },
  arena_shop_1: {
    id: "arena_shop_1", name: "Vendedor do Coliseu", sprite: C + "GladiatorBlue/SpriteSheet.png",
    greeting: "Respire fundo, guerreiro! Poções e comida para a próxima onda.",
    shop: {
      sells: sells("health_potion", "health_potion_medium", "health_potion_large", "mana_potion", "mana_potion_medium", "mana_potion_large", "meat", "honey", "onigiri"),
    },
    idleLines: ["Reponha as forças antes da próxima onda!", "Poção na mão, vitória no coração."],
  },
  arena_shop_2: {
    id: "arena_shop_2", name: "Vendedor do Coliseu", sprite: C + "GladiatorBlue/SpriteSheet.png",
    greeting: "Respire fundo, guerreiro! Poções e comida para a próxima onda.",
    shop: {
      sells: sells("health_potion", "health_potion_medium", "health_potion_large", "mana_potion", "mana_potion_medium", "mana_potion_large", "meat", "honey", "onigiri"),
    },
    idleLines: ["Reponha as forças antes da próxima onda!", "Poção na mão, vitória no coração."],
  },
  arena_shop_3: {
    id: "arena_shop_3", name: "Vendedor do Coliseu", sprite: C + "GladiatorBlue/SpriteSheet.png",
    greeting: "Respire fundo, guerreiro! Poções e comida para a próxima onda.",
    shop: {
      sells: sells("health_potion", "health_potion_medium", "health_potion_large", "mana_potion", "mana_potion_medium", "mana_potion_large", "meat", "honey", "onigiri"),
    },
    idleLines: ["Reponha as forças antes da próxima onda!", "Poção na mão, vitória no coração."],
  },
  arena_shop_4: {
    id: "arena_shop_4", name: "Vendedor do Coliseu", sprite: C + "GladiatorBlue/SpriteSheet.png",
    greeting: "Respire fundo, guerreiro! Poções e comida para a próxima onda.",
    shop: {
      sells: sells("health_potion", "health_potion_medium", "health_potion_large", "mana_potion", "mana_potion_medium", "mana_potion_large", "meat", "honey", "onigiri"),
    },
    idleLines: ["Reponha as forças antes da próxima onda!", "Poção na mão, vitória no coração."],
  },
  // ---- Posto da Fronteira (Terras Selvagens, zona protegida no meio da expansão leste)
  frontier_priest: {
    id: "frontier_priest", name: "Irmão Tadeu", sprite: C + "Monk/SpriteSheet.png",
    greeting: "Você chegou às Terras Selvagens. Daqui para frente, só os fortes voltam. Descanse enquanto pode.",
    idleLines: [
      "Ao norte, os orcs. Ao sul, os dragões. E lá embaixo... nem quero pensar.",
      "Dizem que Orshabaal acorda quando o Abismo fica em silêncio.",
      "Rezei por um grupo que desceu ao Labirinto. Só um voltou.",
    ],
  },
  frontier_trader: {
    id: "frontier_trader", name: "Hanna, a Mascate", sprite: C + "Woman/SpriteSheet.png",
    greeting: "Poções fortes e comida quente! E compro tudo o que você arrancar dos monstros daqui.",
    shop: {
      sells: sells(
        "health_potion_medium", "health_potion_large", "mana_potion_medium", "mana_potion_large",
        "meat", "beaf", "yakitori", "calamari", "sushi",
      ),
      buys: ["weapon", "shield", "helmet", "armor", "legs", "boots", "ring", "amulet", "material", "food", "potion"],
    },
    idleLines: [
      "Escama de dragão? Pago bem! Chifre de demônio? Pago melhor!",
      "Poção grande é a melhor amiga de quem caça ciclope.",
      "Trouxe presunto de dragão? Isso aqui é uma iguaria!",
    ],
  },
  frontier_depot: {
    id: "frontier_depot", name: "Guarda-Volumes da Fronteira", sprite: C + "OldMan3/SpriteSheet.png", depot: true,
    greeting: "Mesmo baú da vila, sem a viagem. O que vai guardar?",
    idleLines: [
      "Tudo o que você guarda na vila, eu também alcanço.",
      "Mochila pesada demais para o Labirinto? Deixe comigo.",
    ],
  },
  frontier_scout: {
    id: "frontier_scout", name: "Batedora Iara", sprite: C + "Hunter/SpriteSheet.png",
    greeting: "Fortaleza Orc ao noroeste (lv 40+). Labirinto dos Minotauros a oeste (lv 48+). Monte Ciclope ao nordeste (lv 55+). Forte Negro ao sudoeste (lv 65+). Vale dos Dragões ao sul (lv 70+). O Abismo, a leste... só com grupo (lv 90+).",
    idleLines: [
      "Os ciclopes descem dos picos quando neva forte.",
      "Demodras dorme no fundo do vale. Não acorde ele sozinho.",
      "Os olhos malignos veem tudo. Não fique parado no cemitério.",
    ],
  },
};

export const npcDef = (id: string): NpcDef | undefined => (Object.hasOwn(NPCS, id) ? NPCS[id] : undefined);
