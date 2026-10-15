// Balões do chat: o que um jogador fala aparece sobre a cabeça dele para ele e para quem está perto.
import { expect, test, type Page } from "@playwright/test";
import { enterGame, say, teleport, walkableNear, waitSettled } from "./helpers.ts";

const FOREST = { x: 70, y: 62 };
const speech = (p: Page) => p.evaluate(() => (window as any).__lq.speech() as { from: string; text: string; color: string }[]);

test("chat sobre a cabeça: geral em amarelo para os dois e fala some sozinha", async ({ browser }) => {
  test.setTimeout(120_000);
  const ca = await browser.newContext(), cb = await browser.newContext();
  const a = await ca.newPage(), b = await cb.newPage();
  try {
    const pa = await enterGame(a, "knight");
    await enterGame(b, "druid");
    const tiles = await walkableNear(a, FOREST.x, FOREST.y, 4);
    const ta = tiles[0]!;
    const tb = tiles.find((t) => Math.max(Math.abs(t.x - ta.x), Math.abs(t.y - ta.y)) === 2)!;
    await teleport(a, ta.x, ta.y);
    await teleport(b, tb.x, tb.y);
    const bId = await b.evaluate(() => (window as any).__lq.myId() as string);
    await expect.poll(() => a.evaluate((id) => (window as any).__lq.players().some((p: any) => p.id === id), bId)).toBe(true);
    await waitSettled(a);

    await say(a, "ola mundo");
    // Quem fala e quem vê: o texto está sobre o ator de A, em amarelo.
    for (const p of [a, b]) {
      await expect.poll(() => speech(p)).toEqual([expect.objectContaining({ from: pa.name, text: "ola mundo", color: "#ffe84d" })]);
    }
    // Some sozinha (3,5 s + fade).
    await expect.poll(() => speech(b), { timeout: 10_000 }).toEqual([]);
  } finally {
    await ca.close(); await cb.close();
  }
});
