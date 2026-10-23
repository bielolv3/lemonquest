// Tons de tingimento das roupas: catálogo consistente (ids/nomes/cores) e consulta segura.
import { describe, expect, it } from "vitest";
import { OUTFIT_TONES, OUTFIT_TONE_PRICE, toneColor, toneDef } from "./outfitTones.ts";

describe("OUTFIT_TONES", () => {
  it("ids e nomes únicos e não vazios; preço inteiro positivo", () => {
    expect(OUTFIT_TONES.length).toBeGreaterThan(0);
    expect(new Set(OUTFIT_TONES.map((t) => t.id)).size).toBe(OUTFIT_TONES.length);
    expect(new Set(OUTFIT_TONES.map((t) => t.name)).size).toBe(OUTFIT_TONES.length);
    for (const t of OUTFIT_TONES) {
      expect(t.id, t.id).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(t.name.trim().length, t.id).toBeGreaterThan(0);
    }
    expect(Number.isInteger(OUTFIT_TONE_PRICE)).toBe(true);
    expect(OUTFIT_TONE_PRICE).toBeGreaterThan(0);
  });

  it("cor é um inteiro 0xRRGGBB, distinta entre tons e nunca branco (branco = sem tingimento)", () => {
    for (const t of OUTFIT_TONES) {
      expect(Number.isInteger(t.color), t.id).toBe(true);
      expect(t.color, t.id).toBeGreaterThanOrEqual(0);
      expect(t.color, t.id).toBeLessThanOrEqual(0xffffff);
      expect(t.color, t.id).not.toBe(0xffffff);
    }
    expect(new Set(OUTFIT_TONES.map((t) => t.color)).size).toBe(OUTFIT_TONES.length);
  });

  it("toneDef acha cada tom e devolve undefined para id desconhecido, vazio ou ausente", () => {
    for (const t of OUTFIT_TONES) expect(toneDef(t.id)).toBe(t);
    expect(toneDef("x")).toBeUndefined();
    expect(toneDef("")).toBeUndefined();
    expect(toneDef(undefined)).toBeUndefined();
    expect(toneDef(null)).toBeUndefined();
  });

  it("toneColor devolve a cor do tom e branco (sem tingimento) para o resto", () => {
    for (const t of OUTFIT_TONES) expect(toneColor(t.id)).toBe(t.color);
    expect(toneColor("x")).toBe(0xffffff);
    expect(toneColor("")).toBe(0xffffff);
    expect(toneColor(undefined)).toBe(0xffffff);
  });
});
