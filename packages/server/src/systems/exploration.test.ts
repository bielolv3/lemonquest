import { describe, expect, it } from "vitest";
import { EXPLORE_RADIUS, ExploredMask } from "@tibinha/shared";
import { ExplorationSystem } from "./exploration.ts";
import type { CharacterRecord } from "../persistence/types.ts";

const rec = (explored?: string): CharacterRecord => ({
  id: 1, name: "a", vocation: "knight", level: 1, xp: 0, x: null, y: null, dir: 4, data: { explored },
});

describe("ExplorationSystem", () => {
  it("revela ao entrar e devolve a máscara", () => {
    const s = new ExplorationSystem(40, 30);
    const msg = s.addPlayer("s1", rec(), 20, 15);
    expect(msg).toMatchObject({ width: 40, height: 30 });
    const m = ExploredMask.fromBase64(40, 30, msg.bits);
    expect(m.has(20, 15)).toBe(true);
    expect(m.has(20 + EXPLORE_RADIUS, 15)).toBe(true);
    expect(m.has(0, 0)).toBe(false);
  });

  it("revela ao mover e ignora tile repetido", () => {
    const s = new ExplorationSystem(40, 30);
    s.addPlayer("s1", rec(), 10, 10);
    expect(s.onPosition("s1", 10, 10)).toBe(false);
    expect(s.onPosition("s1", 25, 10)).toBe(true);
    expect(ExploredMask.fromBase64(40, 30, s.serialize("s1")).has(30, 10)).toBe(true);
    expect(s.onPosition("nope", 1, 1)).toBe(false);
  });

  it("persiste e recarrega", () => {
    const s = new ExplorationSystem(40, 30);
    s.addPlayer("s1", rec(), 10, 10);
    const saved = s.serialize("s1")!;
    s.removePlayer("s1");
    expect(s.serialize("s1")).toBeUndefined();
    const msg = s.addPlayer("s2", rec(saved), 35, 25);
    const m = ExploredMask.fromBase64(40, 30, msg.bits);
    expect(m.has(10, 10)).toBe(true);
    expect(m.has(35, 25)).toBe(true);
  });
});
