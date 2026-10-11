/** 8 direções, no sentido horário a partir do norte. */
export enum Dir { N = 0, NE = 1, E = 2, SE = 3, S = 4, SW = 5, W = 6, NW = 7 }

export const DIR_DELTA: Record<Dir, { dx: number; dy: number }> = {
  [Dir.N]: { dx: 0, dy: -1 },
  [Dir.NE]: { dx: 1, dy: -1 },
  [Dir.E]: { dx: 1, dy: 0 },
  [Dir.SE]: { dx: 1, dy: 1 },
  [Dir.S]: { dx: 0, dy: 1 },
  [Dir.SW]: { dx: -1, dy: 1 },
  [Dir.W]: { dx: -1, dy: 0 },
  [Dir.NW]: { dx: -1, dy: -1 },
};

export const isDiagonal = (d: Dir) => d % 2 === 1;

/** Direção "visual" (4 lados) usada para escolher a linha do spritesheet. */
export type Facing = "down" | "up" | "left" | "right";

export type Vocation = "knight" | "paladin" | "sorcerer" | "druid";
export const VOCATIONS: Vocation[] = ["knight", "paladin", "sorcerer", "druid"];

export type ChatChannel = "global" | "party" | "system";

export interface ChatMessage {
  from: string;
  text: string;
  channel: ChatChannel;
  ts: number;
}

/**
 * Espelho (somente leitura no cliente) do estado sincronizado pelo Colyseus.
 * As classes @colyseus/schema vivem em packages/server/src/state.ts e DEVEM manter estes campos.
 */
export interface PlayerView {
  id: string;          // sessionId
  name: string;
  vocation: Vocation;
  level: number;
  x: number;           // tile
  y: number;           // tile
  dir: Dir;            // última direção de movimento/olhar
  stepMs: number;      // duração do passo atual (para interpolar)
  seq: number;         // último input "move" processado (reconciliação)
}

export interface WorldView {
  players: Map<string, PlayerView>;
}
