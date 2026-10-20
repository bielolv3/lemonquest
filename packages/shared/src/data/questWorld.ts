import { findObjects, objectTile, type TiledMap, type TiledObject } from "../map.ts";

// Quests de mundo no estilo Tibia (dados + regras puras; servidor = autoridade):
// - Baús de quest (objeto "quest_chest" do mapa, prop `chestId`): cada personagem abre UMA vez por grupo. Baús do mesmo
//   grupo são uma escolha ("pegue um dos quatro"): abrir um esvazia os outros para aquele personagem.
// - Portas de level/missão: objetos "portal" com `minLevel`, `quest` (missão concluída) e/ou `chestGroup` (baú aberto).
//   Quem não cumpre bate na porta e volta para o tile de onde veio.
// - Alavancas de grupo (objeto "quest_lever"): com um jogador em cada placa, puxar a alavanca leva todos para a sala da
//   quest e solta os monstros (Aniquilação). As posições (placas, destinos, sala, monstros) vêm do mapa.

export interface QuestChestGroupDef {
  id: string;
  /** Nome da quest (aviso ao abrir e diário). */
  name: string;
  /** Onde fica (dica no diário). */
  where: string;
  minLevel: number;
}

export interface QuestChestDef {
  id: string;
  group: string;
  items?: { itemId: string; count: number }[];
  gold?: number;
  /** Desbloqueio (roupa/addon/título) ao abrir. */
  unlock?: string;
}

export interface QuestLeverDef {
  id: string;
  name: string;
  minLevel: number;
  /** Jogadores necessários (um por placa). */
  players: number;
  /** Ids de MONSTERS soltos na sala, na ordem das posições `spawns` do objeto do mapa. */
  monsters: string[];
}

/** Distância (Chebyshev) para abrir um baú ou puxar uma alavanca. */
export const QUEST_OBJECT_RANGE = 1;

export const QUEST_CHEST_GROUPS: Record<string, QuestChestGroupDef> = {
  banuta_cache: { id: "banuta_cache", name: "O Esconderijo da Selva", where: "Ruínas da Selva de Banuta", minLevel: 25 },
  pirate_treasure: { id: "pirate_treasure", name: "O Tesouro do Barba-Ruiva", where: "Caverna dos Piratas", minLevel: 35 },
  banuta_idol: { id: "banuta_idol", name: "O Ídolo de Banuta", where: "Santuário do Templo de Banuta", minLevel: 40 },
  frost_cache: { id: "frost_cache", name: "O Baú do Yeti", where: "Caverna do Yeti", minLevel: 60 },
  hero_quest: { id: "hero_quest", name: "A Quest dos Heróis", where: "Caverna dos Heróis", minLevel: 65 },
  volcano_summit: { id: "volcano_summit", name: "O Cume do Vulcão", where: "Cratera do Vulcão de Goroma", minLevel: 80 },
  annihilator: { id: "annihilator", name: "A Aniquilação", where: "Cidadela de Ferumbras", minLevel: 100 },
};

const chest = (id: string, group: string, extra: Omit<QuestChestDef, "id" | "group">): QuestChestDef => ({ id, group, ...extra });
const one = (itemId: string, count = 1) => [{ itemId, count }];

export const QUEST_CHESTS: Record<string, QuestChestDef> = Object.fromEntries([
  chest("banuta_cache", "banuta_cache", { gold: 3000, items: [{ itemId: "ring_furia", count: 1 }, { itemId: "gem_green", count: 3 }] }),
  chest("pirate_saber", "pirate_treasure", { items: one("pirate_saber") }),
  chest("pirate_bow", "pirate_treasure", { items: one("corsair_bow") }),
  chest("pirate_wand", "pirate_treasure", { items: one("tide_wand") }),
  chest("pirate_rod", "pirate_treasure", { items: one("coral_rod") }),
  chest("banuta_idol", "banuta_idol", { gold: 5000, items: one("amulet_banuta") }),
  chest("frost_ring", "frost_cache", { items: one("frost_ring") }),
  chest("frost_might", "frost_cache", { items: one("ring_might") }),
  chest("frost_amulet", "frost_cache", { items: one("amulet_dragon") }),
  chest("hero_sword", "hero_quest", { items: one("fire_sword") }),
  chest("hero_bow", "hero_quest", { items: one("royal_crossbow") }),
  chest("hero_wand", "hero_quest", { items: one("starstorm_wand") }),
  chest("hero_rod", "hero_quest", { items: one("northwind_rod") }),
  chest("volcano_summit", "volcano_summit", { gold: 10000, items: one("boots_haste") }),
  chest("anni_armor", "annihilator", { items: one("demon_armor"), unlock: "title:aniquilador" }),
  chest("anni_sword", "annihilator", { items: one("magic_longsword"), unlock: "title:aniquilador" }),
  chest("anni_axe", "annihilator", { items: one("stonecutter_axe"), unlock: "title:aniquilador" }),
  chest("anni_bear", "annihilator", { items: one("annihilation_bear"), gold: 50000, unlock: "title:aniquilador" }),
].map((c) => [c.id, c]));

