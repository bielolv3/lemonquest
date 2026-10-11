// Configuração ÚNICA de sprites de personagem. Trocar o pack de arte = mexer só aqui.
import type { Facing, Vocation } from "@tibinha/shared";

export interface CharacterSheet {
  /** Chave da textura no Phaser (uma por arquivo). */
  key: string;
  /** Caminho servido pelo Vite (publicDir = assets/). */
  url: string;
  frameWidth: number;
  frameHeight: number;
  /** Frames (índice no spritesheet) do ciclo de caminhada por lado. */
  walk: Record<Facing, number[]>;
  /** Frame parado por lado. */
  idle: Record<Facing, number>;
  /** Quantos passos (tiles) dura um ciclo completo da animação de caminhada. */
  stepsPerCycle: number;
}

export interface CharacterLook {
  sheet: CharacterSheet;
  /** Tint multiplicativo (0xffffff = sem tint). */
  tint: number;
}

/**
 * Ninja Adventure: sheet 64x112, frames 16x16, 4 colunas x 7 linhas.
 * Coluna = lado (0 baixo, 1 cima, 2 esquerda, 3 direita); linhas 0..3 = ciclo de caminhada; linha 0 = parado.
 */
function ninjaAdventure(key: string, url: string): CharacterSheet {
  const col: Record<Facing, number> = { down: 0, up: 1, left: 2, right: 3 };
  const walk = {} as Record<Facing, number[]>;
  const idle = {} as Record<Facing, number>;
  for (const f of Object.keys(col) as Facing[]) {
    walk[f] = [0, 1, 2, 3].map((row) => row * 4 + col[f]);
    idle[f] = col[f];
  }
  return { key, url, frameWidth: 16, frameHeight: 16, walk, idle, stepsPerCycle: 2 };
}

const SHEETS = {
  samuraiBlue: ninjaAdventure("chr_samurai_blue", "ninja-adventure/content/character/samurai_blue/sprite.png"),
  ninjaBlue: ninjaAdventure("chr_ninja_blue", "ninja-adventure/content/character/ninja_blue/sprite.png"),
  samuraiGreen: ninjaAdventure("chr_samurai_green", "ninja-adventure/content/character/samurai_green/samurai_green.png"),
} satisfies Record<string, CharacterSheet>;

/** Vocação → visual. Só há 3 sheets hoje: o sorcerer reaproveita o ninja com tint roxo. */
export const VOCATION_LOOK: Record<Vocation, CharacterLook> = {
  knight: { sheet: SHEETS.samuraiBlue, tint: 0xffffff },
  paladin: { sheet: SHEETS.ninjaBlue, tint: 0xffffff },
  sorcerer: { sheet: SHEETS.ninjaBlue, tint: 0xd2a8ff },
  druid: { sheet: SHEETS.samuraiGreen, tint: 0xffffff },
};

export const ALL_SHEETS: CharacterSheet[] = Object.values(SHEETS);

export function lookFor(vocation: string): CharacterLook {
  return VOCATION_LOOK[vocation as Vocation] ?? VOCATION_LOOK.knight;
}

/** Nome da animação de caminhada de um sheet para um lado. */
export const walkAnimKey = (sheet: CharacterSheet, f: Facing) => `${sheet.key}:walk:${f}`;
