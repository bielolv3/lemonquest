import { describe, expect, it } from "vitest";
import { ExploredMask } from "./explore.ts";

describe("ExploredMask", () => {
  it("revela um disco e conta tiles novos", () => {
    const m = new ExploredMask(50, 50);
    const n = m.reveal(25, 25, 3);
    expect(n).toBeGreaterThan(20);
    expect(m.has(25, 25)).toBe(true);
    expect(m.has(28, 25)).toBe(true);
    expect(m.has(28, 28)).toBe(false); // canto arredondado
    expect(m.reveal(25, 25, 3)).toBe(0);
  });
  it("respeita as bordas", () => {
    const m = new ExploredMask(10, 10);
    m.reveal(0, 0, 4);
    expect(m.has(0, 0)).toBe(true);
    expect(m.has(-1, 0)).toBe(false);
    expect(m.has(10, 0)).toBe(false);
    m.reveal(9, 9, 4);
    expect(m.has(9, 9)).toBe(true);
  });
  it("base64 ida e volta; entrada inválida ou vazia gera máscara vazia", () => {
    const m = new ExploredMask(33, 7);
    m.reveal(16, 3, 5);
    const r = ExploredMask.fromBase64(33, 7, m.toBase64());
    expect(Array.from(r.bits)).toEqual(Array.from(m.bits));
    expect(ExploredMask.fromBase64(33, 7, undefined).has(16, 3)).toBe(false);
    expect(ExploredMask.fromBase64(33, 7, "%%%").has(16, 3)).toBe(false);
    expect(ExploredMask.fromBase64(33, 7, "AAAA").bits.length).toBe(Math.ceil((33 * 7) / 8));
  });
  it("mapa mais largo (expansão a leste): o que foi explorado continua nas mesmas coordenadas", () => {
    const m = new ExploredMask(28, 12);
    m.reveal(20, 6, 3);
    m.reveal(2, 1, 1);
    const r = ExploredMask.fromBase64(40, 12, m.toBase64(), 28);
    expect(r.width).toBe(40);
    for (let y = 0; y < 12; y++) for (let x = 0; x < 28; x++) expect(r.has(x, y), `${x},${y}`).toBe(m.has(x, y));
    for (let y = 0; y < 12; y++) for (let x = 28; x < 40; x++) expect(r.has(x, y)).toBe(false);
    // mais estreito: não dá para reaproveitar
    expect(ExploredMask.fromBase64(20, 12, m.toBase64(), 28).has(20, 6)).toBe(false);
  });
});
