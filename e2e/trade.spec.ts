// Troca entre jogadores: botão direito → "Trocar itens" → aceitar → ofertas → os dois confirmam → itens e ouro trocam.
import { expect, test, type Page } from "@playwright/test";
import { clickTile, enterGame, inventory, me, quietPair, teleport, waitSettled } from "./helpers.ts";


const countOf = async (p: Page, defId: string) =>
  (await inventory(p))!.backpack.reduce((n, b) => n + (b?.defId === defId ? b.count : 0), 0);

test("troca: convite, ofertas dos dois, confirmação e troca atômica", async ({ browser }) => {
  test.setTimeout(120_000);
  const ca = await browser.newContext(), cb = await browser.newContext();
  const a = await ca.newPage(), b = await cb.newPage();
  try {
    const pa = await enterGame(a, "knight");
    const pb = await enterGame(b, "druid");
    // Perto do spawn da vila (zona segura, sem monstros), num par de tiles longe dos outros testes em paralelo.
    const home = (await me(a))!;
    const aId = await a.evaluate(() => (window as any).__lq.myId() as string);
    const [ta, tb] = await quietPair(a, home.x, home.y, [aId, await b.evaluate(() => (window as any).__lq.myId() as string)]);
    await teleport(a, ta.x, ta.y);
    await teleport(b, tb.x, tb.y);
    const bId = await b.evaluate(() => (window as any).__lq.myId() as string);
    await expect.poll(() => a.evaluate((id) => (window as any).__lq.players().some((p: any) => p.id === id), bId)).toBe(true);
    await waitSettled(a);

    // Estado inicial: os dois têm o kit (3 poções de vida, 5 carnes) e a arma da vocação.
    const potA0 = await countOf(a, "health_potion"), potB0 = await countOf(b, "health_potion");
    const meatA0 = await countOf(a, "meat"), meatB0 = await countOf(b, "meat");
    expect(potA0).toBeGreaterThan(0);
    expect(meatB0).toBeGreaterThan(0);

    // A convida B pelo menu do botão direito; B aceita.
    const posB = (await me(b))!;
    await clickTile(a, posB.x, posB.y, { button: "right", fy: 0.6 });
    await a.locator(".ctx-menu").getByRole("menuitem", { name: "Trocar itens" }).click();
    const invite = b.getByRole("alertdialog", { name: `Convite de troca de ${pa.name}` });
    await expect(invite).toBeVisible();
    await invite.getByRole("button", { name: "Aceitar" }).click();
    const winA = a.getByRole("dialog", { name: `Troca com ${pb.name}` });
    const winB = b.getByRole("dialog", { name: `Troca com ${pa.name}` });
    await expect(winA).toBeVisible();
    await expect(winB).toBeVisible();

    // A oferece as poções de vida (pilha inteira); B oferece as carnes.
    await winA.locator('[data-bag-item="health_potion"]').click();
    await winB.locator('[data-bag-item="meat"]').click();
    await expect(winB.locator('[data-offer-item="health_potion"]')).toBeVisible(); // a oferta de A aparece para B
    await expect(winA.locator('[data-offer-item="meat"]')).toBeVisible();

    // Um confirma: ainda não troca. Mudar a oferta zera a confirmação.
    await winA.getByTestId("trade-confirm").click();
    await expect(winB.getByTestId("trade-confirmed")).toBeVisible();
    await winB.locator('[data-offer-item="meat"]').click(); // B tira a carne da oferta → zera
    await expect(winB.getByTestId("trade-confirmed")).toHaveCount(0);
    await winB.locator('[data-bag-item="meat"]').click(); // e põe de novo
    expect(await countOf(a, "meat")).toBe(meatA0); // nada trocou ainda

    // Os dois confirmam: a troca acontece e as janelas fecham.
    await winA.getByTestId("trade-confirm").click();
    await winB.getByTestId("trade-confirm").click();
    await expect(winA).toHaveCount(0);
    await expect(winB).toHaveCount(0);
    await expect.poll(() => countOf(a, "meat")).toBe(meatA0 + meatB0);
    await expect.poll(() => countOf(b, "health_potion")).toBe(potB0 + potA0);
    expect(await countOf(a, "health_potion")).toBe(0);
    expect(await countOf(b, "meat")).toBe(0);
  } finally {
    await ca.close(); await cb.close();
  }
});

test("troca: cancelar fecha para os dois e nada muda", async ({ browser }) => {
  test.setTimeout(120_000);
  const ca = await browser.newContext(), cb = await browser.newContext();
  const a = await ca.newPage(), b = await cb.newPage();
  try {
    const pa = await enterGame(a, "knight");
    const pb = await enterGame(b, "paladin");
    // Perto do spawn da vila (zona segura, sem monstros), num par de tiles longe dos outros testes em paralelo.
    const home = (await me(a))!;
    const aId = await a.evaluate(() => (window as any).__lq.myId() as string);
    const [ta, tb] = await quietPair(a, home.x, home.y, [aId, await b.evaluate(() => (window as any).__lq.myId() as string)]);
    await teleport(a, ta.x, ta.y);
    await teleport(b, tb.x, tb.y);
    const bId = await b.evaluate(() => (window as any).__lq.myId() as string);
    await expect.poll(() => a.evaluate((id) => (window as any).__lq.players().some((p: any) => p.id === id), bId)).toBe(true);
    await waitSettled(a);
    const pot0 = await countOf(a, "health_potion");

    const posB = (await me(b))!;
    await clickTile(a, posB.x, posB.y, { button: "right", fy: 0.6 });
    await a.locator(".ctx-menu").getByRole("menuitem", { name: "Trocar itens" }).click();
    await b.getByRole("alertdialog", { name: `Convite de troca de ${pa.name}` }).getByRole("button", { name: "Aceitar" }).click();
    const winA = a.getByRole("dialog", { name: `Troca com ${pb.name}` });
    const winB = b.getByRole("dialog", { name: `Troca com ${pa.name}` });
    await expect(winA).toBeVisible();
    await winA.locator('[data-bag-item="health_potion"]').click();
    await winB.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(winA).toHaveCount(0);
    await expect(winB).toHaveCount(0);
    expect(await countOf(a, "health_potion")).toBe(pot0);
  } finally {
    await ca.close(); await cb.close();
  }
});
