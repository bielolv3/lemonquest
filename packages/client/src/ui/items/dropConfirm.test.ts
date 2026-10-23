import { describe, expect, it } from "vitest";
import { RARITIES } from "@lemonquest/shared";
import { dropConfirmText, needsDropConfirm } from "./dropConfirm.ts";

describe("largar no chão por arrasto", () => {
  it("comum e incomum largam direto; raro, épico e lendário pedem confirmação", () => {
    expect(RARITIES.filter((rarity) => needsDropConfirm({ rarity }))).toEqual(["rare", "epic", "legendary"]);
    expect(needsDropConfirm({ rarity: "common" })).toBe(false);
    expect(needsDropConfirm({ rarity: "uncommon" })).toBe(false);
  });

  it("texto avisa que qualquer um pode pegar", () => {
    expect(dropConfirmText("Espada Longa", "Raro")).toBe("Largar Espada Longa (raro) no chão? Qualquer um pode pegar.");
  });
});
