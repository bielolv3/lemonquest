// Pesca: Vara de Pesca na mochila → botão direito na água → "Pescar" → boia → o peixe morde (ou escapa).
import { expect, test, type Page } from "@playwright/test";
import { clickTile, enterGame, say, setLevel, teleport, waitSettled } from "./helpers.ts";

/** Margem (tile andável com 3 tiles de água em frente) mais longe de qualquer monstro. */
async function quietShore(page: Page) {
  return page.evaluate(() => {
    const lq = (window as any).__lq;
    const mons = lq.monsters() as { x: number; y: number }[];
    let best: { x: number; y: number; wx: number; wy: number; d: number } | null = null;
    for (let y = 12; y < 96; y++) for (let x = 17; x < 156; x++) {
      if (!lq.walkable(x, y) || lq.isWater(x, y) || !lq.walkable(x, y + 1)) continue;
      let wx = -1;
      for (let dx = 1; dx <= 3; dx++) if ([-1, 0, 1].every((dy) => lq.isWater(x + dx, y + dy) && !lq.walkable(x + dx, y + dy))) { wx = x + dx; break; } // água funda, sem ponte
      if (wx < 0) continue;
      const d = mons.reduce((m, o) => Math.min(m, Math.max(Math.abs(o.x - x), Math.abs(o.y - y))), 999);
      if (!best || d > best.d) best = { x, y, wx, wy: y, d };
    }
    return best;
  });
}

const bobbers = (p: Page) => p.evaluate(() => (window as any).__lq.bobbers() as number);

test("pesca: lançar a linha na água, ver a boia e receber o resultado", async ({ page }) => {
  test.setTimeout(90_000);
  await enterGame(page, "knight");
  await setLevel(page, 40); // o lago fica em terreno de lobos: aguenta alguns golpes enquanto espera o peixe
  await say(page, "/item fishing_rod");

  // Margem (tile andável com água ao lado) mais longe de qualquer monstro: lobo por perto solta a linha.
  const spot = await quietShore(page);
  expect(spot, "o mapa tem margem de água").not.toBeNull();
  expect(spot!.d, "margem longe dos monstros").toBeGreaterThan(6);
  await teleport(page, spot!.x, spot!.y);
  await waitSettled(page);

  await clickTile(page, spot!.wx, spot!.wy, { button: "right" });
  await page.locator(".ctx-menu").getByRole("menuitem", { name: "Pescar" }).click();
  await expect(page.locator(".toast").filter({ hasText: "lança a linha" })).toBeVisible();
  await expect.poll(() => bobbers(page)).toBe(1);

  // Depois de ~5 s parado: peixe na mochila ou "escapou". A boia some.
  await expect(page.locator(".toast").filter({ hasText: /Você pescou|escapou/ })).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => bobbers(page)).toBe(0);
});

test("pesca: sem vara avisa, e andar solta a linha", async ({ page }) => {
  test.setTimeout(90_000);
  await enterGame(page, "paladin");
  await setLevel(page, 40); // sobrevive a um monstro que apareça perto da margem
  const spot = await quietShore(page);
  await teleport(page, spot!.x, spot!.y);
  await waitSettled(page);
  await clickTile(page, spot!.wx, spot!.wy, { button: "right" });
  await page.locator(".ctx-menu").getByRole("menuitem", { name: "Pescar" }).click();
  await expect(page.locator(".toast").filter({ hasText: "Vara de Pesca" })).toBeVisible();
  expect(await bobbers(page)).toBe(0);

  // Com a vara: lança, anda um passo e a linha se solta.
  await say(page, "/item fishing_rod");
  await clickTile(page, spot!.wx, spot!.wy, { button: "right" });
  await page.locator(".ctx-menu").getByRole("menuitem", { name: "Pescar" }).click();
  await expect.poll(() => bobbers(page)).toBe(1);
  await teleport(page, spot!.x, spot!.y + 1);
  await expect(page.locator(".toast").filter({ hasText: "linha se soltou" })).toBeVisible();
  await expect.poll(() => bobbers(page)).toBe(0);
});
