import type { Vocation } from "@tibinha/shared";

/** Dados flexíveis do personagem, guardados como JSON na coluna `data`. Cada marco acrescenta campos opcionais. */
export interface CharacterData {
  /** Máscara de exploração do minimapa (base64, ver shared/explore.ts). */
  explored?: string;
  hp?: number;
  mana?: number;
}

/** Registro persistido de um personagem (1 personagem por conta; nome da conta = nome do personagem). */
export interface CharacterRecord {
  id: number;
  name: string;
  vocation: Vocation;
  level: number;
  xp: number;
  x: number | null;   // null = nunca entrou → nasce no spawn do mapa
  y: number | null;
  dir: number;
  data: CharacterData;
}
