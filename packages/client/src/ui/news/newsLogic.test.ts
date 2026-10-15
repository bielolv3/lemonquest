import { describe, expect, it } from "vitest";
import { shouldAutoShowNews } from "./newsLogic.ts";

describe("shouldAutoShowNews", () => {
  it("personagem novo (level 1 sem XP) não vê sozinho", () => {
    expect(shouldAutoShowNews({ seen: null, level: 1, xp: 0 }, "b")).toBe(false);
  });
  it("quem já joga e não viu o mais recente vê; quem viu não vê de novo", () => {
    expect(shouldAutoShowNews({ seen: null, level: 5, xp: 300 }, "b")).toBe(true);
    expect(shouldAutoShowNews({ seen: "a", level: 5, xp: 300 }, "b")).toBe(true);
    expect(shouldAutoShowNews({ seen: "b", level: 5, xp: 300 }, "b")).toBe(false);
  });
  it("level 1 mas com XP já conta como quem joga", () => {
    expect(shouldAutoShowNews({ seen: null, level: 1, xp: 40 }, "b")).toBe(true);
  });
});
