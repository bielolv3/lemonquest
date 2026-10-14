import type { DamageKind, Vocation } from "../types.ts";

/** Condições (buffs/debuffs). Os ids batem com o catálogo visual do HUD (ui/hud/conditions.ts). */
export type ConditionId =
  | "combat" | "poison" | "burn" | "energy" | "bleed" | "freeze"
  | "protect" | "haste" | "slow" | "drunk" | "regen" | "pz"
  | "manashield" | "rooted" | "taunted" | "fed";

/** Fórmula de magia (estilo Tibia): valor = base + level*perLevel + magicLevel*perMagic, ±variance. */
export interface SpellFormula {
  base: number;
  perLevel: number;
  perMagic: number;
  /** Variação relativa, ex.: 0.2 = ±20%. */
  variance: number;
}

export type SpellTarget =
  | "self"          // só o conjurador
  | "target"        // criatura alvo atual (precisa de alvo e alcance)
  | "area_self"     // área centrada no conjurador (raio `radius`)
  | "area_target"   // área centrada no alvo atual (raio `radius`, alcance `range`)
  | "wave"          // cone/onda à frente do conjurador (comprimento `length`, largura máx. `width`)
  | "party";        // conjurador + jogadores num raio `radius` (cura em grupo)

/** Chave visual: o cliente escolhe partículas/projéteis/sons por ela. */
export type SpellFx =
  | "fire" | "ice" | "energy" | "earth" | "holy" | "death" | "physical"
  | "heal" | "buff" | "arrow" | "summon" | "taunt" | "root" | "charge";

export interface SpellDef {
  id: string;
  name: string;            // PT-BR
  words: string;           // palavras mágicas digitadas no chat (ex.: "exura"), minúsculas
  /** Vocações que podem conjurar (várias nas curas comuns). */
  vocations: Vocation[];
  level: number;           // level mínimo
  /** Mana base (no level 1). O custo real no level L é `spellMana(def, L)`. */
  mana: number;
  /** Mana extra por level do conjurador (opcional; padrão 0 = custo fixo). */
  manaPerLevel?: number;
  /** Teto do custo de mana quando há `manaPerLevel`. */
  manaMax?: number;
  cooldownMs: number;
  /** Também dispara o cooldown global de magias (GLOBAL_SPELL_COOLDOWN_MS). Padrão true. */
  global?: boolean;
  target: SpellTarget;
  range?: number;          // para "target"/"area_target"
  radius?: number;         // para áreas e "party"
  length?: number;         // para "wave"
  width?: number;          // para "wave"
  damage?: SpellFormula & { kind: DamageKind };
  heal?: SpellFormula;
  /** Condição aplicada: em "self"/"party" vai nos aliados; nos demais, nos alvos atingidos. */
  condition?: { id: ConditionId; durationMs: number; value?: number };
  /** Investida (cavaleiro): anda até `range` tiles na direção do alvo antes do golpe. */
  dash?: boolean;
  /** Invocação (druida): monstro aliado temporário. */
  summon?: { monsterId: string; count: number; durationMs: number };
  /** Provocar: monstros na área passam a atacar o conjurador. */
  taunt?: boolean;
  fx: SpellFx;
  description: string;     // PT-BR, curta, para tooltip
}

export const GLOBAL_SPELL_COOLDOWN_MS = 1000;

/** Custo de mana da magia para um conjurador de `level` (base + manaPerLevel*level, arredondado, limitado a manaMax). */
export function spellMana(s: Pick<SpellDef, "mana" | "manaPerLevel" | "manaMax">, level: number): number {
  const raw = s.mana + (s.manaPerLevel ?? 0) * Math.max(0, level);
  return Math.round(s.manaMax != null ? Math.min(raw, s.manaMax) : raw);
}

/**
 * Catálogo: 6-7 magias por vocação (uma única cura própria "exura" para todas; druida ainda tem a cura em grupo "exura mas sio"). Palavras únicas (ver tabela no fim do arquivo).
 * Valor esperado = base + level*perLevel + magicLevel*perMagic (magicLevel estimado no spells.test.ts).
 */