export const QUEST_LEVERS: Record<string, QuestLeverDef> = {
  annihilator: { id: "annihilator", name: "A Aniquilação", minLevel: 100, players: 4, monsters: ["demon", "demon", "demon", "demon", "demon", "demon"] },
};

export const questChestDef = (id: string): QuestChestDef | undefined => (Object.hasOwn(QUEST_CHESTS, id) ? QUEST_CHESTS[id] : undefined);
export const questChestGroup = (id: string): QuestChestGroupDef | undefined => (Object.hasOwn(QUEST_CHEST_GROUPS, id) ? QUEST_CHEST_GROUPS[id] : undefined);
export const questLeverDef = (id: string): QuestLeverDef | undefined => (Object.hasOwn(QUEST_LEVERS, id) ? QUEST_LEVERS[id] : undefined);

/** Requisitos de uma porta (props do objeto "portal"). */
export interface DoorRequirement { minLevel?: number; quest?: string; chestGroup?: string }

/**
 * Motivo de uma porta não abrir (PT-BR) ou null se pode passar. `questName` resolve o nome da missão exigida.
 */
export function doorBlockReason(
  req: DoorRequirement, level: number, questDone: (id: string) => boolean, chestDone: (group: string) => boolean,
  questName: (id: string) => string = (id) => id,
): string | null {
  if (req.minLevel && level < req.minLevel) return `A porta não se mexe. Só aventureiros de level ${req.minLevel} ou mais podem passar.`;
  if (req.quest && !questDone(req.quest)) return `A porta está selada. Conclua a missão "${questName(req.quest)}" para passar.`;
  if (req.chestGroup && !chestDone(req.chestGroup)) return `A porta está selada. Conclua "${questChestGroup(req.chestGroup)?.name ?? req.chestGroup}" para passar.`;
  return null;
}

// ---------------------------------------------------------------------------
// Leitura das props do mapa (servidor e cliente)
// ---------------------------------------------------------------------------

/** "x,y;x,y" → pontos. Entradas inválidas são ignoradas. */
export function parsePoints(s: unknown): { x: number; y: number }[] {
  if (typeof s !== "string") return [];
  return s.split(";").map((p) => p.split(",").map(Number)).filter((a) => a.length === 2 && a.every(Number.isInteger)).map(([x, y]) => ({ x: x!, y: y! }));
}

/** "x0,y0,x1,y1" → retângulo de tiles (inclusivo) ou null. */
export function parseRect(s: unknown): { x0: number; y0: number; x1: number; y1: number } | null {
  if (typeof s !== "string") return null;
  const a = s.split(",").map(Number);
  if (a.length !== 4 || !a.every(Number.isInteger)) return null;
  return { x0: a[0]!, y0: a[1]!, x1: a[2]!, y1: a[3]! };
}

const prop = (o: TiledObject, name: string): unknown => o.properties?.find((p) => p.name === name)?.value;

/** Baú ou alavanca de quest no mapa (o desenho vem do próprio mapa; o tile é bloqueado). */
export interface QuestObjectSpot { kind: "chest" | "lever"; id: string; x: number; y: number }

export function findQuestObjects(map: TiledMap): QuestObjectSpot[] {
  const out: QuestObjectSpot[] = [];
  for (const [type, kind, key] of [["quest_chest", "chest", "chestId"], ["quest_lever", "lever", "leverId"]] as const) {
    for (const o of findObjects(map, type)) {
      const id = String(prop(o, key) ?? "");
      if (!id || out.some((s) => s.kind === kind && s.id === id)) continue;
      out.push({ kind, id, ...objectTile(o, map.tilewidth) });
    }
  }
  return out;
}

/** Alavanca de grupo no mapa: placas (um jogador em cada), destinos (mesma ordem), sala e posições dos monstros. */
export interface QuestLeverSpot {
  id: string; x: number; y: number;
  plates: { x: number; y: number }[];
  dests: { x: number; y: number }[];
  room: { x0: number; y0: number; x1: number; y1: number };
  spawns: { x: number; y: number }[];
}

export function findQuestLevers(map: TiledMap): QuestLeverSpot[] {
  const out: QuestLeverSpot[] = [];
  for (const o of findObjects(map, "quest_lever")) {
    const id = String(prop(o, "leverId") ?? "");
    const room = parseRect(prop(o, "room"));
    const plates = parsePoints(prop(o, "plates")), dests = parsePoints(prop(o, "dests"));
    if (!id || !room || !plates.length || plates.length !== dests.length) continue;
    out.push({ id, ...objectTile(o, map.tilewidth), plates, dests, room, spawns: parsePoints(prop(o, "spawns")) });
  }
  return out;
}

/** Requisitos de porta das props de um objeto "portal" (ausentes = porta comum). */
export function doorRequirement(o: TiledObject): DoorRequirement | undefined {
  const minLevel = Number(prop(o, "minLevel")) || 0;
  const quest = String(prop(o, "quest") ?? ""), chestGroup = String(prop(o, "chestGroup") ?? "");
  if (!minLevel && !quest && !chestGroup) return undefined;
  return { ...(minLevel ? { minLevel } : {}), ...(quest ? { quest } : {}), ...(chestGroup ? { chestGroup } : {}) };
}
