// Desafios da semana: abre pelo diário de missões (L), mostra as 3 metas zeradas e o bônus bloqueado.
import { expect, test } from "@playwright/test";
import { enterGame } from "./helpers.ts";

test("desafios da semana: metas, progresso zerado e bônus bloqueado", async ({ page }) => {
  test.setTimeout(60_000);
  await enterGame(page, "knight");
  await page.keyboard.press("l");
  await page.getByRole("button", { name: "Desafios semanais" }).click();
  const win = page.getByRole("dialog", { name: "Desafios da semana" });
  await expect(win).toBeVisible();
  for (const id of ["cacada", "pescaria", "evolucao"]) {
    const goal = win.locator(`[data-goal="${id}"]`);
    await expect(goal).toBeVisible();
    await expect(goal.getByRole("button", { name: "Resgatar" })).toBeDisabled();
  }
  await expect(win.locator('[data-goal="cacada"]')).toContainText("0 / 150");
  await expect(win.locator('[data-goal="bonus"]').getByRole("button")).toBeDisabled();
  await expect(win).toContainText("Zera em");
  await page.keyboard.press("Escape");
  await expect(win).toHaveCount(0);
});
