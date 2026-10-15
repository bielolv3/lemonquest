import { describe, expect, it } from "vitest";
import { A11Y_DEFAULT, a11yAttrs, parseA11y } from "./a11yLogic.ts";

describe("parseA11y", () => {
  it("lê o salvo e ignora lixo", () => {
    expect(parseA11y('{"text":2,"contrast":true,"motion":true}')).toEqual({ text: 2, contrast: true, motion: true });
    expect(parseA11y('{"text":9,"contrast":"sim"}')).toEqual(A11Y_DEFAULT);
    expect(parseA11y("não é json")).toEqual(A11Y_DEFAULT);
    expect(parseA11y(null)).toEqual(A11Y_DEFAULT);
  });
});

describe("a11yAttrs", () => {
  it("vira os atributos que o CSS usa", () => {
    expect(a11yAttrs(A11Y_DEFAULT)).toEqual({ "data-text": "0", "data-contrast": "normal", "data-motion": "normal" });
    expect(a11yAttrs({ text: 1, contrast: true, motion: true })).toEqual({ "data-text": "1", "data-contrast": "high", "data-motion": "reduce" });
  });
});
