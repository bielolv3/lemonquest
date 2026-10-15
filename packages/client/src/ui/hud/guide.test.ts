import { describe, expect, it } from "vitest";
import { GUIDE_FOREST, GUIDE_MAX_LEVEL, guideTarget } from "./guide.ts";

const none = () => 0;
const active = (n: number) => ({ active: [{ id: "rats_barn", progress: [n] }], done: [] as string[] }) as any;

describe("guideTarget (primeira missão)", () => {
  it("sem missão aceita: aponta o Capitão", () => {
    expect(guideTarget(1, { active: [], done: [] }, none)).toMatchObject({ kind: "npc", id: "guard_captain" });
  });
  it("aceita: aponta a floresta; com 5 ratos: volta ao Capitão", () => {
    expect(guideTarget(1, active(2), none)).toMatchObject({ kind: "tile", ...GUIDE_FOREST });
    expect(guideTarget(1, active(5), none)).toMatchObject({ kind: "npc", id: "guard_captain" });
  });
  it("some quando a missão termina, passando do level ou sem estado", () => {
    expect(guideTarget(2, { active: [], done: ["rats_barn"] }, none)).toBeNull();
    expect(guideTarget(GUIDE_MAX_LEVEL + 1, { active: [], done: [] }, none)).toBeNull();
    expect(guideTarget(1, null, none)).toBeNull();
  });
});
