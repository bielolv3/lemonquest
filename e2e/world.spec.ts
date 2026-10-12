// Mundo: andar (teclado e clique), atacar um monstro, magia na tecla 1 e janela de roupas (O).
import { expect, test, type Page } from "@playwright/test";
import { clickTile, enterGame, me, meState, monsters, setLevel, teleport, tileToClient, walkableNear, waitSettled } from "./helpers.ts";

/** Floresta ao norte da vila: spawn de ratos/gosmas (mapa: rat em 70,62). */
const FOREST = { x: 70, y: 62 };

test("andar com o teclado e com clique no chão", async ({ page }) => {
  await enterGame(page);
  await waitSettled(page);
  const start = (await me(page))!;
  // Segura a seta: o servidor confirma a nova posição.
  await page.keyboard.down("ArrowDown");
  await expect.poll(async () => (await me(page))!.y, { timeout: 5000 }).toBeGreaterThan(start.y);
  await page.keyboard.up("ArrowDown");
  await waitSettled(page);
  const after = (await me(page))!;
  // Clique num tile andável a ~3 tiles: anda até lá.
  const tiles = (await walkableNear(page, after.x, after.y, 3)).filter((t) => Math.abs(t.x - after.x) + Math.abs(t.y - after.y) >= 3);
  expect(tiles.length).toBeGreaterThan(0);
  const dest = tiles[0]!;
  await clickTile(page, dest.x, dest.y);
  await expect.poll(async () => { const m = await me(page); return `${m!.x},${m!.y}`; }, { timeout: 10_000 }).toBe(`${dest.x},${dest.y}`);
});

/** Clica no monstro mais perto até virar o alvo. */
async function targetNearest(page: Page, filter?: (defId: string) => boolean): Promise<string> {
  let id = "";
  await expect.poll(async () => {
    const m = (await me(page))!;
    const list = (await monsters(page)).filter((x) => !filter || filter(x.defId ?? ""))
      .sort((a, b) => Math.max(Math.abs(a.x - m.x), Math.abs(a.y - m.y)) - Math.max(Math.abs(b.x - m.x), Math.abs(b.y - m.y)));
    const t = list[0];
    if (!t) return "";
    const cur = await page.evaluate(() => (window as any).__lq.target());
    if (cur && list.some((x) => x.id === cur)) { id = cur; return cur; }
    await clickTile(page, t.x, t.y, { fy: 0.6 });
    await page.waitForTimeout(150);
    id = await page.evaluate(() => (window as any).__lq.target());
    return id;
  }, { timeout: 30_000, intervals: [300] }).not.toBe("");
  return id;
}

test("atacar e matar um monstro na floresta", async ({ page }) => {
  await enterGame(page, "knight");
  await setLevel(page, 30);
  const spot = (await walkableNear(page, FOREST.x, FOREST.y, 4))[0]!;
  await teleport(page, spot.x, spot.y);
  // Modo seguir (F8): o cavaleiro persegue o alvo.
  await page.keyboard.press("F8");
  await expect(page.locator(".fm-btn.chase")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await monsters(page)).length, { timeout: 15_000 }).toBeGreaterThan(0);
  const xp0 = (await meState(page))!.xp as number;
  const id = await targetNearest(page);
  // Alvo marcado na lista de batalha.
  await expect(page.locator(".battle-row.selected")).toHaveCount(1);
  // Morre (sai do estado) e o personagem ganha XP.
  await expect.poll(async () => (await monsters(page)).some((m) => m.id === id), { timeout: 45_000 }).toBe(false);
  await expect.poll(async () => (await meState(page))!.xp as number, { timeout: 10_000 }).toBeGreaterThan(xp0);
});

test("magia na tecla 1 (cura) gasta mana e entra em recarga", async ({ page }) => {
  await enterGame(page, "druid");
  await setLevel(page, 20);
  const slot = page.locator(".action-slot").first();
  await expect(slot).toHaveClass(/filled/);
  const mana0 = (await meState(page))!.mana as number;
  await page.locator("#game canvas").hover({ position: { x: 300, y: 300 } });
  await page.keyboard.press("Digit1");
  await expect.poll(async () => (await meState(page))!.mana as number, { timeout: 5000 }).toBeLessThan(mana0);
  await expect(slot).toHaveClass(/cooling/);
});

test("janela de roupas (O): trocar de roupa e confirmar", async ({ page }) => {
  await enterGame(page, "knight");
  const before = (await meState(page))!.outfit as string;
  await page.locator("#game canvas").hover({ position: { x: 300, y: 300 } });
  await page.keyboard.press("o");
  const win = page.getByRole("dialog", { name: "Roupas" });
  await expect(win).toBeVisible();
  // A janela inteira cabe na tela.
  const box = (await win.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(900);
  const other = win.locator(".outfit-cell:not(.cur)").first();
  const name = (await other.locator("span").last().textContent())!;
  await other.click();
  await expect(win.locator(".outfit-name")).toHaveText(name);
  // Addon 1 liga/desliga.
  await win.locator(".outfit-addon").first().click();
  await expect(win.locator(".outfit-addon").first()).toHaveClass(/on/);
  await win.getByRole("button", { name: "OK" }).click();
  await expect(win).toBeHidden();
  await expect.poll(async () => (await meState(page))!.outfit, { timeout: 5000 }).not.toBe(before);
  expect((await meState(page))!.addons).toBe(1);
  // Reabrir mostra a roupa nova como atual; Esc fecha.
  await page.keyboard.press("o");
  await expect(win.locator(".outfit-cell.cur span").last()).toHaveText(name);
  await page.keyboard.press("Escape");
  await expect(win).toBeHidden();
});

test("botão direito no próprio personagem: menu 'Trocar roupa'", async ({ page }) => {
  await enterGame(page);
  await waitSettled(page);
  const m = (await me(page))!;
  const c = await tileToClient(page, m.x, m.y);
  await page.mouse.click(c.x, c.y, { button: "right" });
  await page.getByRole("menuitem", { name: "Trocar roupa" }).or(page.getByText("Trocar roupa")).first().click();
  await expect(page.getByRole("dialog", { name: "Roupas" })).toBeVisible();
});
