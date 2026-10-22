// Encomenda semanal: o Quadro de Recompensas também pede N de um material específico (não abates), trocando por
// ouro. Geração determinística por semana + faixa (servidor, systems/materialRequest.ts, mesmo esquema de
// systems/bounties.ts). Aqui só o que o cliente precisa pra mostrar.

/** Mesmo NPC do Quadro de Recompensas (bounty_board): o board também posta a encomenda da semana. */
export const REQUEST_NPC = "bounty_board";

/** Faixas de level → materiais possíveis (progressão de raridade/valor, ver items.ts). */
export const REQUEST_BANDS: { minLevel: number; materials: string[] }[] = [
  { minLevel: 1, materials: ["cheese", "slime_goo", "herb", "bee_sting"] },
  { minLevel: 10, materials: ["wolf_pelt", "wolf_fang", "snake_skin"] },
  { minLevel: 18, materials: ["spider_silk", "spider_eye", "bat_wing", "bone"] },
  { minLevel: 26, materials: ["goblin_tooth", "ectoplasm"] },
  { minLevel: 34, materials: ["lizard_scale", "ape_fur", "tarantula_fang"] },
  { minLevel: 42, materials: ["iron_bar", "orc_leather", "croc_leather"] },
  { minLevel: 52, materials: ["gem_green", "minotaur_horn", "winter_fur"] },
  { minLevel: 62, materials: ["gem_yellow", "cyclops_eye", "bonelord_eye", "necro_skull"] },
  { minLevel: 72, materials: ["gem_purple", "dragon_scale", "hero_badge", "ice_shard"] },
  {
    minLevel: 88,
    materials: ["mithril_bar", "magma_core", "hellhound_fang", "demon_horn", "red_dragon_scale", "frost_dragon_scale", "behemoth_claw", "juggernaut_plate", "demonic_essence"],
  },
];

export function requestBand(level: number): number {
  let b = 0;
  for (let i = 0; i < REQUEST_BANDS.length; i++) if (level >= REQUEST_BANDS[i]!.minLevel) b = i;
  return b;
}

export interface MaterialRequestView {
  materialId: string;
  count: number;
  /** Quantas o jogador tem agora na mochila (calculado a cada "list"). */
  have: number;
  gold: number;
  claimed: boolean;
  resetsAt: number;
}
export interface MaterialRequestMsg { request: MaterialRequestView }
export type MaterialRequestActionMsg = { action: "list" } | { action: "turnIn" };
