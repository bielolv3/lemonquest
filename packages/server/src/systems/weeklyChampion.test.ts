import { describe, expect, it } from "vitest";
import { TITLES, isValidUnlockId } from "@lemonquest/shared";
import type { CharacterRecord } from "../persistence/types.ts";
import type { RankingRow } from "../persistence/db.ts";
import { CHAMPION_TITLE, CHAMPION_UNLOCK, crownWeek, pickChampions, revokeUnlock, type ChampionHost } from "./weeklyChampion.ts";

const row = (name: string, week: string, base: { xp: number; kills: number; fish: number; bosses: number }, cur: { xp: number; kills?: number; fish?: number; bosses?: number }): RankingRow => ({
  name, vocation: "knight", level: 10, xp: cur.xp,
  data: { week: { id: week, ...base }, ach: { done: {}, stats: { kills: cur.kills ?? 0, fish: cur.fish ?? 0, bosses: cur.bosses ?? 0 }, killed: [] } },
});

function host(rows: RankingRow[], kv: Record<string, string> = {}) {
  const recs = new Map<string, CharacterRecord>(rows.map((r) => [r.name, { id: 1, accountId: 1, name: r.name, vocation: "knight", level: r.level, xp: r.xp, x: 0, y: 0, dir: 0, data: r.data } as CharacterRecord]));
  const log: string[] = [];
  const h: ChampionHost = {
    getKv: (k) => kv[k], setKv: (k, v) => { kv[k] = v; },
    rows: () => rows, record: (n) => recs.get(n),
    grant: (rec, id) => { (rec.data.unlocks ??= []).push(id); log.push(`+${rec.name}`); },
    revoke: (rec) => log.push(`-${rec.name}`),
    save: () => {}, announce: (t) => log.push(t),
  };
  return { h, kv, recs, log };
}

describe("campeão da semana", () => {
  it("o título existe no catálogo e o desbloqueio é válido", () => {
    expect(TITLES[CHAMPION_TITLE]).toBe("Campeão da Semana");
    expect(isValidUnlockId(CHAMPION_UNLOCK)).toBe(true);
  });

  it("líder de cada categoria pelo ganho da semana; ganho zero fica de fora; empate pelo nome", () => {
    const rows = [
      row("Ana", "2026-W43", { xp: 100, kills: 10, fish: 0, bosses: 0 }, { xp: 600, kills: 30, fish: 0, bosses: 1 }),
      row("Beto", "2026-W43", { xp: 100, kills: 10, fish: 5, bosses: 0 }, { xp: 400, kills: 30, fish: 9, bosses: 0 }),
      row("Caio", "2026-W42", { xp: 0, kills: 0, fish: 0, bosses: 0 }, { xp: 9999, kills: 999, fish: 99, bosses: 9 }), // semana antiga: não conta
    ];
    expect(pickChampions(rows, "2026-W43")).toEqual({ xp: "Ana", kills: "Ana", fish: "Beto", bosses: "Ana" });
  });

  it("coroa na virada, revoga os antigos que não repetiram e não repete na mesma semana", () => {
    const rows = [
      row("Ana", "2026-W43", { xp: 0, kills: 0, fish: 0, bosses: 0 }, { xp: 500 }),
      row("Beto", "2026-W43", { xp: 0, kills: 0, fish: 0, bosses: 0 }, { xp: 100, fish: 3 }),
      row("Duda", "2026-W43", { xp: 0, kills: 0, fish: 0, bosses: 0 }, { xp: 0 }),
    ];
    const { h, kv, recs, log } = host(rows, { "week.champion.id": "2026-W43", "week.champion.names": JSON.stringify(["Duda", "Beto"]) });
    recs.get("Duda")!.data.unlocks = [CHAMPION_UNLOCK];
    recs.get("Duda")!.data.ach!.title = CHAMPION_TITLE;
    recs.get("Beto")!.data.unlocks = [CHAMPION_UNLOCK];
    const monday = new Date(2026, 9, 26, 0, 1); // 2026-10-26 = segunda da W44
    expect(crownWeek(h, monday)).toEqual({ xp: "Ana", fish: "Beto" });
    expect(kv["week.champion.id"]).toBe("2026-W44");
    expect(JSON.parse(kv["week.champion.names"]!)).toEqual(["Ana", "Beto"]);
    expect(recs.get("Ana")!.data.unlocks).toEqual([CHAMPION_UNLOCK]);
    expect(recs.get("Duda")!.data.unlocks).toEqual([]);
    expect(recs.get("Duda")!.data.ach!.title).toBeUndefined();
    expect(log.filter((l) => l.startsWith("-"))).toEqual(["-Duda"]);
    expect(log.at(-1)).toContain("Ana (XP) · Beto (peixes)");
    expect(crownWeek(h, new Date(2026, 9, 28))).toBeNull(); // mesma semana: nada
  });

  it("primeira execução (sem semana gravada) só marca a semana, sem coroar ninguém", () => {
    const { h, kv, log } = host([row("Ana", "2026-W43", { xp: 0, kills: 0, fish: 0, bosses: 0 }, { xp: 500 })]);
    expect(crownWeek(h, new Date(2026, 9, 22))).toEqual({});
    expect(kv["week.champion.id"]).toBe("2026-W43");
    expect(log).toEqual([]);
  });

  it("revokeUnlock tira o desbloqueio e o título ativo", () => {
    const rec = { data: { unlocks: ["title:x", CHAMPION_UNLOCK], ach: { title: CHAMPION_TITLE } } } as unknown as CharacterRecord;
    expect(revokeUnlock(rec, CHAMPION_UNLOCK)).toBe(true);
    expect(rec.data.unlocks).toEqual(["title:x"]);
    expect(rec.data.ach!.title).toBeUndefined();
    expect(revokeUnlock(rec, CHAMPION_UNLOCK)).toBe(false);
  });
});
