// Atalhos de magia (painel H): trocar a tecla de uma magia, tecla do jogo recusada, lançar pela tecla nova, salvo no
// personagem (volta depois de recarregar a página) e troca de magias arrastando na barra.
import { expect, test } from "@playwright/test";
import { enterGame, meState, playFromList, setLevel, snap, teleport, walkableNear } from "./helpers.ts";

/** Floresta ao norte da vila (fora da PZ: a regen de mana é baixa e o gasto da magia aparece). */
const FOREST = { x: 70, y: 62 };

test("atalhos: trocar a tecla da Cura para G, recusar Q, lançar com G e manter depois de recarregar", async ({ page }) => {
  const p = await enterGame(page, "druid");
  await setLevel(page, 20);
  const spot = (await walkableNear(page, FOREST.x, FOREST.y, 4))[0]!;
  await teleport(page, spot.x, spot.y);
  const canvas = page.locator("#game canvas");
  await canvas.hover({ position: { x: 300, y: 300 } });

  // Padrão: Cura na tecla 1.
  const first = page.locator(".action-slot").first();
  await expect(first.locator(".action-key")).toHaveText("1");

  await page.keyboard.press("h");
  const win = page.getByRole("dialog", { name: "Atalhos de magia" });
  await expect(win).toBeVisible();
  await expect(win.getByRole("combobox", { name: "Magia do atalho 1", exact: true })).toHaveValue("light_heal");
  await win.getByRole("button", { name: "Tecla do atalho 1", exact: true }).click();
  await expect(win).toContainText("Pressione uma tecla");
  // Q é a poção de vida: recusada com o motivo, e nada de poção (continua esperando a tecla).
  await page.keyboard.press("q");
  await expect(win).toContainText("usada por: Poção de vida");
  await page.keyboard.press("g");
  await expect(win.getByRole("button", { name: "Tecla do atalho 1", exact: true })).toHaveText("G");
  await snap(page, "hotkeys-window");
  await page.keyboard.press("Escape");
  await expect(win).toBeHidden();

  await expect(first.locator(".action-key")).toHaveText("G");
  const mana0 = (await meState(page))!.mana as number;
  await canvas.hover({ position: { x: 300, y: 300 } });
  await page.keyboard.press("g");
  await expect.poll(async () => (await meState(page))!.mana as number, { timeout: 5000 }).toBeLessThan(mana0);
  await expect(first).toHaveClass(/cooling/);

  // Salvo no personagem: recarregar a página e entrar de novo mantém o G.
  await page.reload();
  await playFromList(page, p);
  await expect(page.locator(".action-slot").first().locator(".action-key")).toHaveText("G");
});

test("atalhos: arrastar um slot sobre outro troca as magias e as teclas ficam", async ({ page }) => {
  await enterGame(page, "sorcerer");
  const slots = page.locator(".action-slot");
  const words = async (i: number) => (await slots.nth(i).getAttribute("data-tip")) ?? "";
  const a = await words(0), b = await words(1);
  expect(a).not.toBe(b);
  // Arrasto de verdade com o mouse (mousedown → movimentos → mouseup), como o jogador faz.
  const from = (await slots.nth(0).boundingBox())!, to = (await slots.nth(1).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 6, from.y + from.height / 2, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => words(0)).toBe(b);
  expect(await words(1)).toBe(a);
  await expect(slots.nth(0).locator(".action-key")).toHaveText("1");
  await expect(slots.nth(1).locator(".action-key")).toHaveText("2");
});
