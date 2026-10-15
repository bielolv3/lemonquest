import { describe, expect, it } from "vitest";
import { arrange, parseOrder, swapped } from "./slotOrder.ts";

describe("arrange", () => {
  it("sem ordem salva: a ordem padrão nos primeiros slots", () => {
    expect(arrange(["a", "b", "c"], null, 5)).toEqual(["a", "b", "c", null, null]);
  });

  it("ordem salva volta ao lugar; magia nova ocupa o primeiro vazio", () => {
    expect(arrange(["a", "b", "c", "d"], ["c", null, "a"], 5)).toEqual(["c", "b", "a", "d", null]);
  });

  it("ignora magia que a vocação não tem, repetida e lixo; corta o excesso", () => {
    expect(arrange(["a", "b"], ["x", "a", "a", "b"], 3)).toEqual(["b", "a", null]); // "x" some, "a" repetida some, "b" (salva fora dos 3) vai ao 1º vazio
    expect(arrange(["a", "b", "c"], ["c"], 2)).toEqual(["c", "a"]); // só cabem 2
  });
});

describe("swapped", () => {
  it("troca dois slots, inclusive com vazio, sem alterar o original", () => {
    const o = ["a", null, "c"];
    expect(swapped(o, 0, 2)).toEqual(["c", null, "a"]);
    expect(swapped(o, 0, 1)).toEqual([null, "a", "c"]);
    expect(o).toEqual(["a", null, "c"]);
  });
  it("índices iguais ou fora do alcance não mudam nada", () => {
    expect(swapped(["a", "b"], 1, 1)).toEqual(["a", "b"]);
    expect(swapped(["a", "b"], 0, 5)).toEqual(["a", "b"]);
    expect(swapped(["a", "b"], -1, 0)).toEqual(["a", "b"]);
  });
});

describe("parseOrder", () => {
  it("lê JSON válido e tolera lixo", () => {
    expect(parseOrder('["a",null,"c"]')).toEqual(["a", null, "c"]);
    expect(parseOrder('["a",3,{}]')).toEqual(["a", null, null]);
    expect(parseOrder("não é json")).toBeNull();
    expect(parseOrder('{"a":1}')).toBeNull();
    expect(parseOrder(null)).toBeNull();
  });
});
