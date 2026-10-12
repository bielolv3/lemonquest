// Treino offline: clicar numa estátua → escolher a skill → desconexão 4101 (tela própria) → voltar → cartão de resultado.
import { expect, test } from "@playwright/test";
import { clickTile, enterGame, playFromList, snap, teleport, walkableNear } from "./helpers.ts";

test("treino offline: estátua → skill → tela 4101 → entrar de novo → resultado", async ({ page }) => {
  const p = await enterGame(page, "sorcerer");
  const statues = await page.evaluate(() => (window as any).__lq.statues() as { id: string; x: number; y: number }[]);
  expect(statues.length).toBeGreaterThan(0);
  const s = statues[0]!;
  // Perto (mas não ao lado): o clique faz o personagem andar até a estátua e abrir a escolha ao chegar.
  const spot = (await walkableNear(page, s.x, s.y + 3, 1))[0]!;
  await teleport(page, spot.x, spot.y);
  const win = page.getByRole("dialog", { name: "Treinamento offline" });
  await expect.poll(async () => {
    if (await win.isVisible()) return true;
    await clickTile(page, s.x, s.y - 1);
    await page.waitForTimeout(1500);
    return win.isVisible();
  }, { timeout: 20_000, intervals: [500] }).toBe(true);
  await expect(win.locator(".train-skill")).toHaveCount(4);
  await snap(page, "training-window");
  await win.locator(".train-skill", { hasText: "Magic Level" }).click();

  // Fechamento 4101: tela "Treinamento offline" (não a de "desconectado").
  const overlay = page.getByRole("alertdialog");
  await expect(overlay).toContainText("Treinamento offline", { timeout: 10_000 });
  await expect(overlay).toContainText("Magic Level");
  await snap(page, "training-4101");
  await overlay.getByRole("button", { name: "Voltar aos personagens" }).click();

  // Lista de personagens mostra o selo "Treinando".
  const card = page.locator(".char-card", { hasText: p.name });
  await expect(card.locator(".badge.training")).toContainText("Treinando: Magic Level", { timeout: 30_000 });
  await playFromList(page, p);
  const result = page.locator(".train-result");
  await expect(result).toBeVisible({ timeout: 10_000 });
  await expect(result).toContainText("Magic Level");
  await snap(page, "training-result");
  await result.getByRole("button", { name: "Ok" }).click();
  await expect(result).toBeHidden();
});
