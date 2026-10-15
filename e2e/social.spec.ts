// Social: emote sobre a cabeça (/e e botão ☺), sussurro (/w, /r) e lista de amigos (/amigo, /amigos).
import { expect, test, type Page } from "@playwright/test";
import { enterGame, say, teleport, waitSettled, walkableNear } from "./helpers.ts";

const FOREST = { x: 70, y: 62 };
const speech = (p: Page) => p.evaluate(() => (window as any).__lq.speech() as { from: string; text: string; color: string }[]);

test("social: emote, sussurro, resposta e amigos", async ({ browser }) => {
  test.setTimeout(120_000);
  const ca = await browser.newContext(), cb = await browser.newContext();
  const a = await ca.newPage(), b = await cb.newPage();
  try {
    const pa = await enterGame(a, "knight");
    const pb = await enterGame(b, "druid");
    const tiles = await walkableNear(a, FOREST.x, FOREST.y, 4);
    const ta = tiles[0]!;
    const tb = tiles.find((t) => Math.max(Math.abs(t.x - ta.x), Math.abs(t.y - ta.y)) === 2)!;
    await teleport(a, ta.x, ta.y);
    await teleport(b, tb.x, tb.y);
    const bId = await b.evaluate(() => (window as any).__lq.myId() as string);
    await expect.poll(() => a.evaluate((id) => (window as any).__lq.players().some((p: any) => p.id === id), bId)).toBe(true);
    await waitSettled(a);

    // Emote pelo comando: aparece sobre A para os dois (símbolo e cor da definição).
    await say(a, "/e coracao");
    for (const p of [a, b]) {
      await expect.poll(() => speech(p)).toEqual([expect.objectContaining({ from: pa.name, text: "♥", color: "#ff6b8a" })]);
    }
    // Emote pelo botão ☺ do chat.
    await b.locator(".emote-btn").click();
    await b.locator('.emote-item[data-emote="oi"]').click();
    await expect.poll(() => speech(a), { timeout: 8000 }).toEqual(expect.arrayContaining([expect.objectContaining({ from: pb.name, text: "Oi!" })]));

    // Sussurro: só os dois veem; o nome tem espaço ("Qa Ab"). B responde com /r.
    await say(a, `/w ${pb.name} psiu, tudo bem?`);
    await expect(b.locator(".chat-line.whisper")).toContainText(`${pa.name} sussurra`);
    await expect(b.locator(".chat-line.whisper")).toContainText("psiu, tudo bem?");
    await expect(a.locator(".chat-line.whisper")).toContainText(`Você → ${pb.name}`);
    await b.waitForTimeout(700); // cooldown do sussurro
    await say(b, "/r tudo ótimo");
    await expect(a.locator(".chat-line.whisper").last()).toContainText(`${pb.name} sussurra`);
    await expect(a.locator(".chat-line.whisper").last()).toContainText("tudo ótimo");
    // Sussurro não vira balão sobre a cabeça.
    expect((await speech(a)).some((s) => s.text.includes("psiu"))).toBe(false);

    // Amigos: A adiciona B; /amigos mostra B online; /amigo de novo remove.
    await say(a, `/amigo ${pb.name}`);
    await expect(a.locator(".chat-line.sys").filter({ hasText: "entrou na sua lista de amigos" })).toHaveCount(1);
    await say(a, "/amigos");
    await expect(a.locator(".chat-line.sys").filter({ hasText: `${pb.name} ●` })).toHaveCount(1);
    await b.waitForTimeout(100);
    await say(a, `/amigo ${pb.name}`);
    await expect(a.locator(".chat-line.sys").filter({ hasText: "saiu da sua lista de amigos" })).toHaveCount(1);
  } finally {
    await ca.close(); await cb.close();
  }
});
