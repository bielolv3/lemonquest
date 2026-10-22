// Famílias de magia ("tecla inteligente"): magias com o mesmo papel (ataque no alvo, área em volta, onda...) num atalho
// só. Apertar conjura a mais forte que estiver pronta (liberada no level, fora de recarga, com mana e no alcance) — como
// o Revolution do RuneScape, mas dentro de uma família. As magias continuam existindo (palavras no chat, atalho próprio).
// O id da família vai no lugar do id da magia no atalho (Hotkey.spellId); o cliente escolhe e manda a magia real.
import type { Vocation } from "../types.ts";
import { spellDef, type SpellDef } from "./spells.ts";

export const FAMILY_PREFIX = "fam:";

export interface SpellFamily {
  /** "fam:<vocação>:<papel>". */
  id: string;
  name: string;
  desc: string;
  vocation: Vocation;
  /** Prioridade: a primeira pronta sai (a mais forte primeiro). */
  spells: readonly string[];
}

const fam = (vocation: Vocation, key: string, name: string, desc: string, spells: string[]): SpellFamily =>
  ({ id: `${FAMILY_PREFIX}${vocation}:${key}`, name, desc, vocation, spells });

export const SPELL_FAMILIES: readonly SpellFamily[] = [
  fam("knight", "target", "Golpe no alvo", "A mais forte pronta entre Golpe Aniquilador e Golpe Brutal.", ["annihilation_strike", "brutal_strike"]),
  fam("knight", "area", "Golpe em área", "A mais forte pronta entre Fúria Giratória, Golpe Frontal e Golpe Giratório.", ["whirlwind", "front_sweep", "spin_strike"]),
  fam("paladin", "target", "Flecha no alvo", "A mais forte pronta entre Flecha Paralisante, Flecha Sagrada e Flecha Perfurante.", ["crippling_arrow", "holy_arrow", "piercing_arrow"]),
  fam("paladin", "area", "Chuva no alvo", "A mais forte pronta entre Chuva de Estrelas, Julgamento Divino, Flecha Explosiva e Chuva de Flechas.", ["star_rain", "divine_judgment", "explosive_arrow", "arrow_rain"]),
  fam("sorcerer", "target", "Ataque no alvo", "A mais forte pronta entre Chama Eterna, Morte Súbita, Raio de Energia e Bola de Fogo.", ["eternal_flame", "sudden_death", "energy_beam", "fireball"]),
  fam("sorcerer", "area", "Área em volta", "A mais forte pronta entre Tempestade Elétrica e Inferno.", ["electric_storm", "inferno"]),
  fam("sorcerer", "wave", "Onda", "A mais forte pronta entre Onda de Fogo e Onda de Energia.", ["fire_wave", "energy_wave"]),
  fam("druid", "target", "Ataque no alvo", "A mais forte pronta entre Fúria da Natureza, Esmagar Terra e Lasca de Gelo.", ["nature_fury", "earth_crush", "ice_shard"]),
  fam("druid", "area", "Área em volta", "A mais forte pronta entre Tempestade de Terra e Nevasca.", ["earth_storm", "blizzard"]),
];

const BY_ID = new Map(SPELL_FAMILIES.map((f) => [f.id, f]));

export const isFamilyId = (id: string): boolean => id.startsWith(FAMILY_PREFIX);
export const familyDef = (id: string): SpellFamily | undefined => BY_ID.get(id);
export const familiesFor = (vocation: Vocation): SpellFamily[] => SPELL_FAMILIES.filter((f) => f.vocation === vocation);
/** Família da vocação que contém a magia (undefined = magia avulsa). */
export const familyOf = (spellId: string, vocation: Vocation): SpellFamily | undefined =>
  SPELL_FAMILIES.find((f) => f.vocation === vocation && f.spells.includes(spellId));

/** Magias da família (na ordem de prioridade). */
export const familySpells = (f: SpellFamily): SpellDef[] => f.spells.map((id) => spellDef(id)).filter((s): s is SpellDef => !!s);

/** Level em que a família libera a primeira magia. */
export const familyLevel = (f: SpellFamily): number => Math.min(...familySpells(f).map((s) => s.level));

/** A primeira magia (mais forte) liberada no level que `ready` aceita; null = nenhuma. */
export function pickFromFamily(f: SpellFamily, level: number, ready: (s: SpellDef) => boolean): SpellDef | null {
  return familySpells(f).find((s) => s.level <= level && ready(s)) ?? null;
}

/** Atalho válido para a vocação: magia dela ou família dela. */
export function castableBy(id: string, vocation: Vocation): boolean {
  if (isFamilyId(id)) return familyDef(id)?.vocation === vocation;
  return !!spellDef(id)?.vocations.includes(vocation);
}
