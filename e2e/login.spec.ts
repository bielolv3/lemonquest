// Tela de carregamento, login pela UI (conta nova → personagem → jogar), várias contas/personagens e telas de erro.
import { expect, test } from "@playwright/test";
import { E2E_NAMES } from "./names.ts";
import { createPlayer, freshAccount, openWithSession, playFromList, waitInWorld } from "./helpers.ts";

test("carregamento: overlay de boot e login aparece sobre o mapa pronto", async ({ page }) => {
  await page.goto("/?e2e");
  // O overlay é pintado pelo HTML antes de qualquer JS.
  await expect(page.locator("#boot .boot-title")).toHaveText("The Lemon Quest");
  // Login só depois do mapa pronto: o overlay some e o card aparece por cima do canvas.
  const card = page.locator(".login-card");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#boot")).toBeHidden();
  await expect(page.locator("#game canvas")).toBeVisible();
  // O card fica sobre o canvas (z-order) e centralizado na tela.
  const top = await page.evaluate(() => {
    const r = document.querySelector(".login-card")!.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + 20);
    return !!el?.closest(".login-card");
  });
  expect(top).toBe(true);
  const box = (await card.boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - 720)).toBeLessThan(40);
});

test("login completo pela UI: criar conta → criar personagem → jogar (canvas + HUD)", async ({ page }) => {
  const account = freshAccount();
  await page.goto("/?e2e");
  await expect(page.locator(".login-card")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Criar conta" }).last().click();
  await expect(page.getByRole("heading", { name: "Criar conta" })).toBeVisible();
  await page.getByLabel("Conta").fill(account);
  await page.getByLabel("Senha", { exact: true }).fill("senha-e2e-123");
  await page.getByLabel("Confirmar senha").fill("senha-e2e-123");
  await page.locator(".login-card .btn").first().click();

  await expect(page.getByRole("heading", { name: "Novo personagem" })).toBeVisible();
  // Nome livre da lista de admins.
  let name = "";
  for (const n of E2E_NAMES.slice(180)) {
    const r = await page.request.get(`/health`);
    expect(r.ok()).toBe(true);
    name = n;
    await page.getByLabel("Nome do personagem").fill(n);
    await page.locator(".voc-card", { hasText: "Druida" }).click();
    await page.getByRole("button", { name: "Criar personagem" }).click();
    const ok = page.getByRole("heading", { name: "Personagens" });
    const taken = page.getByRole("alert").filter({ hasText: "já está em uso" });
    await expect(ok.or(taken)).toBeVisible();
    if (await ok.isVisible()) break;
  }
  await expect(page.locator(".char-card.selected .char-name")).toHaveText(name);
  await page.getByRole("button", { name: `Jogar com ${name}` }).click();
  // "Entrando no mundo…" aparece durante a entrada.
  await waitInWorld(page);
  await expect(page.locator("#game canvas")).toBeVisible();
  await expect(page.locator(".hud-rail")).toBeVisible();
  await expect(page.locator(".action-bar")).toBeVisible();
  await expect(page.locator(".chat")).toBeVisible();
  await expect(page.locator(".login-card")).toHaveCount(0);
});

test("conta com vários personagens: escolher o segundo e voltar à lista após desconectar", async ({ page }) => {
  const a = await createPlayer(page.request, "knight");
  // Segundo personagem na mesma conta.
  let second = "";
  for (const n of E2E_NAMES.slice(150)) {
    const r = await (await page.request.post("/api/characters", { data: { session: a.session, name: n, vocation: "sorcerer" } })).json();
    if (r.ok) { second = n; break; }
  }
  expect(second).not.toBe("");
  await openWithSession(page, a);
  await expect(page.locator(".char-card:not(.new)")).toHaveCount(2, { timeout: 30_000 });
  await expect(page.locator(".char-card.new")).toBeVisible();
  // Setas trocam a seleção; Enter joga.
  await page.locator(".char-card", { hasText: second }).click();
  await expect(page.getByRole("button", { name: `Jogar com ${second}` })).toBeVisible();
  await page.getByRole("button", { name: `Jogar com ${second}` }).click();
  await waitInWorld(page);
  const st = await page.evaluate(() => (window as any).__lq.meState());
  expect(st.name).toBe(second);
  expect(st.vocation).toBe("sorcerer");
  // Recarregar volta à lista (sessão da conta na aba) com o último personagem selecionado.
  await page.reload();
  await expect(page.locator(".char-card.selected .char-name")).toHaveText(second, { timeout: 30_000 });
  await playFromList(page, { ...a, name: second });
});

test("login: senha errada mostra erro amigável", async ({ page }) => {
  const a = await createPlayer(page.request);
  await page.goto("/?e2e");
  await expect(page.locator(".login-card")).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Conta").fill(a.account);
  await page.getByLabel("Senha", { exact: true }).fill("errada-123");
  await page.getByLabel("Senha", { exact: true }).press("Enter");
  await expect(page.getByRole("alert")).toHaveText("Senha incorreta.");
});

test("erro de carregamento (servidor fora): tela de erro com 'Tentar de novo'", async ({ page }) => {
  // O mapa não carrega (servidor caiu no meio do carregamento).
  await page.route("**/maps/**", (r) => r.abort("connectionrefused"));
  await page.goto("/?e2e");
  const err = page.locator("#boot .boot-error");
  await expect(err).toBeVisible({ timeout: 30_000 });
  await expect(err).toContainText("Não foi possível carregar o jogo");
  // O login pode existir por baixo, mas o overlay de erro cobre a tela toda.
  const covered = await page.evaluate(() => !!document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest("#boot"));
  expect(covered).toBe(true);
  // Servidor voltou: "Tentar de novo" recarrega e o jogo abre.
  await page.unroute("**/maps/**");
  await page.getByRole("button", { name: "Tentar de novo" }).click();
  await expect(page.locator(".login-card")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#boot")).toBeHidden();
});

test("erro de carregamento: bundle JS indisponível também mostra 'Tentar de novo'", async ({ page }) => {
  await page.route("**/assets/*.js", (r) => r.abort("connectionrefused"));
  await page.goto("/?e2e");
  await expect(page.getByRole("button", { name: "Tentar de novo" })).toBeVisible({ timeout: 15_000 });
});

test("servidor fora ao entrar na conta: mensagem de erro no login", async ({ page }) => {
  await page.goto("/?e2e");
  await expect(page.locator(".login-card")).toBeVisible({ timeout: 30_000 });
  await page.route("**/api/**", (r) => r.abort("connectionrefused"));
  await page.getByLabel("Conta").fill("alguem");
  await page.getByLabel("Senha", { exact: true }).fill("senha-123");
  await page.getByLabel("Senha", { exact: true }).press("Enter");
  await expect(page.getByRole("alert")).toHaveText("Não foi possível conectar ao servidor.");
});
