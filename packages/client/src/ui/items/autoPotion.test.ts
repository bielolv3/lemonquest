import { describe, expect, it } from "vitest";
import { parseSettings, shouldDrink } from "./autoPotionLogic.ts";

describe("shouldDrink", () => {
  it("só bebe com a função ligada, vivo e no limite ou abaixo", () => {
    expect(shouldDrink(30, 100, 0, 1000, -Infinity)).toBe(false); // desligado
    expect(shouldDrink(0, 100, 50, 1000, -Infinity)).toBe(false); // morto
    expect(shouldDrink(30, 0, 50, 1000, -Infinity)).toBe(false); // máximo inválido
    expect(shouldDrink(60, 100, 50, 1000, -Infinity)).toBe(false); // acima do limite
    expect(shouldDrink(50, 100, 50, 1000, -Infinity)).toBe(true); // no limite
    expect(shouldDrink(10, 100, 50, 1000, -Infinity)).toBe(true);
  });

  it("respeita o intervalo mínimo entre goles", () => {
    expect(shouldDrink(10, 100, 50, 1000, 500)).toBe(false);
    expect(shouldDrink(10, 100, 50, 1700, 500)).toBe(true);
    expect(shouldDrink(10, 100, 50, 1000, 500, 400)).toBe(true);
  });
});

describe("parseSettings", () => {
  it("lê o salvo, arredonda em 5, limita em 0–90 e ignora lixo", () => {
    expect(parseSettings('{"hp":40,"mana":0}')).toEqual({ hp: 40, mana: 0 });
    expect(parseSettings('{"hp":43,"mana":200}')).toEqual({ hp: 45, mana: 90 });
    expect(parseSettings('{"hp":-5,"mana":"x"}')).toEqual({ hp: 0, mana: 0 });
    expect(parseSettings("não é json")).toEqual({ hp: 0, mana: 0 });
    expect(parseSettings(null)).toEqual({ hp: 0, mana: 0 });
  });
});
