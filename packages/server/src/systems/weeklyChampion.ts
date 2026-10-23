// Campeão da semana (ciclo 9, GD-14): na virada da semana ISO, quem liderou cada categoria semanal do ranking (XP,
// abates, peixes, chefes) ganha o título rotativo "Campeão da Semana" até a próxima virada; quem não repetiu perde.
// O ranking semanal mede o ganho desde a linha de base da segunda-feira (weekly.ts); como a base é renovada no primeiro
// contato de cada personagem com a semana nova, a coroação precisa rodar ANTES de `rollWeek` na virada (WorldRoom) e
// usa o que está gravado no banco (a última gravação tem no máximo 15 s de atraso). Puro: o host dá acesso a kv,
// linhas do banco, registros online e à concessão/revogação do desbloqueio.
import { WEEKLY_KEYS, weekGain, weekId, type WeeklyKey } from "@lemonquest/shared";
import type { CharacterRecord } from "../persistence/types.ts";
import type { RankingRow } from "../persistence/db.ts";
import { weeklyCounters } from "./weekly.ts";

export const CHAMPION_TITLE = "campeao_semana";
export const CHAMPION_UNLOCK = `title:${CHAMPION_TITLE}`;
const KV_WEEK = "week.champion.id";
const KV_NAMES = "week.champion.names";
const CATEGORY_LABEL: Record<WeeklyKey, string> = { xp: "XP", kills: "abates", fish: "peixes", bosses: "chefes" };

export interface ChampionHost {
  getKv(key: string): string | undefined;
  setKv(key: string, value: string): void;
  /** Linhas de todos os personagens (as online podem estar até 15 s atrasadas). */
  rows(): RankingRow[];
  /** Registro de um personagem pelo nome (online: o da memória; offline: do banco). */
  record(name: string): CharacterRecord | undefined;
  /** Personagem está online (o host atualiza o título na hora e manda o estado das conquistas). */
  grant(rec: CharacterRecord, unlockId: string): void;
  revoke(rec: CharacterRecord, unlockId: string): void;
  /** Grava um registro que não está online (os online vão no autosave). */
  save(rec: CharacterRecord): void;
  announce(text: string): void;
}

/** Líder de cada categoria semanal (ganho > 0) na semana `week`; desempate pelo nome. */
export function pickChampions(rows: readonly RankingRow[], week: string): Partial<Record<WeeklyKey, string>> {
  const out: Partial<Record<WeeklyKey, string>> = {};
  for (const key of WEEKLY_KEYS) {
    let best: { name: string; v: number } | null = null;
    for (const r of rows) {
      const v = weekGain(r.data.week, weeklyCounters(r), week, key);
      if (v <= 0) continue;
      if (!best || v > best.v || (v === best.v && r.name.localeCompare(best.name, "pt-BR") < 0)) best = { name: r.name, v };
    }
    if (best) out[key] = best.name;
  }
  return out;
}

/** Remove o desbloqueio do título e o título ativo, se era ele. true = mudou algo. */
export function revokeUnlock(rec: CharacterRecord, unlockId: string): boolean {
  const list = rec.data.unlocks;
  const i = list?.indexOf(unlockId) ?? -1;
  if (i < 0) return false;
  list!.splice(i, 1);
  const t = unlockId.startsWith("title:") ? unlockId.slice(6) : "";
  if (t && rec.data.ach?.title === t) delete rec.data.ach.title;
  return true;
}

/**
 * Coroa os campeões da semana que acabou (se a semana mudou desde a última coroação) e revoga os da anterior.
 * Chamar na virada (antes de renovar as linhas de base) e no boot do servidor. Devolve os nomes coroados, ou null se
 * não era hora.
 */
export function crownWeek(host: ChampionHost, now: Date): Partial<Record<WeeklyKey, string>> | null {
  const cur = weekId(now);
  const prev = host.getKv(KV_WEEK);
  if (prev === cur) return null;
  const champions = prev ? pickChampions(host.rows(), prev) : {};
  const winners = new Set(Object.values(champions));
  let old: string[] = [];
  try { old = JSON.parse(host.getKv(KV_NAMES) ?? "[]") as string[]; } catch { old = []; }
  for (const name of old) {
    if (winners.has(name)) continue;
    const rec = host.record(name);
    if (rec && revokeUnlock(rec, CHAMPION_UNLOCK)) host.revoke(rec, CHAMPION_UNLOCK);
  }
  for (const name of winners) {
    const rec = host.record(name);
    if (rec) host.grant(rec, CHAMPION_UNLOCK);
  }
  host.setKv(KV_WEEK, cur);
  host.setKv(KV_NAMES, JSON.stringify([...winners]));
  if (winners.size) {
    const parts = WEEKLY_KEYS.filter((k) => champions[k]).map((k) => `${champions[k]} (${CATEGORY_LABEL[k]})`);
    host.announce(`🏆 Campeões da semana ${prev}: ${parts.join(" · ")} — título "Campeão da Semana" até a próxima segunda.`);
  }
  return champions;
}