export const SPELLS: Record<string, SpellDef> = {
  // ------------------------------------------------------------------ CURA ÚNICA (todas as vocações)
  light_heal: {
    id: "light_heal", name: "Cura", words: "exura", vocations: ["knight", "paladin", "sorcerer", "druid"], level: 1, mana: 20, manaPerLevel: 1.5, manaMax: 70, cooldownMs: 1000,
    target: "self", heal: { base: 22, perLevel: 2.2, perMagic: 0.45, variance: 0.15 }, fx: "heal",
    description: "Cura uma parte da sua vida. Cresce com o level e, principalmente para magos, com o magic level. O custo de mana sobe com o level.",
  },

  // ------------------------------------------------------------------ CAVALEIRO (tank corpo a corpo)
  spin_strike: {
    id: "spin_strike", name: "Golpe Giratório", words: "exori", vocations: ["knight"], level: 1, mana: 8, cooldownMs: 4000,
    target: "area_self", radius: 1, damage: { kind: "physical", base: 16, perLevel: 1.4, perMagic: 2, variance: 0.2 }, fx: "physical",
    description: "Gira a arma e atinge todos os inimigos ao seu redor.",
  },
  provoke: {
    id: "provoke", name: "Provocar", words: "exeta res", vocations: ["knight"], level: 5, mana: 15, cooldownMs: 20_000,
    target: "area_self", radius: 3, taunt: true, condition: { id: "taunted", durationMs: 5000 }, fx: "taunt",
    description: "Um brado que força os monstros próximos a atacar você.",
  },
  charge: {
    id: "charge", name: "Investida", words: "exori hur", vocations: ["knight"], level: 10, mana: 20, cooldownMs: 8000,
    target: "target", range: 4, dash: true, damage: { kind: "physical", base: 20, perLevel: 2, perMagic: 3, variance: 0.2 }, fx: "charge",
    description: "Avança sobre o alvo e o atinge com força.",
  },
  iron_skin: {
    id: "iron_skin", name: "Pele de Ferro", words: "utamo tempo", vocations: ["knight"], level: 15, mana: 20, cooldownMs: 30_000,
    target: "self", condition: { id: "protect", durationMs: 10_000, value: 30 }, fx: "buff",
    description: "Reduz em 30% o dano recebido por 10 segundos.",
  },
  brutal_strike: {
    id: "brutal_strike", name: "Golpe Brutal", words: "exori gran", vocations: ["knight"], level: 30, mana: 45, cooldownMs: 8000,
    target: "target", range: 1, damage: { kind: "physical", base: 40, perLevel: 4, perMagic: 4, variance: 0.2 }, fx: "physical",
    description: "Um golpe devastador no alvo à sua frente.",
  },

  // ------------------------------------------------------------------ PALADINO (à distância)
  piercing_arrow: {
    id: "piercing_arrow", name: "Flecha Perfurante", words: "exori con", vocations: ["paladin"], level: 1, mana: 8, cooldownMs: 2000,
    target: "target", range: 6, damage: { kind: "physical", base: 13, perLevel: 1, perMagic: 2, variance: 0.2 }, fx: "arrow",
    description: "Dispara uma flecha certeira contra o alvo.",
  },
  swift_feet: {
    id: "swift_feet", name: "Pés Ligeiros", words: "utani hur", vocations: ["paladin"], level: 5, mana: 20, cooldownMs: 30_000,
    target: "self", condition: { id: "haste", durationMs: 8000, value: 30 }, fx: "buff",
    description: "Aumenta sua velocidade de movimento em 30% por 8 segundos.",
  },
  arrow_rain: {
    id: "arrow_rain", name: "Chuva de Flechas", words: "exevo mas con", vocations: ["paladin"], level: 15, mana: 35, cooldownMs: 6000,
    target: "area_target", range: 6, radius: 2, damage: { kind: "physical", base: 12, perLevel: 1.8, perMagic: 2.5, variance: 0.2 }, fx: "arrow",
    description: "Uma saraivada de flechas cai sobre a área ao redor do alvo.",
  },
  holy_arrow: {
    id: "holy_arrow", name: "Flecha Sagrada", words: "exori san", vocations: ["paladin"], level: 20, mana: 30, cooldownMs: 4000,
    target: "target", range: 6, damage: { kind: "holy", base: 25, perLevel: 3, perMagic: 3.5, variance: 0.2 }, fx: "holy",
    description: "Uma flecha banhada em luz sagrada.",
  },
  holy_wave: {
    id: "holy_wave", name: "Onda Sagrada", words: "exevo mas san", vocations: ["paladin"], level: 30, mana: 90, cooldownMs: 8000,
    target: "area_self", radius: 3, damage: { kind: "holy", base: 20, perLevel: 3, perMagic: 3, variance: 0.2 }, fx: "holy",
    description: "Libera uma onda de luz sagrada que fere tudo ao redor.",
  },

  // ------------------------------------------------------------------ FEITICEIRO (AoE mágico)
  fireball: {
    id: "fireball", name: "Bola de Fogo", words: "exori flam", vocations: ["sorcerer"], level: 1, mana: 8, cooldownMs: 2000,
    target: "target", range: 5, damage: { kind: "fire", base: 11, perLevel: 0.6, perMagic: 2.5, variance: 0.2 }, fx: "fire",
    description: "Lança uma bola de fogo contra o alvo.",
  },
  energy_wave: {
    id: "energy_wave", name: "Onda de Energia", words: "exevo vis lux", vocations: ["sorcerer"], level: 5, mana: 20, cooldownMs: 4000,
    target: "wave", length: 4, width: 3, damage: { kind: "energy", base: 14, perLevel: 1.5, perMagic: 2.5, variance: 0.2 }, fx: "energy",
    description: "Uma onda de energia varre os inimigos à sua frente.",
  },
  fire_burst: {
    id: "fire_burst", name: "Explosão de Fogo", words: "exevo mas flam", vocations: ["sorcerer"], level: 10, mana: 40, cooldownMs: 6000,
    target: "area_target", range: 5, radius: 2, damage: { kind: "fire", base: 10, perLevel: 1.5, perMagic: 2.5, variance: 0.2 },
    condition: { id: "burn", durationMs: 4000, value: 4 }, fx: "fire",
    description: "Explode o alvo e a área ao redor, deixando os atingidos em chamas.",
  },
  mana_shield: {
    id: "mana_shield", name: "Escudo de Mana", words: "utamo vita", vocations: ["sorcerer"], level: 15, mana: 30, cooldownMs: 30_000,
    target: "self", condition: { id: "manashield", durationMs: 20_000 }, fx: "buff",
    description: "Por 20 segundos, o dano recebido consome mana antes da vida.",
  },
  energy_beam: {
    id: "energy_beam", name: "Raio de Energia", words: "exori vis", vocations: ["sorcerer"], level: 20, mana: 45, cooldownMs: 4000,
    target: "target", range: 5, damage: { kind: "energy", base: 15, perLevel: 2, perMagic: 3, variance: 0.2 }, fx: "energy",
    description: "Um raio concentrado de energia contra um único alvo.",
  },
  inferno: {
    id: "inferno", name: "Inferno", words: "exevo gran mas flam", vocations: ["sorcerer"], level: 30, mana: 160, cooldownMs: 8000,
    target: "area_self", radius: 3, damage: { kind: "fire", base: 30, perLevel: 3, perMagic: 4, variance: 0.2 },
    condition: { id: "burn", durationMs: 5000, value: 6 }, fx: "fire",
    description: "Uma erupção de chamas ao seu redor que incendeia os inimigos.",
  },

  // ------------------------------------------------------------------ DRUIDA (cura e controle)
  // Espelho da Bola de Fogo: sem ela o druida não tinha dano barato até o level 5 (só a Cura e o auto-ataque).
  ice_shard: {
    id: "ice_shard", name: "Lasca de Gelo", words: "exori frigo", vocations: ["druid"], level: 1, mana: 8, cooldownMs: 2000,
    target: "target", range: 5, damage: { kind: "ice", base: 11, perLevel: 0.6, perMagic: 2.5, variance: 0.2 }, fx: "ice",
    description: "Dispara uma lasca de gelo contra o alvo.",
  },
  roots: {
    id: "roots", name: "Raiz", words: "exori tera", vocations: ["druid"], level: 5, mana: 20, cooldownMs: 15_000,
    target: "target", range: 4, damage: { kind: "earth", base: 6, perLevel: 1, perMagic: 2, variance: 0.2 },
    condition: { id: "rooted", durationMs: 3000 }, fx: "root",
    description: "Raízes prendem o alvo no lugar por 3 segundos.",
  },
  ice_rain: {
    id: "ice_rain", name: "Chuva de Gelo", words: "exevo mas frigo", vocations: ["druid"], level: 10, mana: 40, cooldownMs: 6000,
    target: "area_target", range: 5, radius: 2, damage: { kind: "ice", base: 8, perLevel: 1.4, perMagic: 2.4, variance: 0.2 },
    condition: { id: "slow", durationMs: 4000, value: 40 }, fx: "ice",
    description: "Estilhaços de gelo caem na área e deixam os inimigos mais lentos.",
  },
  group_heal: {
    id: "group_heal", name: "Cura em Grupo", words: "exura mas sio", vocations: ["druid"], level: 15, mana: 50, cooldownMs: 8000,
    target: "party", radius: 4, heal: { base: 15, perLevel: 1, perMagic: 2, variance: 0.2 }, fx: "heal",
    description: "Cura você e os aliados num raio de 4 tiles.",
  },
  summon_wolf: {
    id: "summon_wolf", name: "Invocar Lobo", words: "utevo res lupo", vocations: ["druid"], level: 20, mana: 90, cooldownMs: 60_000,
    target: "self", summon: { monsterId: "summoned_wolf", count: 1, durationMs: 60_000 }, fx: "summon",
    description: "Invoca um lobo espiritual que luta ao seu lado por 60 segundos.",
  },
  blizzard: {
    id: "blizzard", name: "Nevasca", words: "exevo gran mas frigo", vocations: ["druid"], level: 30, mana: 150, cooldownMs: 8000,
    target: "area_self", radius: 3, damage: { kind: "ice", base: 25, perLevel: 3, perMagic: 3.8, variance: 0.2 },
    condition: { id: "slow", durationMs: 5000, value: 40 }, fx: "ice",
    description: "Uma nevasca gelada atinge tudo ao redor e desacelera os inimigos.",
  },
};

