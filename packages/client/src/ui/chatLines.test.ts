import { describe, expect, it } from "vitest";
import { pushLine } from "./chatLines.ts";

const line = (channel: "global" | "party" | "system", text: string) => ({ from: "x", text, channel, ts: 0 });

describe("chat: histórico por aba", () => {
  it("cada aba guarda as últimas 80; o grupo falante não apaga o Geral", () => {
    let l = pushLine([], line("global", "g0"));
    for (let i = 0; i < 200; i++) l = pushLine(l, line("party", `p${i}`));
    expect(l.filter((x) => x.channel === "party")).toHaveLength(80);
    expect(l.filter((x) => x.channel === "party")[0]!.text).toBe("p120");
    expect(l.some((x) => x.text === "g0")).toBe(true);
    for (let i = 0; i < 90; i++) l = pushLine(l, line(i % 2 ? "system" : "global", `s${i}`));
    expect(l.filter((x) => x.channel !== "party")).toHaveLength(80); // Geral = global + sistema
    expect(l.some((x) => x.text === "g0")).toBe(false);
    expect(new Set(l.map((x) => x.key)).size).toBe(l.length); // chaves únicas
  });
});
