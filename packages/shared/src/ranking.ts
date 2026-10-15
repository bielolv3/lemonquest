// Ranking público (GET /api/ranking): top 10 por categoria, só nomes de PERSONAGENS (nunca de conta).
export const RANKING_LIMIT = 10;
/** Cache do servidor (e max-age do cabeçalho), em segundos. */
export const RANKING_CACHE_S = 30;

export type RankingCategoryId =
  | "level" | "points" | "arena" | "bosses" | "magic" | "melee" | "distance" | "fish"
  | "week_xp" | "week_kills" | "week_fish" | "week_bosses";

export interface RankingEntry {
  rank: number;
  name: string;
  vocation: string;
  level: number;
  /** Valor da categoria (level, pontos, ondas, abates de chefe, nível da skill). */
  value: number;
}

export interface RankingCategory {
  id: RankingCategoryId;
  title: string;
  /** Rótulo do valor ("level", "pontos", "ondas"...). */
  unit: string;
  entries: RankingEntry[];
}

export interface RankingResponse {
  generatedAt: number;
  /** Recorde do servidor no Coliseu (ondas vencidas), persistido. */
  arenaServerBest: number;
  /** Fim da semana (ms epoch): as categorias "week_*" zeram nesse instante. */
  weekEndsAt: number;
  categories: RankingCategory[];
}
