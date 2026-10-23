// Fuzz do protocolo contra um servidor em modo E2E. Dois modos:
//   proto      payloads aleatórios/malformados em todos os tipos de mensagem C2S (o servidor não pode cair nem
//              registrar exceção; confira o log dele)
//   inventory  movimentos válidos e quase-válidos entre mochila/equipamento/depot com contagens estranhas;
//              invariante: a soma de cada item nunca passa do que havia no começo e nenhum uid se repete
// Exemplo (o modo inventory usa /level e /item, então o nome precisa ser admin):
//   E2E_PORT=2872 E2E_SKIP_BUILD=1 E2E_ADMINS="Fuzz Inv" node e2e/start-server.mjs        (outro terminal)
//   node tools/fuzz.mjs http://127.0.0.1:2872 --mode proto --secs 90
//   node tools/fuzz.mjs http://127.0.0.1:2872 --mode inventory --secs 180 --name "Fuzz Inv"
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:2872").replace(/\/$/, "");
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const MODE = opt("--mode", "proto"), SECS = Number(opt("--secs", 60));
const NAME = opt("--name", MODE === "inventory" ? "Fuzz Inv" : "Fuzz Proto");

const here = path.dirname(fileURLToPath(import.meta.url));
const sdkEntry = createRequire(path.join(here, "../packages/client/package.json")).resolve("@colyseus/sdk");
const { Client } = await import(pathToFileURL(sdkEntry).href);

