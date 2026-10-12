// Conta: recuperar senha com código gerado por um admin (/resetsenha) e excluir personagem pela lista.
import { expect, test } from "@playwright/test";
import { createPlayer, enterGame, openWithSession, say } from "./helpers.ts";

test("esqueci minha senha: código do admin (/resetsenha) → senha nova → entra na conta", async ({ browser }) => {
  const ca = await browser.newContext(), cu = await browser.newContext();
  try {
    const admin = await ca.newPage();
    await enterGame(admin);
    const user = await cu.newPage();
    const u = await createPlayer(user.request);
    await say(admin, `/resetsenha ${u.account}`);
    const toast = admin.locator(".toast", { hasText: "Código de recuperação" });
    await expect(toast).toBeVisible();
    const code = /([A-Z0-9]{4}-[A-Z0-9]{4})/.exec((await toast.textContent())!)?.[1];
    expect(code).toBeTruthy();

    await user.goto("/?e2e");
    await expect(user.locator(".login-card")).toBeVisible({ timeout: 30_000 });
    await user.getByRole("button", { name: "Esqueci minha senha" }).click();
    await expect(user.getByRole("heading", { name: "Recuperar senha" })).toBeVisible();
    await user.getByLabel("Conta").fill(u.account);
    await user.getByLabel("Código de recuperação").fill(code!.toLowerCase()); // vira maiúsculas
    await user.getByLabel("Nova senha", { exact: true }).fill("nova-senha-456");
    await user.getByLabel("Confirmar nova senha").fill("nova-senha-456");
    await user.getByRole("button", { name: "Trocar senha e entrar" }).click();
    await expect(user.getByRole("heading", { name: "Personagens" })).toBeVisible();
    await expect(user.locator(".char-card", { hasText: u.name })).toBeVisible();

    // Senha antiga não vale mais; a nova sim. O código é de uso único.
    const old = await (await user.request.post("/api/login", { data: { account: u.account, password: u.password } })).json();
    expect(old.error).toBe("wrong_password");
    const fresh = await (await user.request.post("/api/login", { data: { account: u.account, password: "nova-senha-456" } })).json();
    expect(fresh.ok).toBe(true);
    const again = await (await user.request.post("/api/reset-password", { data: { account: u.account, code, password: "outra-senha-789" } })).json();
    expect(again.ok).toBe(false);
  } finally {
    await ca.close();
    await cu.close();
  }
});

test("excluir personagem: confirmação com nome + senha, some da lista", async ({ page }) => {
  const p = await createPlayer(page.request);
  await openWithSession(page, p);
  const card = page.locator(".char-card", { hasText: p.name });
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.hover();
  await page.getByRole("button", { name: `Excluir ${p.name}` }).click();
  const dlg = page.getByRole("alertdialog");
  await expect(dlg).toContainText(`Excluir ${p.name}?`);
  const go = dlg.getByRole("button", { name: "Excluir para sempre" });
  await expect(go).toBeDisabled();
  await dlg.getByLabel("Digite o nome do personagem para confirmar").fill(p.name.toLowerCase());
  await dlg.getByLabel("Senha da conta").fill("errada-000");
  await go.click();
  await expect(dlg.getByRole("alert")).toBeVisible();
  await dlg.getByLabel("Senha da conta").fill(p.password);
  await go.click();
  await expect(dlg).toBeHidden();
  await expect(page.locator(".char-card:not(.new)")).toHaveCount(0);
  // Nome livre de novo.
  const r = await (await page.request.post("/api/characters", { data: { session: p.session, name: p.name, vocation: "knight" } })).json();
  expect(r.ok).toBe(true);
});
