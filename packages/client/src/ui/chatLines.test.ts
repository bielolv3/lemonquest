import { describe, expect, it } from "vitest";
import { MAX_LINES, MAX_NOTICE_LINES, NOTICE_REPEAT_MS, pushLine, pushNotice } from "./chatLines.ts";

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

describe("chat: avisos copiados", () => {
  it("vira linha esmaecida do Geral; o mesmo texto em seguida não repete", () => {
    let l = pushNotice([], "Mochila cheia.", 1000);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ dim: true, channel: "system", text: "Mochila cheia." });
    l = pushNotice(l, "Mochila cheia.", 2000);
    expect(l).toHaveLength(1);
    l = pushNotice(l, "Sem poção de vida.", 2100);
    expect(l).toHaveLength(2);
    l = pushNotice(l, "Mochila cheia.", 1000 + NOTICE_REPEAT_MS);
    expect(l).toHaveLength(3);
  });

  it("contador no texto não fura o filtro de repetição", () => {
    let l = pushNotice([], "Você não pode entrar na zona de proteção (mais 42 s).", 0);
    l = pushNotice(l, "Você não pode entrar na zona de proteção (mais 39 s).", 3000);
    expect(l).toHaveLength(1);
  });

  it("no máximo MAX_NOTICE_LINES avisos; saem os avisos mais antigos, a conversa fica", () => {
    let l = pushLine([], line("global", "oi"));
    for (let i = 0; i < 100; i++) l = pushNotice(l, `Aviso ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? "!" : ""}${i}`, i * NOTICE_REPEAT_MS);
    expect(l.filter((x) => x.dim)).toHaveLength(MAX_NOTICE_LINES);
    expect(l.some((x) => x.text === "oi")).toBe(true);
    expect(l.at(-1)!.text).toBe("Aviso V!99");
    expect(l.length).toBeLessThanOrEqual(MAX_LINES);
  });
});
