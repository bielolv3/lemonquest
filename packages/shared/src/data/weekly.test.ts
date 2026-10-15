import { describe, expect, it } from "vitest";
import { timeLeftText, weekEndsAt, weekGain, weekId } from "./weekly.ts";

const d = (y: number, m: number, day: number, h = 12) => new Date(y, m - 1, day, h, 0, 0, 0);

describe("weekId (ISO)", () => {
  it("segunda a domingo é a mesma semana; a virada é na segunda", () => {
    expect(weekId(d(2026, 10, 12))).toBe("2026-W42"); // segunda
    expect(weekId(d(2026, 10, 18, 23))).toBe("2026-W42"); // domingo à noite
    expect(weekId(d(2026, 10, 19, 0))).toBe("2026-W43"); // segunda 00h
  });
  it("virada de ano segue a regra ISO", () => {
    expect(weekId(d(2025, 12, 29))).toBe("2026-W01"); // segunda: já é a semana 1 de 2026
    expect(weekId(d(2026, 1, 1))).toBe("2026-W01");
    expect(weekId(d(2027, 1, 3))).toBe("2026-W53"); // domingo: ainda a última de 2026
    expect(weekId(d(2024, 12, 30))).toBe("2025-W01");
  });
});

describe("weekEndsAt", () => {
  it("é a próxima segunda 00:00 local", () => {
    expect(weekEndsAt(d(2026, 10, 14))).toBe(new Date(2026, 9, 19, 0, 0, 0, 0).getTime()); // quarta → segunda 19
    expect(weekEndsAt(d(2026, 10, 18, 23))).toBe(new Date(2026, 9, 19, 0, 0, 0, 0).getTime()); // domingo
    expect(weekEndsAt(d(2026, 10, 19, 0))).toBe(new Date(2026, 9, 26, 0, 0, 0, 0).getTime()); // segunda 00h: semana inteira pela frente
  });
});

describe("weekGain", () => {
  const cur = { xp: 1500, kills: 40, fish: 12, bosses: 2 };
  const base = { id: "2026-W42", xp: 1000, kills: 30, fish: 12, bosses: 2 };
  it("valor atual menos a linha de base, só na mesma semana", () => {
    expect(weekGain(base, cur, "2026-W42", "xp")).toBe(500);
    expect(weekGain(base, cur, "2026-W42", "fish")).toBe(0);
    expect(weekGain(base, cur, "2026-W43", "xp")).toBe(0); // base de outra semana = não jogou nesta
    expect(weekGain(undefined, cur, "2026-W42", "xp")).toBe(0);
    expect(weekGain(base, { ...cur, xp: 900 }, "2026-W42", "xp")).toBe(0); // nunca negativo
  });
});

describe("timeLeftText", () => {
  it("dias+horas, horas+minutos ou minutos", () => {
    expect(timeLeftText(2 * 86400_000 + 5 * 3600_000, 0)).toBe("2 d 5 h");
    expect(timeLeftText(3 * 3600_000 + 10 * 60_000, 0)).toBe("3 h 10 min");
    expect(timeLeftText(20 * 60_000, 0)).toBe("20 min");
    expect(timeLeftText(5_000, 0)).toBe("1 min");
  });
});
