// Ranking público: top 10 por categoria a partir dos personagens salvos. Cache de 30 s. Só nomes de personagens.
import {
  RANKING_CACHE_S, RANKING_LIMIT, SKILL_START, weekEndsAt, weekGain, weekId,
  type RankingCategory, type RankingCategoryId, type RankingEntry, type RankingResponse,
} from "@lemonquest/shared";
import { achievementPoints } from "../systems/achievements.ts";
import { weeklyCounters } from "../systems/weekly.ts";
import { getKv, listRankingRows, type RankingRow } from "./db.ts";

interface CatDef {
  id: RankingCategoryId;
  title: string;
  unit: string;
  /** Valor do personagem; <= 0 = fora do ranking. `week` = id da semana atual (categorias semanais). */
  value: (r: RankingRow, week: string) => number;
  /** Desempate (maior vence), depois nome. */
  tie?: (r: RankingRow) => number;
}

const skill = (k: "magic" | "melee" | "distance") => (r: RankingRow): number => {
  const lv = r.data.skills?.[k]?.level;
  return typeof lv === "number" && lv > SKILL_START[k] ? lv : 0;
};

const CATS: CatDef[] = [
  { id: "level", title: "Level", unit: "level", value: (r) => r.level, tie: (r) => r.xp },
  { id: "points", title: "Pontos de conquista", unit: "pontos", value: (r) => achievementPoints(r) },
  { id: "arena", title: "Coliseu: melhor onda", unit: "ondas", value: (r) => r.data.arenaBest ?? 0 },
  { id: "bosses", title: "Chefes derrotados", unit: "chefes", value: (r) => r.data.ach?.stats?.bosses ?? 0 },
  { id: "magic", title: "Magic Level", unit: "ML", value: skill("magic") },
  { id: "melee", title: "Corpo a corpo", unit: "skill", value: skill("melee") },
  { id: "distance", title: "Distância", unit: "skill", value: skill("distance") },
  { id: "fish", title: "Pescador", unit: "peixes", value: (r) => r.data.ach?.stats?.fish ?? 0 },
  // Semanais: ganho desde a segunda-feira (zeram na virada; quem não jogou na semana não aparece).
  { id: "week_xp", title: "Semana: XP", unit: "XP", value: (r, w) => weekGain(r.data.week, weeklyCounters(r), w, "xp") },
  { id: "week_kills", title: "Semana: abates", unit: "abates", value: (r, w) => weekGain(r.data.week, weeklyCounters(r), w, "kills") },
  { id: "week_fish", title: "Semana: peixes", unit: "peixes", value: (r, w) => weekGain(r.data.week, weeklyCounters(r), w, "fish") },
  { id: "week_bosses", title: "Semana: chefes", unit: "chefes", value: (r, w) => weekGain(r.data.week, weeklyCounters(r), w, "bosses") },
];

/** Monta a resposta a partir das linhas (puro; testável). */
export function buildRanking(rows: RankingRow[], arenaServerBest: number, now: number): RankingResponse {
  const week = weekId(new Date(now));
  const categories: RankingCategory[] = CATS.map((c) => {
    const scored = rows
      .map((r) => ({ r, v: Math.floor(c.value(r, week)), t: c.tie?.(r) ?? 0 }))
      .filter((x) => x.v > 0)
      .sort((a, b) => b.v - a.v || b.t - a.t || a.r.name.localeCompare(b.r.name, "pt-BR"))
      .slice(0, RANKING_LIMIT);
    const entries: RankingEntry[] = scored.map((x, i) => ({
      rank: i + 1, name: x.r.name, vocation: x.r.vocation, level: x.r.level, value: x.v,
    }));
    return { id: c.id, title: c.title, unit: c.unit, entries };
  });
  return { generatedAt: now, arenaServerBest, weekEndsAt: weekEndsAt(new Date(now)), categories };
}

let cache: { at: number; body: string } | null = null;

/** JSON do ranking, em cache por RANKING_CACHE_S segundos. */
export function rankingJson(now = Date.now()): string {
  if (cache && now - cache.at < RANKING_CACHE_S * 1000) return cache.body;
  const best = Number(getKv("arena.serverBest") ?? 0);
  const body = JSON.stringify(buildRanking(listRankingRows(), Number.isFinite(best) ? best : 0, now));
  cache = { at: now, body };
  return body;
}

export function resetRankingCache(): void { cache = null; }
