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
  return gridSheet(key, url, 16, 16);
}

/** Layout "grid4": colunas = lados (baixo, cima, esquerda, direita), linhas = frames de caminhada. */
export function gridSheet(key: string, url: string, frameWidth: number, frameHeight: number, rows = 4): CharacterSheet {
  const col: Record<Facing, number> = { down: 0, up: 1, left: 2, right: 3 };
  const walk = {} as Record<Facing, number[]>;
  const idle = {} as Record<Facing, number>;
  for (const f of Object.keys(col) as Facing[]) {
    walk[f] = Array.from({ length: rows }, (_, row) => row * 4 + col[f]);
    idle[f] = col[f];
  }
  return { key, url, frameWidth, frameHeight, walk, idle, stepsPerCycle: 2 };
}

const SHEETS = {
  knight: ninjaAdventure("chr_knight", "ninja/Actor/Character/Knight/SpriteSheet.png"),
  hunter: ninjaAdventure("chr_hunter", "ninja/Actor/Character/Hunter/SpriteSheet.png"),
  sorcerer: ninjaAdventure("chr_sorcerer_black", "ninja/Actor/Character/SorcererBlack/SpriteSheet.png"),
  shaman: ninjaAdventure("chr_shaman", "ninja/Actor/Character/Shaman/SpriteSheet.png"),
} satisfies Record<string, CharacterSheet>;

/** Vocação → visual. */
export const VOCATION_LOOK: Record<Vocation, CharacterLook> = {
  knight: { sheet: SHEETS.knight, tint: 0xffffff },
  paladin: { sheet: SHEETS.hunter, tint: 0xffffff },
  sorcerer: { sheet: SHEETS.sorcerer, tint: 0xffffff },
  druid: { sheet: SHEETS.shaman, tint: 0xffffff },
};

export const ALL_SHEETS: CharacterSheet[] = Object.values(SHEETS);

export function lookFor(vocation: string): CharacterLook {
  return VOCATION_LOOK[vocation as Vocation] ?? VOCATION_LOOK.knight;
}

/** Nome da animação de caminhada de um sheet para um lado. */
export const walkAnimKey = (sheet: CharacterSheet, f: Facing) => `${sheet.key}:walk:${f}`;
