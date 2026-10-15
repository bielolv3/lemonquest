// Conquistas: primeiro abate → toast, janela (J) com a conquista, janela de roupas com roupa bloqueada, ranking (R).
import { expect, test } from "@playwright/test";
import { enterGame, me, monsters, say, setLevel, teleport, targetNearest, walkableNear } from "./helpers.ts";

test("conquista: primeiro abate → toast, janela J, roupa bloqueada, ranking", async ({ page }) => {
  await enterGame(page, "knight");
  await setLevel(page, 60);
  await say(page, "/heal");
  // Rato (fraco): acha um e vai até ele.
  const rat = (await monsters(page)).find((m) => m.defId === "rat");
  expect(rat, "algum rato no mapa").toBeTruthy();
  const spot = (await walkableNear(page, rat!.x, rat!.y, 2))[0]!;
  await teleport(page, spot.x, spot.y);
  await targetNearest(page, (d) => d === "rat");
  const toast = page.locator(".toast", { hasText: "Conquista desbloqueada!" });
  await expect(toast.first()).toContainText("Primeiro Sangue", { timeout: 60_000 });

  await page.keyboard.press("j");
  const win = page.getByRole("dialog", { name: "Conquistas" });
  await expect(win).toBeVisible();
  await expect(win.locator('[data-ach="first_blood"]')).toHaveClass(/done/);
  await page.keyboard.press("j");
  await expect(win).toBeHidden();

  await page.keyboard.press("o");
  const outfit = page.getByRole("dialog", { name: "Roupas" });
  await expect(outfit).toBeVisible();
  const locked = outfit.locator('.outfit-cell[data-locked="true"]', { hasText: "Pirata" });
  await expect(locked).toBeVisible();
  await locked.click();
  await expect(outfit.locator(".outfit-hint")).toContainText("Desbloqueie: Chegue à onda 20 do Coliseu");
  await expect(outfit.getByRole("button", { name: "OK" })).toBeDisabled();
  await page.keyboard.press("Escape");

  await page.keyboard.press("r");
  const rank = page.getByRole("dialog", { name: "Ranking" });
  await expect(rank).toBeVisible();
  await expect(rank.locator(".rank-table tbody tr").first()).toBeVisible();
  const json = await (await page.request.get("/api/ranking")).json();
  expect(json.categories.map((c: any) => c.id)).toContain("level");
  // Página pública do ranking (segunda entrada do build: já sumiu do dist uma vez).
  const pageRes = await page.request.get("/ranking");
  expect(pageRes.ok()).toBe(true);
  expect(await pageRes.text()).toContain('id="grid"');
  expect(await me(page)).toBeTruthy();
});
