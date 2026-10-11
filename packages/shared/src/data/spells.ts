import type { DamageKind, Vocation } from "../types.ts";

/** Condições (buffs/debuffs). Os ids batem com o catálogo visual do HUD (ui/hud/conditions.ts). */
export type ConditionId =
  | "combat" | "poison" | "burn" | "energy" | "bleed" | "freeze"
  | "protect" | "haste" | "slow" | "drunk" | "regen" | "pz"
  | "manashield" | "rooted" | "taunted";

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
  vocation: Vocation;
  level: number;           // level mínimo
  mana: number;
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

/** Catálogo. O agente de conteúdo completa: 6 magias por vocação, levels 1, 5, 10, 15, 20, 30. */
export const SPELLS: Record<string, SpellDef> = {
  light_heal: {
    id: "light_heal", name: "Cura Leve", words: "exura", vocation: "druid", level: 1, mana: 20, cooldownMs: 1000,
    target: "self", heal: { base: 20, perLevel: 1.5, perMagic: 3, variance: 0.2 }, fx: "heal",
    description: "Cura um pouco da sua vida.",
  },
};

export const spellDef = (id: string): SpellDef | undefined => SPELLS[id];

export function spellsFor(vocation: Vocation): SpellDef[] {
  return Object.values(SPELLS).filter((s) => s.vocation === vocation).sort((a, b) => a.level - b.level);
}

/** Procura a magia pelas palavras (ignora maiúsculas e espaços extras). */
export function spellByWords(text: string): SpellDef | undefined {
  const t = text.trim().toLowerCase().replace(/\s+/g, " ");
  return Object.values(SPELLS).find((s) => s.words === t);
}
