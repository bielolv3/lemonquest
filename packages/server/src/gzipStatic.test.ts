import { describe, expect, it } from "vitest";
import { acceptsGzip, gzipCandidate } from "./gzipStatic.ts";

describe("acceptsGzip", () => {
  it("aceita gzip simples, com peso e via curinga", () => {
    expect(acceptsGzip("gzip, deflate, br")).toBe(true);
    expect(acceptsGzip("GZIP")).toBe(true);
    expect(acceptsGzip("deflate, gzip;q=0.5")).toBe(true);
    expect(acceptsGzip("*")).toBe(true);
  });
  it("recusa quando ausente, q=0 ou outra codificação", () => {
    expect(acceptsGzip(undefined)).toBe(false);
    expect(acceptsGzip("")).toBe(false);
    expect(acceptsGzip("gzip;q=0")).toBe(false);
    expect(acceptsGzip("br, deflate")).toBe(false);
    expect(acceptsGzip("gzip;q=0, *")).toBe(false);
  });
});

describe("gzipCandidate", () => {
  it("mapeia as páginas, os bundles e o mapa para o .gz do dist", () => {
    expect(gzipCandidate("/")).toEqual({ gz: "index.html.gz", type: "text/html; charset=utf-8", cacheControl: "public, max-age=0" });
    expect(gzipCandidate("/index.html")?.gz).toBe("index.html.gz");
    expect(gzipCandidate("/ranking")?.gz).toBe("ranking.html.gz");
    expect(gzipCandidate("/ranking.html")?.gz).toBe("ranking.html.gz");
    expect(gzipCandidate("/maps/world.json")).toEqual({ gz: "maps/world.json.gz", type: "application/json; charset=utf-8", cacheControl: "public, max-age=0" });
    expect(gzipCandidate("/assets/main-DyXB.js")).toEqual({ gz: "assets/main-DyXB.js.gz", type: "text/javascript; charset=utf-8", cacheControl: "public, max-age=31536000, immutable" });
    expect(gzipCandidate("/assets/main-Cll2.css")).toMatchObject({ gz: "assets/main-Cll2.css.gz", type: "text/css; charset=utf-8" });
  });
  it("ignora a query string", () => {
    expect(gzipCandidate("/maps/world.json?v=3")?.gz).toBe("maps/world.json.gz");
  });
  it("deixa passar o que não é comprimido no build", () => {
    expect(gzipCandidate("/api/ranking")).toBeNull();
    expect(gzipCandidate("/ninja/Audio/Jingles/LevelUp1.wav")).toBeNull();
    expect(gzipCandidate("/assets/phaser.js.map")).toBeNull();
    expect(gzipCandidate("/assets/sub/x.js")).toBeNull();
    expect(gzipCandidate("/maps/other.json")).toBeNull();
    expect(gzipCandidate("/health")).toBeNull();
  });
  it("recusa travessia de diretório", () => {
    expect(gzipCandidate("/assets/../index.html")).toBeNull();
    expect(gzipCandidate("/assets/..%2Fx.js")).toBeNull();
    expect(gzipCandidate("/assets/a\\b.js")).toBeNull();
  });
});