export const spellDef = (id: string): SpellDef | undefined => (Object.hasOwn(SPELLS, id) ? SPELLS[id] : undefined);

export function spellsFor(vocation: Vocation): SpellDef[] {
  return Object.values(SPELLS).filter((s) => s.vocations.includes(vocation)).sort((a, b) => a.level - b.level);
}

/** Procura a magia pelas palavras (ignora maiúsculas e espaços extras). */
export function spellByWords(text: string): SpellDef | undefined {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  return Object.values(SPELLS).find((s) => s.words === t);
}

/*
 * Tabela de balanceamento (valor esperado no level de desbloqueio; ML estimado: mago 0.75*lvl, paladino lvl/4, cavaleiro lvl/7).
 * Gerada pelo console.table do spells.test.ts. dmg/heal = média por alvo, sem variância.
 *
 * magia                voc       lvl  mana  cd(s)  esperado
 * CURA (todas as vocações; mana = 20 + 1.5*level, máx. 70; cd 1 s; fórmula 22 + 2.2*level + 0.45*ML, ±15%)
 * Cura (exura)          todas    1   ~22     1    lv1 ~24 (16% HP); lv10 mago ~47 (24%) pal ~45 (19%) cav ~44 (16%)
 *                                 lv20 (mana 50): mago ~73 (30%), pal ~68 (20%), cav ~67 (15%)
 *                                 lv30 (mana 65): mago ~98 (33%), pal ~91 (21%), cav ~90 (15%)
 *                                 (antes: 22 + 2*level + 1.8*ML → mago 36% no lv20 e 41% no lv30)
 * Cura em Grupo        druid     15    50     8    cura 52/alvo (r4)  [mantida; cura aliados]
 * Removidas: Cura Intensa (exura gran), Cura Vital (exura vita), Cura Sagrada Leve (exura san) e Tratar Ferimentos (exura ico):
 * cada vocação tem exatamente UMA cura própria.
 *
 * Golpe Giratório      knight     1     8     4    dmg 17 (área r1, 2.3x auto)
 * Provocar             knight     5    15    20    taunt r3, 5 s
 * Investida            knight    10    20     8    dmg 43 (dash 4)
 * Pele de Ferro        knight    15    20    30    -30% dano, 10 s
 *  * Golpe Brutal         knight    30    45     8    dmg 176 (3.3x auto)
 * Flecha Perfurante    paladin    1     8     2    dmg 14 (2.3x auto)
 * Pés Ligeiros         paladin    5    20    30    haste +30%, 8 s
 * Chuva de Flechas     paladin   15    35     6    dmg 47 (área r2)
 * Flecha Sagrada       paladin   20    30     4    dmg 103 (holy)
 * Onda Sagrada         paladin   30    90     8    dmg 131 (área r3)
 * Bola de Fogo         sorcerer   1     8     2    dmg 12 (2.3x auto)
 * Onda de Energia      sorcerer   5    20     4    dmg 29 (onda 4x3)
 * Explosão de Fogo     sorcerer  10    40     6    dmg 43 (área r2 + burn); lvl 15: 60, lvl 20: 78
 * Escudo de Mana       sorcerer  15    30    30    manashield 20 s
 * Raio de Energia      sorcerer  20    45     4    dmg 100 (alvo único)
 * Inferno              sorcerer  30   160     8    dmg 208 (área r3 + burn)
 * Raiz                 druid      5    20    15    dmg 17 + root 3 s
 * Chuva de Gelo        druid     10    40     6    dmg 39 (área r2 + slow); lvl 15: 55, lvl 20: 72
 * Invocar Lobo         druid     20    90    60    1 lobo espiritual, 60 s
 * Nevasca              druid     30   150     8    dmg 199 (área r3 + slow)
 */
