import type { Vocation } from "@tibinha/shared";

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
}
