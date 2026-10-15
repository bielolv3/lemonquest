import { describe, expect, it } from "vitest";
import { rollWeek, weeklyCounters } from "./weekly.ts";

const rec = (xp: number, stats: Record<string, number> = {}): any => ({ xp, data: { ach: { done: {}, stats, killed: [] } } });
const wed = new Date(2026, 9, 14, 12), nextWed = new Date(2026, 9, 21, 12);

describe("rollWeek", () => {
  it("cria a linha de base com os contadores atuais; na mesma semana não mexe", () => {
    const r = rec(1000, { kills: 30, fish: 5, bosses: 2 });
    expect(weeklyCounters(r)).toEqual({ xp: 1000, kills: 30, fish: 5, bosses: 2 });
    expect(rollWeek(r, wed)).toBe(true);
    expect(r.data.week).toEqual({ id: "2026-W42", xp: 1000, kills: 30, fish: 5, bosses: 2 });
    r.xp = 1400; r.data.ach.stats.kills = 50;
    expect(rollWeek(r, new Date(2026, 9, 18, 23))).toBe(false); // domingo, mesma semana
    expect(r.data.week.xp).toBe(1000);
  });

  it("na virada da semana a base passa a ser o valor atual", () => {
    const r = rec(1000);
    rollWeek(r, wed);
    r.xp = 1700;
    expect(rollWeek(r, nextWed)).toBe(true);
    expect(r.data.week).toMatchObject({ id: "2026-W43", xp: 1700 });
  });

  it("registro sem estatísticas conta zero", () => {
    expect(weeklyCounters({ xp: 5, data: {} } as any)).toEqual({ xp: 5, kills: 0, fish: 0, bosses: 0 });
  });
});
