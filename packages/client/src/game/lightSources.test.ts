import { describe, expect, it } from "vitest";
import { cullLights, extractMapLights, flickerWave, parseColor } from "./lightSources.ts";
import type { TiledMap } from "@lemonquest/shared";

describe("culling de luzes", () => {
  const lights = [{ x: 0, y: 0, r: 10 }, { x: 100, y: 100, r: 10 }, { x: 205, y: 50, r: 20 }];
  it("mantém só as que tocam a tela", () => {
    expect(cullLights(lights, { x0: 90, y0: 90, x1: 190, y1: 190 })).toEqual([lights[1]]);
    expect(cullLights(lights, { x0: 190, y0: 40, x1: 300, y1: 60 })).toEqual([lights[2]]);
  });
});
describe("fontes de luz do mapa", () => {
  it("lê objetos light com props", () => {
    const m = { width: 4, height: 4, tilewidth: 16, tileheight: 16, tilesets: [], layers: [{ name: "objects", type: "objectgroup", objects: [
      { id: 1, name: "", type: "light", x: 16, y: 16, width: 0, height: 0, properties: [{ name: "radius", type: "int", value: 5 }, { name: "color", type: "string", value: "#ff0000" }, { name: "flicker", type: "bool", value: true }] },
    ] }] } as unknown as TiledMap;
    const l = extractMapLights(m);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ r: 80, color: 0xff0000, kind: "light" });
    expect(l[0].flicker).toBeGreaterThan(0);
  });
  it("cor inválida cai no padrão; flicker é limitado", () => {
    expect(parseColor("xx")).toBe(0xffc470);
    expect(Math.abs(flickerWave(12345, 1))).toBeLessThanOrEqual(1);
  });
});
