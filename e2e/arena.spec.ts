// Coliseu: janela do Mestre (lobbies), partida solo (ondas, pausa com vendedor, Pronto, desistir → resultado) e grupo
// com dois navegadores.
import { expect, test, type Page } from "@playwright/test";
import { clickTile, enterGame, me, meState, monsters, setLevel, snap, targetNearest, teleport, walkableNear } from "./helpers.ts";

const MASTER = { x: 87, y: 108 };

/** Vai até o Mestre do Coliseu e abre a janela (clique no NPC). */
async function openArena(page: Page): Promise<void> {
  const near = (await walkableNear(page, MASTER.x, MASTER.y + 2, 1)).find((t) => !(t.x === MASTER.x && t.y === MASTER.y))!;
  await teleport(page, near.x, near.y);
  const win = page.getByRole("dialog", { name: "Coliseu" });
  await expect.poll(async () => {
    if (await win.isVisible()) return true;
    await clickTile(page, MASTER.x, MASTER.y, { fy: 0.3 });
    return win.isVisible();
  }, { timeout: 15_000, intervals: [700] }).toBe(true);
}

const bar = (page: Page) => page.locator(".arena-bar");

/** Mata todos os monstros da onda atual (alvo no mais perto, modo seguir ligado). */
async function clearWave(page: Page): Promise<void> {
  await expect(bar(page)).toContainText("Onda", { timeout: 20_000 });
  await expect.poll(async () => {
    const t = await bar(page).textContent().catch(() => "");
    if (!t || /Pausa/.test(t)) return "pausa";
    if ((await monsters(page)).length) await targetNearest(page).catch(() => "");
    return /Pausa/.test((await bar(page).textContent().catch(() => "")) ?? "") ? "pausa" : t;
  }, { timeout: 90_000, intervals: [1000] }).toBe("pausa");
}

test("coliseu solo: iniciar → onda 1 → pausa (vendedor) → Pronto → onda 2 → desistir → resultado", async ({ page }) => {
  await enterGame(page, "knight");
  await setLevel(page, 40);
  await page.keyboard.press("F8"); // seguir o alvo
  await openArena(page);
  const win = page.getByRole("dialog", { name: "Coliseu" });
  await expect(win).toContainText("Arenas livres");
  await snap(page, "arena-window");
  await win.getByRole("button", { name: "Criar grupo" }).click();
  await expect(win.locator(".arena-members li")).toHaveCount(1);
  await win.getByRole("button", { name: "Iniciar (solo)" }).click();
  await expect(bar(page)).toContainText("Entrando no Coliseu em");
  // Dentro da arena: a janela fecha, contagem e onda 1.
  await expect(win).toBeHidden({ timeout: 15_000 });
  await expect(page.locator(".arena-banner")).toContainText("Onda 1", { timeout: 20_000 });
  const hp0 = (await meState(page))!.hp;
  expect(hp0).toBeGreaterThan(0);
  await clearWave(page);

  // Pausa: botão Pronto, ganho acumulado e o vendedor do coliseu abre a loja.
  await expect(bar(page)).toContainText("Vendedor do Coliseu aberto");
  await snap(page, "arena-pause");
  const pos = (await me(page))!;
  const shop = await page.evaluate(([x, y]) => {
    const lq = (window as any).__lq;
    let best: { id: string; x: number; y: number } | null = null, bd = 1e9;
    for (const id of ["arena_shop_1", "arena_shop_2", "arena_shop_3", "arena_shop_4"]) {
      const t = lq.npcTile(id); if (!t) continue;
      const d = Math.max(Math.abs(t.x - x), Math.abs(t.y - y));
      if (d < bd) { bd = d; best = { id, ...t }; }
    }
    return best;
  }, [pos.x, pos.y] as const);
  expect(shop).not.toBeNull();
  const npcWin = page.locator(".npc-window");
  await expect.poll(async () => {
    if (await npcWin.isVisible()) return true;
    await clickTile(page, shop!.x, shop!.y, { fy: 0.3 });
    await page.waitForTimeout(600);
    return npcWin.isVisible();
  }, { timeout: 20_000, intervals: [800] }).toBe(true);
  await snap(page, "arena-shop");
  await page.keyboard.press("Escape");

  const ready = page.locator(".arena-bar.pause").getByRole("button", { name: "Pronto" });
  await ready.click();
  await expect(page.locator(".arena-bar.pause")).toContainText("Pronto ✓");
  // Pronto (todos) → começa em 3 s.
  await expect(page.locator(".arena-banner")).toContainText("Onda 2", { timeout: 15_000 });
  await expect(bar(page)).toContainText("Onda 2/30");

  // Desistir (⚑ + confirmação) → cartão de resultado com a onda vencida.
  page.once("dialog", (d) => d.accept());
  await bar(page).locator(".arena-mini").click();
  const card = page.getByRole("dialog", { name: "Resultado do Coliseu" });
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(card).toContainText("Você saiu do Coliseu");
  await expect(card).toContainText("1 onda vencida");
  await snap(page, "arena-result");
  await card.getByRole("button", { name: "Fechar" }).click();
  await expect(card).toBeHidden();
  await expect(bar(page)).toHaveCount(0);
});

test("coliseu em grupo: dois jogadores, lobby → entrar → iniciar → ambos na arena", async ({ browser }) => {
  const ca = await browser.newContext(), cb = await browser.newContext();
  const a = await ca.newPage(), b = await cb.newPage();
  try {
    const pa = await enterGame(a, "knight");
    const pb = await enterGame(b, "druid");
    await setLevel(a, 30);
    await setLevel(b, 30);
    await openArena(a);
    const wa = a.getByRole("dialog", { name: "Coliseu" });
    await wa.getByRole("button", { name: "Criar grupo" }).click();
    await openArena(b);
    const wb = b.getByRole("dialog", { name: "Coliseu" });
    const lobby = wb.locator(".arena-lobby", { hasText: pa.name });
    await expect(lobby).toBeVisible();
    await lobby.getByRole("button", { name: "Entrar" }).click();
    await expect(wb.locator(".arena-members")).toContainText(pb.name);
    await expect(wa.locator(".arena-members li")).toHaveCount(2);
    await expect(wa.locator(".arena-slots").first()).toHaveText("2/4");
    await snap(a, "arena-group-lobby");
    // Só o líder inicia.
    await expect(wb.getByRole("button", { name: /Iniciar/ })).toHaveCount(0);
    await wa.getByRole("button", { name: "Iniciar" }).click();
    for (const p of [a, b]) await expect(p.locator(".arena-banner")).toContainText("Onda 1", { timeout: 25_000 });
    // Os dois estão na mesma arena (perto um do outro).
    const ma = (await me(a))!, mb = (await me(b))!;
    expect(Math.max(Math.abs(ma.x - mb.x), Math.abs(ma.y - mb.y))).toBeLessThan(10);
    // Um desiste: o outro continua; depois o segundo também.
    a.once("dialog", (d) => d.accept());
    await bar(a).locator(".arena-mini").click();
    await expect(a.getByRole("dialog", { name: "Resultado do Coliseu" })).toBeVisible();
    await expect(bar(b)).toContainText("Onda");
    b.once("dialog", (d) => d.accept());
    await bar(b).locator(".arena-mini").click();
    await expect(b.getByRole("dialog", { name: "Resultado do Coliseu" })).toBeVisible();
  } finally {
    await ca.close();
    await cb.close();
  }
});
