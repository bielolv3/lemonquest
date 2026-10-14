// Itens no chão: arrastar da mochila para o mundo (fica no chão, visível para outro jogador) e pegar com
// botão direito, Ctrl+clique, duplo clique e arrastando até a mochila.
import { expect, test, type Page } from "@playwright/test";
import { center, clickTile, drag, enterGame, ground, inventory, say, snap, teleport, tileToClient, waitSettled, walkableNear } from "./helpers.ts";

const bpSlot = (page: Page, i: number) => page.locator(`[data-loc="bp:${i}"]`);
const countOf = async (page: Page, defId: string) =>
  ((await inventory(page))?.backpack ?? []).reduce((n, s) => n + (s?.defId === defId ? s.count : 0), 0);

/** Índice do slot da mochila com o item. */
async function slotOf(page: Page, defId: string): Promise<number> {
  return ((await inventory(page))?.backpack ?? []).findIndex((s) => s?.defId === defId);
}

/** Arrasta o item da mochila até o tile (x,y) do mundo e espera ele aparecer no chão. */
async function dropToTile(page: Page, defId: string, x: number, y: number): Promise<void> {
  const i = await slotOf(page, defId);
  expect(i).toBeGreaterThanOrEqual(0);
  await bpSlot(page, i).scrollIntoViewIfNeeded();
  await waitSettled(page);
  const from = await center(page, bpSlot(page, i));
  const to = await tileToClient(page, x, y);
  await drag(page, from, to);
  await expect.poll(async () => (await ground(page)).some((g) => g.defId === defId && g.x === x && g.y === y), { timeout: 10_000 }).toBe(true);
}

test("itens no chão: largar arrastando e outro jogador pega (direito, Ctrl, duplo clique, arrastar)", async ({ browser }) => {
  // Dois navegadores e muitos passos: no CI (sem GPU) passa de 2 min.
  test.setTimeout(240_000);
  const ca = await browser.newContext(), cb = await browser.newContext();
  const a = await ca.newPage(), b = await cb.newPage();
  try {
    await enterGame(a, "knight");
    await enterGame(b, "paladin");
    // Um canto fora da vila, longe do spawn.
    const spots = (await walkableNear(a, 60, 80, 4)).filter((t, _i, all) => all.some((o) => o.x === t.x + 1 && o.y === t.y) && all.some((o) => o.x === t.x + 2 && o.y === t.y));
    const base = spots[0]!;
    const drop = { x: base.x + 1, y: base.y };
    await teleport(a, base.x, base.y);
    await teleport(b, base.x + 2, base.y);
    // Nada do kit inicial (3 poções de vida + carnes): cada item começa com 0 e o teste conta 1.
    const items = ["mana_potion", "health_potion_medium", "mana_potion_medium", "health_potion_large"];
    for (const id of items) await say(a, `/item ${id} 1`);
    await expect.poll(async () => (await Promise.all(items.map((id) => countOf(a, id)))).every((n) => n === 1), { timeout: 10_000 }).toBe(true);

    // 1) botão direito
    await dropToTile(a, items[0]!, drop.x, drop.y);
    expect(await countOf(a, items[0]!)).toBe(0);
    await expect.poll(async () => (await ground(b)).some((g) => g.defId === items[0]), { timeout: 10_000 }).toBe(true);
    await snap(b, "ground-item-seen-by-b");
    await waitSettled(b);
    await clickTile(b, drop.x, drop.y, { button: "right" });
    await expect.poll(() => countOf(b, items[0]!), { timeout: 10_000 }).toBe(1);
    await expect.poll(async () => (await ground(a)).length, { timeout: 10_000 }).toBe(0);

    // 2) Ctrl + clique
    await dropToTile(a, items[1]!, drop.x, drop.y);
    await expect.poll(async () => (await ground(b)).some((g) => g.defId === items[1]), { timeout: 10_000 }).toBe(true);
    await clickTile(b, drop.x, drop.y, { modifiers: ["Control"] });
    await expect.poll(() => countOf(b, items[1]!), { timeout: 10_000 }).toBe(1);

    // 3) duplo clique
    await dropToTile(a, items[2]!, drop.x, drop.y);
    await expect.poll(async () => (await ground(b)).some((g) => g.defId === items[2]), { timeout: 10_000 }).toBe(true);
    const c = await tileToClient(b, drop.x, drop.y);
    await b.mouse.dblclick(c.x, c.y);
    await expect.poll(() => countOf(b, items[2]!), { timeout: 10_000 }).toBe(1);
    // O duplo clique não fez o personagem andar até o tile do item.
    await expect.poll(async () => (await b.evaluate(() => (window as any).__lq.me().x))).toBe(base.x + 2);

    // 4) arrastar do chão até um slot vazio da mochila
    await dropToTile(a, items[3]!, drop.x, drop.y);
    await expect.poll(async () => (await ground(b)).some((g) => g.defId === items[3]), { timeout: 10_000 }).toBe(true);
    const empty = ((await inventory(b))!.backpack).findIndex((s) => !s);
    await bpSlot(b, empty).scrollIntoViewIfNeeded();
    await waitSettled(b);
    await drag(b, await tileToClient(b, drop.x, drop.y), await center(b, bpSlot(b, empty)));
    await expect.poll(async () => (await inventory(b))!.backpack[empty]?.defId, { timeout: 10_000 }).toBe(items[3]);
    await expect.poll(async () => (await ground(a)).length, { timeout: 10_000 }).toBe(0); // o patch do chão chega a A depois
  } finally {
    await ca.close();
    await cb.close();
  }
});
