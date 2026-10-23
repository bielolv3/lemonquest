// Comandos de admin (todos os nomes de teste são admins): /status responde no chat, /mute cala a vítima (que vê o
// aviso ao tentar falar) e /kick derruba a outra página com a tela "Você foi expulso" e o motivo.
import { expect, test } from "@playwright/test";
import { enterGame, say, snap } from "./helpers.ts";

test("admin: /status, /mute (vítima silenciada) e /kick com motivo na tela da vítima", async ({ browser }) => {
  test.setTimeout(120_000);
  const ca = await browser.newContext(), cb = await browser.newContext();
  const a = await ca.newPage(), b = await cb.newPage();
  try {
    const pa = await enterGame(a, "knight");
    const pb = await enterGame(b, "sorcerer");
    const logA = a.locator(".chat-log"), logB = b.locator(".chat-log");

    // /status: linhas do servidor no chat de quem digitou (Notice com log).
    await say(a, "/status");
    await expect(logA).toContainText("Servidor no ar");
    await expect(logA).toContainText(/Tick: média/);
    await expect(logB).not.toContainText("Servidor no ar");

    // /mute: o admin recebe a confirmação, a vítima o aviso; a fala dela não sai (nem aparece para o admin).
    await say(a, `/mute ${pb.name} 1`);
    await expect(logA).toContainText(`${pb.name} silenciado por 1 min.`);
    await expect(logB).toContainText("Você foi silenciado por 1 min.");
    await say(b, "frase silenciada do teste");
    await expect(logB).toContainText("Você está silenciado (mais 1 min).");
    await a.waitForTimeout(500);
    await expect(logA).not.toContainText("frase silenciada do teste");
    await snap(b, "admin-muted");

    // Quem não é alvo continua falando normalmente.
    await say(a, "o admin fala");
    await expect(logB).toContainText("o admin fala");

    // /kick com motivo: a vítima vê a tela de expulsão com o motivo; o admin, a confirmação.
    await say(a, `/kick ${pb.name} teste de expulsão`);
    const overlay = b.locator(".conn-overlay");
    await expect(overlay).toBeVisible({ timeout: 15_000 });
    await expect(overlay.locator("h2")).toHaveText("Você foi expulso");
    await expect(overlay).toContainText("Motivo: teste de expulsão");
    await expect(overlay.getByRole("button", { name: /Voltar/ })).toBeVisible();
    await expect(logA).toContainText(`${pb.name} foi expulso.`);
    await snap(b, "admin-kicked");
    // A vítima some da lista de quem está online.
    await say(a, "/online");
    await expect(logA).toContainText(`${pa.name} (1)`);
    await expect.poll(async () => (await logA.textContent()) ?? "").toMatch(new RegExp(`Online \\(\\d+\\): (?!.*${pb.name})`));
  } finally {
    await ca.close(); await cb.close();
  }
});
