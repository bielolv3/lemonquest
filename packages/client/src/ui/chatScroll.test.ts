import { describe, expect, it } from "vitest";
import { addedLines, decideScroll, isAtBottom, STICK_PX, unseenText } from "./chatScroll.ts";

describe("chat: rolagem ao receber linhas", () => {
  it("no fim (até 8 px) conta como colado; uma linha acima já não", () => {
    expect(isAtBottom(0, 136, 136)).toBe(true);
    expect(isAtBottom(100, 136, 236 + STICK_PX)).toBe(true);
    expect(isAtBottom(100, 136, 236 + STICK_PX + 1)).toBe(false);
    expect(isAtBottom(100, 136, 236 + 18)).toBe(false);
  });

  it("colado no fim rola e zera; lendo o histórico fica e acumula", () => {
    expect(decideScroll(true, 5, 2)).toEqual({ scroll: true, unseen: 0 });
    expect(decideScroll(false, 0, 2)).toEqual({ scroll: false, unseen: 2 });
    expect(decideScroll(false, 2, 3)).toEqual({ scroll: false, unseen: 5 });
    expect(decideScroll(false, 2, 0)).toEqual({ scroll: false, unseen: 2 });
  });

  it("conta só as linhas novas da aba visível (chaves únicas; o corte do histórico não conta)", () => {
    const prev = [{ key: "a", tab: "g" }, { key: "b", tab: "g" }];
    const next = [{ key: "b", tab: "g" }, { key: "c", tab: "g" }, { key: "d", tab: "p" }];
    expect(addedLines(prev, next, (l) => l.tab === "g")).toBe(1);
    expect(addedLines(prev, next, () => true)).toBe(2);
    expect(addedLines(next, next, () => true)).toBe(0);
  });

  it("pílula no singular e no plural", () => {
    expect(unseenText(1)).toBe("↓ 1 nova");
    expect(unseenText(4)).toBe("↓ 4 novas");
  });
});
