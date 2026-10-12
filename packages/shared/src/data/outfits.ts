// Roupas (outfits) e addons estilo Tibia. Puramente cosmético: a vocação continua valendo para o resto.
// Arte: base = sheet de personagem do pack Ninja Adventure (64x112, frames 16x16);
// addons = overlays desenhados por tools/addons/generate.mjs (assets/addons/*.png).
import type { Vocation } from "../types.ts";
/** Altura extra (px acima do topo da base) de cada addon — gerado por tools/addons/generate.mjs. */
import { ADDON_EXTRA_TOP as EXTRA_TOP } from "./outfitsExtraTop.ts";

/**
 * Overlays de addon: mesmo layout de grade das sheets de personagem (4 colunas = lados, 7 linhas),
 * mas cada frame tem 32x32 com o frame 16x16 da base em (ADDON_OFFSET_X, ADDON_OFFSET_Y) —
 * a folga deixa chapéus passarem acima da cabeça e cajados/capas saírem do contorno.
 */
export const ADDON_FRAME = 32;
export const ADDON_OFFSET_X = 8;
export const ADDON_OFFSET_Y = 12;

export interface AddonDef {
  /** Único no catálogo inteiro (vira nome de arquivo). */
  id: string;
  /** Nome PT-BR. */
  name: string;
  /** Overlay desenhado POR CIMA da base (relativo a assets/). */
  sheet: string;
  /** Overlay desenhado ATRÁS da base (capas/aljavas vistas de frente), se houver. */
  backSheet?: string;
  /** Quantos px o addon sobe acima do topo da base (para o nome/barra de HP não ficarem por cima). */
  extraTop: number;
}

export interface OutfitDef {
  id: string;
  name: string;
  /** Sheet base (relativo a assets/), 64x112. Pode ser gerada (tools/addons) a partir de uma sheet do pack. */
  sheet: string;
  /** Retrato 38x38 (ausente = Faceset.png ao lado da sheet). */
  faceset?: string;
  /** Addon 1 (bit 1) e addon 2 (bit 2). */
  addons: [AddonDef, AddonDef];
  /**
   * Gancho futuro (conquistas): hoje tudo é liberado (ver isOutfitUnlocked).
   * Ex.: { outfit?: "achievement:x", addon1?: "...", addon2?: "..." }
   */
  unlock?: { outfit?: string; addon1?: string; addon2?: string };
}

const C = "ninja/Actor/Character/";
const A = "addons/";

function addon(id: string, name: string, back = false): AddonDef {
  return { id, name, sheet: `${A}${id}.png`, ...(back ? { backSheet: `${A}${id}_back.png` } : {}), extraTop: EXTRA_TOP[id] ?? 0 };
}

function outfit(id: string, name: string, sheetName: string, a1: AddonDef, a2: AddonDef): OutfitDef {
  return { id, name, sheet: `${C}${sheetName}/SpriteSheet.png`, addons: [a1, a2] };
}

/** Catálogo (ordem = ordem na janela de roupas). */
export const OUTFIT_LIST: OutfitDef[] = [
  outfit("cidadao", "Cidadão", "Villager4", addon("cidadao_chapeu", "Chapéu com pena"), addon("cidadao_mochila", "Mochila de viagem", true)),
  outfit("cacador", "Caçador", "Hunter", addon("cacador_chapeu", "Chapéu de caçador"), addon("cacador_aljava", "Aljava", true)),
  // Mago: sheet gerada (Master com túnica azul-violeta e barba longa permanente) — tools/addons/generate.mjs
  { ...outfit("mago", "Mago", "Master", addon("mago_chapeu", "Chapéu de mago"), addon("mago_cajado", "Cajado arcano")),
    sheet: `${A}base_mago.png`, faceset: `${A}base_mago_face.png` },
  outfit("cavaleiro", "Cavaleiro", "Knight", addon("cavaleiro_pluma", "Pluma do elmo"), addon("cavaleiro_escudo", "Escudo nas costas", true)),
  outfit("nobre", "Nobre", "Noble", addon("nobre_capa", "Capa de nobre", true), addon("nobre_pena", "Pena no chapéu")),
  outfit("invocador", "Invocador", "SorcererOrange", addon("invocador_diadema", "Diadema"), addon("invocador_orbe", "Orbe flutuante")),
  outfit("guerreiro", "Guerreiro", "RedNinja3", addon("guerreiro_asas", "Elmo alado", true), addon("guerreiro_machado", "Machado de guerra")),
  outfit("barbaro", "Bárbaro", "Caveman", addon("barbaro_elmo", "Elmo de chifres", true), addon("barbaro_clava", "Clava cravejada")),
  outfit("druida", "Druida", "Shaman", addon("druida_coroa", "Coroa de folhas"), addon("druida_cajado", "Cajado de galho")),
  outfit("bruxo", "Bruxo", "NinjaMageBlack", addon("bruxo_manto", "Manto sombrio", true), addon("bruxo_cajado", "Cajado de caveira")),
  outfit("oriental", "Oriental", "Sultan2", addon("oriental_joia", "Joia do turbante"), addon("oriental_cimitarra", "Cimitarra")),
  outfit("pirata", "Pirata", "FighterWhite", addon("pirata_chapeu", "Chapéu de pirata"), addon("pirata_papagaio", "Papagaio")),
  outfit("assassino", "Assassino", "NinjaDark", addon("assassino_cachecol", "Cachecol", true), addon("assassino_katana", "Katana nas costas", true)),
];

export const OUTFITS: Record<string, OutfitDef> = Object.fromEntries(OUTFIT_LIST.map((o) => [o.id, o]));

/** Roupa padrão de cada vocação (personagens novos e antigos sem o campo). */
export const DEFAULT_OUTFIT: Record<Vocation, string> = {
  knight: "cavaleiro",
  paladin: "cacador",
  sorcerer: "mago",
  druid: "druida",
};

/** Bits de addon: 1 = addon 1, 2 = addon 2. */
export const ADDON_BITS = 3;

export function outfitDef(id: string | undefined | null): OutfitDef | undefined {
  return id ? OUTFITS[id] : undefined;
}

export function defaultOutfit(vocation: string): string {
  return DEFAULT_OUTFIT[vocation as Vocation] ?? DEFAULT_OUTFIT.knight;
}

/** Roupa válida para exibir (fallback = padrão da vocação). */
export function resolveOutfit(outfit: string | undefined | null, vocation: string): OutfitDef {
  return outfitDef(outfit) ?? OUTFITS[defaultOutfit(vocation)];
}

/** Addons ativos de uma máscara (ordem: addon 1, addon 2). */
export function activeAddons(o: OutfitDef, bits: number): AddonDef[] {
  return o.addons.filter((_, i) => (bits & (1 << i)) !== 0);
}
