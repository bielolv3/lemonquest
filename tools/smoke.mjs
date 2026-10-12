// Teste de fumaça de um servidor em execução (imagem Docker, bundle...):
//   node tools/smoke.mjs http://127.0.0.1:3050 [--drop | --expect-ground] [--user smoke]
// Cria (ou reaproveita) a conta/personagem, entra no mundo com o SDK do Colyseus e confere a sincronização do estado.
//   --drop            larga o 1º item da mochila no chão e espera aparecer em state.groundItems (imprime a contagem)
//   --expect-ground   falha se não houver nenhum item no chão (usado depois de reiniciar o servidor)
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:2567").replace(/\/$/, "");
const flag = (n) => args.includes(n);
const ui = args.indexOf("--user");
const user = ui >= 0 ? args[ui + 1] : "smoke";
const password = "smoke-pass-123";

const here = path.dirname(fileURLToPath(import.meta.url));
const sdkEntry = createRequire(path.join(here, "../packages/client/package.json")).resolve("@colyseus/sdk");
const { Client } = await import(pathToFileURL(sdkEntry).href);

const post = async (p, body) => (await fetch(`${base}/api/${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
const fail = (m) => { console.error(`FALHOU: ${m}`); process.exit(1); };
const until = async (cond, what, ms = 8000) => {
  const t = Date.now();
  while (!cond()) { if (Date.now() - t > ms) fail(`timeout esperando ${what}`); await new Promise((r) => setTimeout(r, 50)); }
};

let s = await post("login", { account: user, password });
if (!s.ok) s = await post("login", { account: user, password, create: true });
if (!s.ok) fail(`login: ${JSON.stringify(s)}`);
if (!s.characters.some((c) => c.name === user)) {
  s = await post("characters", { session: s.session, name: user, vocation: "knight" });
  if (!s.ok) fail(`personagem: ${JSON.stringify(s)}`);
}
const play = await post("play", { session: s.session, name: user });
if (!play.ok) fail(`play: ${JSON.stringify(play)}`);

const room = await new Client(base).joinOrCreate("world", { token: play.token });
let inv = null;
room.onMessage("inventory", (m) => { inv = m; });
for (const t of ["explored", "conditions", "notice", "feed", "chat", "stats", "npc", "training", "arena"]) room.onMessage(t, () => {});
room.onMessage("*", () => {});
await until(() => room.state?.players?.size >= 1 && room.state.players.get(room.sessionId), "estado inicial (players)");
const me = room.state.players.get(room.sessionId);
console.log(`ok: entrou como ${me.name} em (${me.x},${me.y}), hp ${me.hp}, jogadores ${room.state.players.size}`);

await new Promise((r) => setTimeout(r, 600));
console.log(`itens no chão sincronizados: ${room.state.groundItems.size}`);
if (flag("--expect-ground") && room.state.groundItems.size < 1) fail("nenhum item no chão após o reinício");
if (flag("--drop")) {
  const before = room.state.groundItems.size;
  await until(() => inv, "mensagem de inventário");
  let index = inv.backpack.findIndex((i) => i);
  if (index < 0 && !Object.keys(inv.equipment).length) {
    // Personagem novo vem sem itens: precisa do servidor com LEMONQUEST_DEV_COMMANDS=1 e LEMONQUEST_ADMINS=<user>.
    inv = null;
    room.send("chat", { text: "/item short_sword 1", channel: "global" });
    await until(() => inv, "inventário após /item (servidor sem LEMONQUEST_DEV_COMMANDS=1?)");
    index = inv.backpack.findIndex((i) => i);
  }
  const slot = Object.keys(inv.equipment)[0];
  if (index < 0 && !slot) fail("personagem sem itens para largar");
  room.send("dropItem", { from: index >= 0 ? { where: "backpack", index } : { where: "equip", slot }, x: me.x, y: me.y });
  await until(() => room.state.groundItems.size > before, "item largado aparecer no estado");
  console.log(`ok: item largado; itens no chão agora: ${room.state.groundItems.size}`);
}
await room.leave();
process.exit(0);