const post = async (p, body) => (await fetch(`${base}/api/${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];

const s = await post("login", { account: `fuzz${Date.now().toString(36)}`, password: "fuzz-123456", create: true });
if (!s.ok) throw new Error(`login: ${JSON.stringify(s)}`);
const c = await post("characters", { session: s.session, name: NAME, vocation: "knight" });
if (!c.ok) throw new Error(`personagem ${NAME}: ${JSON.stringify(c)}`);
const play = await post("play", { session: s.session, name: NAME });
if (!play.ok) throw new Error(`play: ${JSON.stringify(play)}`);
const room = await new Client(base).joinOrCreate("world", { token: play.token });
let left = null;
room.onLeave((code) => { left = code; });
room.onMessage("*", () => {});
// Limite do servidor: 60 mensagens/s por cliente (acima disso ele derruba a conexão — comportamento correto).
const GAP_MS = 25;

if (MODE === "proto") {
  // Todos os valores de C2S (shared/messages.ts). Para conferir que a lista continua completa:
  //   npx tsx -e "import {C2S} from './packages/shared/src/messages.ts'; console.log(Object.values(C2S).join(','))"
  const TYPES = ["move", "walkTo", "turn", "chat", "attack", "cast", "setHotkeys", "moveItem", "useItem", "quickPotion", "discardItem",
    "dropItem", "pickupItem", "moveGroundItem", "lookGround", "npcInteract", "npcTrade", "travel", "fightMode", "follow", "trainOpen",
    "trainOffline", "arena", "setOutfit", "buyOutfitTone", "quest", "materialRequest", "setTitle", "achievementsRequest", "party", "trade",
    "challenge", "fish", "useQuestObject"];
  const KEYS = ["dir", "seq", "x", "y", "text", "channel", "id", "targetId", "spellId", "from", "to", "count", "index", "slot", "kind",
    "npcId", "itemId", "action", "tab", "stance", "chase", "auto", "skill", "op", "name", "questId", "title", "outfit", "addons", "tone",
    "groundId", "toneId", "questObjectId", "rev", "offer", "gold", "items", "key", "list", "hotkeys", "lobbyId", "withParty", "fromId",
    "statueId", "destination", "on", "uid", "where", "requestId", "challengeId", "tx", "ty"];
  const weird = () => pick([null, undefined, 0, -1, 1e308, -1e308, NaN, Infinity, 3.7, "", "x".repeat(300), "__proto__", "constructor",
    true, false, [], [1, 2, 3], {}, { where: "backpack", index: -5 }, { where: "equip", slot: "head" }, { where: "depot", index: 9999 },
    "rat", "fireball", "knight", 2 ** 31, -0]);
  const obj = (depth = 0) => {
    const o = {};
    for (let i = 0; i < rnd(5); i++) o[pick(KEYS)] = depth < 2 && Math.random() < 0.2 ? obj(depth + 1) : weird();
    return o;
  };
  let sent = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < SECS * 1000 && left === null) {
    room.send(pick(TYPES), Math.random() < 0.15 ? weird() : obj());
    sent++;
    await wait(GAP_MS);
  }
  console.log(JSON.stringify({ mode: MODE, sent, disconnected: left }));
} else {
  let inv = null, depot = null;
  room.onMessage("inventory", (m) => { inv = m; });
  room.onMessage("depot", (m) => { depot = m.items; });
  const chat = (text) => room.send("chat", { text, channel: "global" });
  await wait(1500);
  for (const t of ["/level 40", "/item health_potion 30", "/item mana_potion 15", "/item longsword 1", "/item meat 9", "/item leather_armor 1", "/item short_bow 1"]) {
    chat(t);
    await wait(1100);
  }
  chat("/tp 96 96"); // ao lado do Guarda-Volumes: o depot só aceita itens perto dele
  await wait(1200);
  room.send("npcInteract", { npcId: "depot" });
  await wait(800);
  const totals = () => {
    const t = {}, uids = [];
    const add = (it) => { if (!it) return; t[it.defId] = (t[it.defId] ?? 0) + it.count; uids.push(it.uid); };
    inv?.backpack.forEach(add); Object.values(inv?.equipment ?? {}).forEach(add); (depot ?? []).forEach(add);
    return { t, dupUids: uids.length - new Set(uids).size };
  };
  const start = totals().t;
  if (!depot) console.log("aviso: depot não abriu (sem /tp?) — só mochila/equipamento");
  const SLOTS = ["helmet", "amulet", "armor", "weapon", "shield", "legs", "ring", "boots", "bogus"];
  const idx = () => pick([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 19, 20, -1, 1.5, "3", null]);
  const loc = () => { const w = pick(["backpack", "backpack", "equip", "depot", "depot", "ground"]); return w === "equip" ? { where: w, slot: pick(SLOTS) } : { where: w, index: idx() }; };
  const count = () => pick([undefined, undefined, 1, 2, 5, 0, -3, 1.5, 1e9, NaN, "2"]);
  let sent = 0, increased = null;
  const t0 = Date.now();
  while (Date.now() - t0 < SECS * 1000 && left === null) {
    const r = Math.random();
    if (r < 0.97) room.send("moveItem", { from: loc(), to: loc(), count: count() });
    else if (r < 0.98) room.send("useItem", { index: idx() });
    else if (r < 0.985) room.send("discardItem", { index: pick([0, 1, 2, -1, 99]) });
    else room.send("npcInteract", { npcId: "depot" });
    sent++;
    await wait(GAP_MS);
    // Mochila e depot chegam em mensagens separadas: no meio de um movimento a soma pode cair, nunca subir.
    for (const [k, v] of Object.entries(totals().t)) if (v > (start[k] ?? 0)) { increased = { item: k, now: v, start: start[k] ?? 0 }; console.log("AUMENTOU", JSON.stringify(increased)); }
  }
  await wait(1000);
  const end = totals();
  console.log(JSON.stringify({ mode: MODE, sent, disconnected: left, start, end: end.t, increased, duplicateUids: end.dupUids }));
  if (increased || end.dupUids) process.exitCode = 1;
}
const health = await (await fetch(`${base}/health`)).text();
console.log("health:", health);
try { room.leave(); } catch { /* já saiu */ }
setTimeout(() => process.exit(process.exitCode ?? 0), 200);
