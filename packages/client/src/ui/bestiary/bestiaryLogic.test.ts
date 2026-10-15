import { describe, expect, it } from "vitest";
import { MONSTERS } from "@lemonquest/shared";
import { bestiaryRows, chanceText, damageLabel, progressText } from "./bestiaryLogic.ts";

const defs = Object.values(MONSTERS);

describe("bestiaryRows", () => {
  it("lista só monstros que dão XP e morrem (sem boneco de treino), por level, com chefes incluídos", () => {
    const rows = bestiaryRows(defs, undefined);
    expect(rows.some((r) => r.id === "training_dummy")).toBe(false);
    expect(rows.some((r) => r.id === "rat")).toBe(true);
    expect(rows.some((r) => r.id === "goblin_king" && r.boss)).toBe(true);
    expect(rows.map((r) => r.level)).toEqual([...rows.map((r) => r.level)].sort((a, b) => a - b));
    expect(rows.every((r) => !r.known && r.kills === 0)).toBe(true);
  });

  it("conhecido = ao menos 1 abate; contagem inválida vira 0", () => {
    const rows = bestiaryRows(defs, { rat: 5, wolf: 0, snake: -3, slime: 1.9 });
    const by = (id: string) => rows.find((r) => r.id === id)!;
    expect(by("rat")).toMatchObject({ known: true, kills: 5 });
    expect(by("wolf").known).toBe(false);
    expect(by("snake").kills).toBe(0);
    expect(by("slime")).toMatchObject({ known: true, kills: 1 });
    expect(progressText(rows)).toBe(`2 de ${rows.length} conhecidos`);
  });
});

describe("chanceText / damageLabel", () => {
  it("formata chances e tipos de dano", () => {
    expect(chanceText(1)).toBe("sempre");
    expect(chanceText(0.35)).toBe("35%");
    expect(chanceText(0.025)).toBe("2,5%");
    expect(chanceText(0.01)).toBe("1%");
    expect(damageLabel("fire")).toBe("fogo");
    expect(damageLabel("novo")).toBe("novo");
  });
});
