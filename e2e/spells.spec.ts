// Magias do fim de jogo (lv 35–90) no jogo de verdade: palavras no chat → conjura (gasta mana). A Fúria do cavaleiro
// aparece na faixa de condições.
import { expect, test, type Page } from "@playwright/test";
import { enterGame, meState, say, setLevel, targetNearest, teleport, walkableNear } from "./helpers.ts";

/** Floresta ao norte da vila (fora da PZ; ratos e gosmas para os alvos). */
const FOREST = { x: 70, y: 62 };

async function castSpends(page: Page, words: string, needsTarget: boolean): Promise<void> {
  if (needsTarget) await targetNearest(page);
  const mana0 = (await meState(page))!.mana as number;
  await say(page, words);
  await expect.poll(async () => (await meState(page))!.mana as number, { timeout: 5000, message: words }).toBeLessThan(mana0);
  await page.waitForTimeout(1100); // recarga global
}

test("feiticeiro lv 90: as 4 magias novas conjuram pelas palavras", async ({ page }) => {
  test.setTimeout(120_000);
  await enterGame(page, "sorcerer");
  await setLevel(page, 90);
  const spot = (await walkableNear(page, FOREST.x, FOREST.y, 4))[0]!;
  await teleport(page, spot.x, spot.y);
  await castSpends(page, "exevo flam hur", false);
  await castSpends(page, "exori mort", true);
  await castSpends(page, "exevo gran mas vis", false);
  await castSpends(page, "exori gran flam", true);
  // Os atalhos padrão (1–0) não comportam as 12 magias: as duas últimas ficam para o jogador pôr no painel.
  await expect(page.locator(".action-slot")).toHaveCount(10);
});

test("cavaleiro lv 50: Fúria (utito tempo) gasta mana e aparece nas condições", async ({ page }) => {
  await enterGame(page, "knight");
  await setLevel(page, 50);
  const spot = (await walkableNear(page, FOREST.x, FOREST.y, 4))[0]!;
  await teleport(page, spot.x, spot.y);
  await castSpends(page, "utito tempo", false);
  await expect(page.locator(".conditions [data-tip^='Fúria']")).toHaveCount(1);
  await castSpends(page, "exori min", false);
});
