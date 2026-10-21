import { describe, expect, it } from "vitest";
import { parseOrder } from "./slotOrder.ts";

describe("parseOrder", () => {
  it("lê JSON válido e tolera lixo", () => {
    expect(parseOrder('["a",null,"c"]')).toEqual(["a", null, "c"]);
    expect(parseOrder('["a",3,{}]')).toEqual(["a", null, null]);
    expect(parseOrder("não é json")).toBeNull();
    expect(parseOrder('{"a":1}')).toBeNull();
    expect(parseOrder(null)).toBeNull();
  });
});
