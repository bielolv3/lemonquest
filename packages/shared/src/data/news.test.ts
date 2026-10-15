import { describe, expect, it } from "vitest";
import { LATEST_NEWS_ID, NEWS } from "./news.ts";

describe("novidades", () => {
  it("ids únicos, mais nova primeiro, textos curtos e preenchidos", () => {
    expect(NEWS.length).toBeGreaterThan(0);
    expect(new Set(NEWS.map((n) => n.id)).size).toBe(NEWS.length);
    expect(LATEST_NEWS_ID).toBe(NEWS[0]!.id);
    const ids = NEWS.map((n) => n.id);
    expect([...ids].sort().reverse()).toEqual(ids); // datas ISO: ordem decrescente
    for (const n of NEWS) {
      expect(n.title.length).toBeGreaterThan(3);
      expect(n.items.length).toBeGreaterThan(0);
      for (const i of n.items) { expect(i.length).toBeGreaterThan(8); expect(i.length).toBeLessThan(200); }
    }
  });
});
