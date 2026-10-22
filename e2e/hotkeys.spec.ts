// Atalhos de magia (painel H): trocar a tecla de uma magia, tecla do jogo recusada, lançar pela tecla nova, salvo no
// personagem (volta depois de recarregar a página) e troca de magias arrastando na barra.
import { expect, test } from "@playwright/test";
import { enterGame, meState, monsters, playFromList, setLevel, snap, targetNearest, teleport, walkableNear } from "./helpers.ts";

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

test("família de magias: só o que está liberado aparece, magia nova avisa e a tecla da família solta a mais forte pronta", async ({ page }) => {
  await enterGame(page, "sorcerer");
  const slots = page.locator(".action-slot");
  // lv 1: Cura (1) e a família "Ataque no alvo" (2); o resto da barra recomendada ainda está bloqueado e não aparece.
  await expect(slots).toHaveCount(2);
  await expect(slots.nth(1)).toHaveClass(/family/);
  await expect(slots.nth(1)).toHaveAttribute("data-tip", "Ataque no alvo: Bola de Fogo");

  await setLevel(page, 20);
  await expect(page.locator(".toast").filter({ hasText: /Novas magias|Nova magia/ }).first()).toBeVisible();
  await expect(slots).toHaveCount(6);

  // Sem alvo, a família fica apagada; com alvo ao lado, a tecla 2 solta o Raio de Energia (a mais forte no lv 20).
  await expect(slots.nth(1)).toHaveClass(/no-target/);
  const spot = (await walkableNear(page, FOREST.x, FOREST.y, 4))[0]!;
  await teleport(page, spot.x, spot.y);
  // O alvo (rato) pode morrer ou fugir antes da tecla: até 3 tentativas, mirando de novo no mais perto.
  const beamCd = () => page.evaluate(() => (window as any).__lq.spellCd("energy_beam") as number);
  for (let attempt = 0; attempt < 3 && (await beamCd()) === 0; attempt++) {
    const pos = (await meState(page))!;
    const mob = (await monsters(page)).sort((a, b) => Math.max(Math.abs(a.x - pos.x), Math.abs(a.y - pos.y)) - Math.max(Math.abs(b.x - pos.x), Math.abs(b.y - pos.y)))[0];
    const near = mob && (await walkableNear(page, mob.x, mob.y, 2)).find((w) => w.x !== mob.x || w.y !== mob.y);
    if (near) await teleport(page, near.x, near.y);
    await targetNearest(page);
    await expect(slots.nth(1)).toHaveAttribute("data-tip", "Ataque no alvo: Raio de Energia");
    await page.locator("#game canvas").hover({ position: { x: 300, y: 300 } });
    await page.keyboard.press("2");
    await expect.poll(beamCd, { timeout: 3000 }).toBeGreaterThan(0).catch(() => {});
  }
  expect(await beamCd()).toBeGreaterThan(0);
  await snap(page, "spell-family");
});
