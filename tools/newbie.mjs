// Robô novato (regressão da primeira missão): conta nova SEM comandos de admin → anda até o Capitão, aceita "Ratos no
// Celeiro", mata 5 ratos na floresta, volta e entrega. Falha (exit 1) se alguma vocação não entregar dentro do limite.
//   node tools/newbie.mjs                       sobe um servidor de teste próprio (porta 2895) e roda as 4 vocações
//   node tools/newbie.mjs --port 2567           usa um servidor já no ar (cria contas e personagens nele)
//   node tools/newbie.mjs --voc druid --limit 120 --out shots   só uma vocação, limite de 120 s, capturas em ./shots
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n, d) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : d; };
const VOCS = arg("voc") ? [arg("voc")] : ["knight", "paladin", "sorcerer", "druid"];
const limitMs = Number(arg("limit", "180")) * 1000;
const out = arg("out");
if (out) fs.mkdirSync(out, { recursive: true });
let port = arg("port");
let server = null;

async function startServer() {
  port = "2895";
  server = spawn(process.execPath, [path.join(root, "e2e", "start-server.mjs")], { cwd: root, env: { ...process.env, E2E_PORT: port }, stdio: "ignore" });
  for (let i = 0; i < 120; i++) {
    if (await fetch(`http://localhost:${port}/health`).then((r) => r.ok).catch(() => false)) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("servidor de teste não subiu");
}
function stopServer() {
  if (!server) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill("SIGTERM");
}

const post = async (p, b) => (await fetch(`http://localhost:${port}/api/${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })).json();
const L = "abcdefghijklmnopqrstuvwxyz";
let seq = 0;

async function run(browser, voc) {
  const log = (...a) => console.log(`[${voc}]`, ...a);
  const s = await post("login", { account: "nv" + Date.now().toString(36) + seq, password: "senha-e2e-123", create: true });
  const n = Date.now() + seq++;
  const name = "Novato " + L[n % 26] + L[Math.floor(n / 26) % 26] + L[Math.floor(n / 676) % 26];
  const c = await post("characters", { session: s.session, name, vocation: voc });
  if (!c.ok) throw new Error("personagem: " + JSON.stringify(c));
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  try {
    await page.addInitScript((x) => sessionStorage.setItem("lemonquest.accountSession", x), s.session);
    await page.goto(`http://localhost:${port}/?e2e`);
    await page.getByRole("button", { name: /Jogar com/ }).click({ timeout: 30000 });
    await page.waitForFunction(() => !!window.__lq?.me(), null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    const t0 = Date.now();
    const T = () => Math.round((Date.now() - t0) / 1000) + "s";
    const st = () => page.evaluate(() => window.__lq.meState());
    const toClient = (x, y, fy = 0.5) => page.evaluate(([x, y, fy]) => window.__lq.tileToClient(x, y, fy), [x, y, fy]);
    const onScreen = (p) => p.x > 20 && p.x < 1120 && p.y > 20 && p.y < 690;
    const shot = async (n) => { if (out) await page.screenshot({ path: `${out}/${voc}-${n}.png` }); };
    /** Anda até perto de (x,y) clicando em tiles visíveis na direção do alvo. */
    async function walkTo(x, y, near = 1, maxMs = 60000) {
      const end = Date.now() + maxMs;
      while (Date.now() < end && Date.now() - t0 < limitMs) {
        const m = await st();
        if (Math.max(Math.abs(m.x - x), Math.abs(m.y - y)) <= near) return true;
        const dx = Math.sign(x - m.x) * Math.min(6, Math.abs(x - m.x)), dy = Math.sign(y - m.y) * Math.min(5, Math.abs(y - m.y));
        const spot = await page.evaluate(([x, y]) => { for (let r = 0; r < 4; r++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (window.__lq.walkable(x + i, y + j)) return [x + i, y + j]; return null; }, [m.x + dx, m.y + dy]);
        if (!spot) return false;
        const c = await toClient(spot[0], spot[1]);
        if (onScreen(c)) await page.mouse.click(c.x, c.y);
        await page.waitForTimeout(1600);
      }
      return false;
    }
    async function talk(id, label) {
      const t = await page.evaluate((i) => window.__lq.npcTile(i), id);
      await walkTo(t.x, t.y, 3);
      for (let i = 0; i < 8; i++) {
        const c = await toClient(t.x, t.y, 0.3);
        if (onScreen(c)) await page.mouse.click(c.x, c.y);
        await page.waitForTimeout(1500);
        if (await page.locator(".npc-window").isVisible()) return true;
      }
      log(T(), "não abriu", label);
      return false;
    }

    await talk("guard_captain", "capitão");
    await shot("npc");
    await page.locator(".npc-window").getByRole("tab", { name: "Missões" }).click().catch(() => {});
    await page.locator('.quest-card[data-quest="rats_barn"]').getByRole("button", { name: "Aceitar" }).click();
    log(T(), "missão aceita");
    await page.keyboard.press("Escape");
    await shot("accepted");

    // Ratos na floresta ao norte (spawn 70,62).
    const progress = async () => Number((await page.locator(".quest-tracker .qt-step span").last().textContent().catch(() => "0/5")).split("/")[0]);
    let deaths = 0;
    await walkTo(70, 64, 3);
    log(T(), "na floresta");
    while ((await progress()) < 5 && Date.now() - t0 < limitMs) {
      if (await page.locator(".death-overlay").isVisible().catch(() => false)) {
        deaths++;
        log(T(), "MORTE");
        await page.waitForTimeout(1200); await page.keyboard.press("Escape"); await walkTo(70, 64, 3);
      }
      const m = await st();
      if (process.env.DBG && Date.now() % 4 < 1) log(T(), JSON.stringify({ at: [m.x, m.y], hp: m.hp, mana: m.mana, chase: m.chase, alvo: await page.evaluate(() => window.__lq.target()), ratos: (await page.evaluate(() => window.__lq.monsters().filter((x) => x.defId === "rat").length)) }));
      if (m.hp < m.maxHp * 0.35) await page.keyboard.press("q");
      const rats = await page.evaluate(() => window.__lq.monsters().filter((x) => x.defId === "rat"));
      const tgt = await page.evaluate(() => window.__lq.target());
      if (!tgt || !rats.some((r) => r.id === tgt)) {
        const r = rats.sort((a, b) => Math.max(Math.abs(a.x - m.x), Math.abs(a.y - m.y)) - Math.max(Math.abs(b.x - m.x), Math.abs(b.y - m.y)))[0];
        if (process.env.DBG && r) { const c = await toClient(r.x, r.y, 0.6); log(T(), "rato mais perto", JSON.stringify({ r: [r.x, r.y], hp: r.hp, eu: [m.x, m.y], tela: [Math.round(c.x), Math.round(c.y)], onScreen: onScreen(c), el: await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName + "." + e.className : null; }, [c.x, c.y]) })); }
        if (r) { const c = await toClient(r.x, r.y, 0.6); if (onScreen(c)) await page.mouse.click(c.x, c.y); else await walkTo(r.x, r.y, 3, 6000); }
        else await walkTo(70 + Math.round(Math.random() * 10 - 5), 62 + Math.round(Math.random() * 6 - 3), 1, 8000);
      } else if (voc !== "knight" && m.mana >= 8) await page.keyboard.press("2");
      await page.waitForTimeout(500);
    }
    log(T(), "ratos:", await progress(), "mortes:", deaths, "lv", (await st()).level);
    await shot("done");

    // Entrega.
    await talk("guard_captain", "capitão (entrega)");
    const btn = page.locator('.quest-card[data-quest="rats_barn"]').getByRole("button", { name: /Entregar|Concluir|Receber/ });
    let delivered = false;
    if (await btn.count()) { await btn.first().click(); delivered = true; log(T(), "entregue"); }
    await page.waitForTimeout(1500);
    await shot("turnin");
    const fin = await st();
    return { voc, ok: delivered, secs: Math.round((Date.now() - t0) / 1000), level: fin.level, deaths };
  } finally {
    await page.close();
  }
}

let failed = false;
try {
  if (!port) await startServer();
  const browser = await chromium.launch();
  for (const voc of VOCS) {
    const r = await run(browser, voc).catch((e) => ({ voc, ok: false, error: String(e) }));
    console.log(JSON.stringify(r));
    if (!r.ok) failed = true;
  }
  await browser.close();
} finally {
  stopServer();
}
process.exit(failed ? 1 : 0);
