// Grupo (party): convite pelo menu do botão direito → aceitar → painel com os dois → chat do grupo → XP compartilhada.
import { expect, test, type Page } from "@playwright/test";
import { clickTile, enterGame, me, meState, monsters, say, setLevel, targetNearest, teleport, walkableNear, waitSettled } from "./helpers.ts";

/** Floresta ao norte da vila: spawn de ratos/gosmas (mapa: rat em 70,62). */
const FOREST = { x: 70, y: 62 };

const xpOf = async (p: Page) => (await meState(p))!.xp as number;

test("grupo: convidar, aceitar, painel, chat do grupo e XP compartilhada", async ({ browser }) => {
  test.setTimeout(240_000);
  const ca = await browser.newContext(), cb = await browser.newContext();
  const a = await ca.newPage(), b = await cb.newPage();
  try {
    const pa = await enterGame(a, "knight");
    const pb = await enterGame(b, "druid");
    await setLevel(a, 20);
    await setLevel(b, 20);
    // Os dois lado a lado na floresta.
    const tiles = await walkableNear(a, FOREST.x, FOREST.y, 4);
    const ta = tiles[0]!;
    const tb = tiles.find((t) => Math.max(Math.abs(t.x - ta.x), Math.abs(t.y - ta.y)) === 2)!;
    await teleport(a, ta.x, ta.y);
    await teleport(b, tb.x, tb.y);
    const bId = await b.evaluate(() => (window as any).__lq.myId() as string);
    await expect.poll(() => a.evaluate((id) => (window as any).__lq.players().some((p: any) => p.id === id), bId)).toBe(true);
    await waitSettled(a);

    // Botão direito no outro jogador → "Convidar para o grupo".
    const posB = (await me(b))!;
    await clickTile(a, posB.x, posB.y, { button: "right", fy: 0.6 });
    await a.locator(".ctx-menu").getByRole("menuitem", { name: "Convidar para o grupo" }).click();

    // O convidado recebe o cartão com Aceitar/Recusar.
    const invite = b.locator(".party-invite");
    await expect(invite).toContainText(pa.name);
    await invite.getByRole("button", { name: "Aceitar" }).click();
    await expect(invite).toHaveCount(0);

    // Painel "Grupo" nos dois, com os dois membros; líder com coroa; XP compartilhada ativa.
    for (const p of [a, b]) {
      const panel = p.locator(".party-section");
      await expect(panel.locator(".party-member")).toHaveCount(2);
      await expect(panel).toContainText(pa.name);
      await expect(panel).toContainText(pb.name);
      await expect(panel.locator(".party-share.on")).toBeVisible();
      await expect(panel.locator(`.party-member[data-member="${pa.name}"] .party-crown`)).toHaveText("♛");
    }
    // Mesmo grupo no estado sincronizado.
    const partyA = (await meState(a))!.partyId as string;
    expect(partyA).not.toBe("");
    await expect.poll(async () => (await meState(b))!.partyId).toBe(partyA);

    // Chat do grupo: B fala na aba Grupo, A recebe na aba Grupo (não no Geral).
    await b.locator(".chat-tab", { hasText: "Grupo" }).click();
    await say(b, "bora caçar");
    const tabA = a.locator(".chat-tab", { hasText: "Grupo" });
    await expect(tabA.locator(".chat-unread")).toBeVisible();
    await expect(a.locator(".chat-log")).not.toContainText("bora caçar");
    await tabA.click();
    await expect(a.locator(".chat-line.party", { hasText: "bora caçar" })).toContainText(pb.name);
    await expect(a.locator(".chat-line.party.sys", { hasText: "entrou no grupo" })).toBeVisible();

    // XP compartilhada: B ataca um monstro (fica "ativo"), para de atacar; depois A mata outro sozinho e os dois ganham.
    await b.keyboard.press("F8");
    await expect.poll(async () => (await monsters(b)).length, { timeout: 15_000 }).toBeGreaterThan(0);
    const xpB0 = await xpOf(b);
    await targetNearest(b);
    // Até ganhar XP; se o alvo sumir de vista sem morrer, mira no mais próximo de novo.
    await expect.poll(async () => {
      if (!(await b.evaluate(() => (window as any).__lq.target())) && (await monsters(b)).length) await targetNearest(b);
      return xpOf(b);
    }, { timeout: 60_000 }).toBeGreaterThan(xpB0);
    // B sem alvo daqui em diante (Esc limpa o alvo; tira o seguir).
    await b.keyboard.press("F8");
    await b.keyboard.press("Escape");
    await expect.poll(() => b.evaluate(() => (window as any).__lq.target())).toBeFalsy();
    // Volta para perto de A (dentro de 12 sqm do abate).
    const near = (await me(a))!;
    const back = (await walkableNear(b, near.x, near.y, 2)).find((t) => t.x !== near.x || t.y !== near.y)!;
    await teleport(b, back.x, back.y);

    const xpA1 = await xpOf(a), xpB1 = await xpOf(b);
    await a.keyboard.press("F8");
    await expect.poll(async () => (await monsters(a)).length, { timeout: 15_000 }).toBeGreaterThan(0);
    const second = await targetNearest(a);
    await expect.poll(async () => (await monsters(a)).some((m) => m.id === second), { timeout: 45_000 }).toBe(false);
    await expect.poll(() => xpOf(a), { timeout: 10_000 }).toBeGreaterThan(xpA1);
    await expect.poll(() => xpOf(b), { timeout: 10_000 }).toBeGreaterThan(xpB1);
    // Divisão igual entre os dois.
    expect((await xpOf(a)) - xpA1).toBe((await xpOf(b)) - xpB1);
  } finally {
    await ca.close();
    await cb.close();
  }
});
