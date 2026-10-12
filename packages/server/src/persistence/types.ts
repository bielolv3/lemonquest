import type { Vocation } from "@tibinha/shared";

/** Dados flexíveis do personagem, guardados como JSON na coluna `data`. Cada marco acrescenta campos opcionais. */
export interface CharacterData {
  /** Máscara de exploração do minimapa (base64, ver shared/explore.ts). */
  explored?: string;
  /** Largura do mapa quando `explored` foi salva (mudou → máscara descartada; mesma largura → prefixo aproveitado). */
  exploredW?: number;
  hp?: number;
  mana?: number;
  /** Skills: nível e tentativas acumuladas no nível atual. */
  /** Modo de batalha salvo. */
  stance?: "offensive" | "balanced" | "defensive";
  chase?: boolean;
  /** Inventário (M4). */
  equipment?: Partial<Record<string, unknown>>;
  backpack?: unknown[];
  depot?: unknown[];
  gold?: number;
  /** Estado "alimentado" (comida): tempo restante (o tempo não passa offline) e regen por tique. */
  fed?: { remainingMs: number; hpPerTick: number; manaPerTick: number };
  skills?: Partial<Record<"melee" | "distance" | "magic" | "shield", { level: number; tries: number }>>;
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
