export const TILE_SIZE = 16;
export const TICK_RATE = 20;
export const TICK_MS = 1000 / TICK_RATE;

/** Duração de um passo ortogonal no level 1 (ms). Diagonais custam DIAGONAL_COST vezes mais. */
export const BASE_STEP_MS = 280;
export const DIAGONAL_COST = 1.4;

export const MAX_NAME_LEN = 20;
export const MAX_CHAT_LEN = 200;

/** Ponto de respawn (templo). Sobrescrito pelo objeto "spawn_player" do mapa, se existir. */
export const DEFAULT_SPAWN = { x: 20, y: 20 };
