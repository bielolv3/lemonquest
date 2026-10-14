// Teste de carga: N "jogadores" bot entram no mundo, andam, atacam o monstro mais perto e falam de vez em quando.
// Use contra um servidor em modo E2E (sem limite de contas por IP), por exemplo:
//   E2E_PORT=2872 E2E_SKIP_BUILD=1 node e2e/start-server.mjs        (outro terminal)
//   node tools/loadtest.mjs http://127.0.0.1:2872 --bots 10 --secs 130
// O desempenho do servidor sai no log dele (`[tick] N ticks: média X ms, máx Y ms` a cada 60 s fora de produção).
// Aqui medimos o lado dos bots: mensagens recebidas por segundo e o atraso de ida e volta de um passo (move → patch).
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:2872").replace(/\/$/, "");
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : d; };
const BOTS = opt("--bots", 10), SECS = opt("--secs", 70);

const here = path.dirname(fileURLToPath(import.meta.url));
const sdkEntry = createRequire(path.join(here, "../packages/client/package.json")).resolve("@colyseus/sdk");
const { Client } = await import(pathToFileURL(sdkEntry).href);

const post = async (p, body) => (await fetch(`${base}/api/${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
const L = "abcdefghijklmnopqrstuvwxyz";
const run = Date.now().toString(36).slice(-4);
const vocs = ["knight", "paladin", "sorcerer", "druid"];

async function bot(i) {
  const account = `load${run}${i}`, password = "carga-123456";
  let s = await post("login", { account, password, create: true });
  if (!s.ok) throw new Error(`login ${account}: ${JSON.stringify(s)}`);
  const name = `Bot ${L[Math.floor(i / 26) % 26].toUpperCase()}${L[i % 26]}${run.replace(/[^a-z]/g, "x")}`;
  s = await post("characters", { session: s.session, name, vocation: vocs[i % 4] });
  if (!s.ok) throw new Error(`personagem ${name}: ${JSON.stringify(s)}`);
  const play = await post("play", { session: s.session, name });
  if (!play.ok) throw new Error(`play: ${JSON.stringify(play)}`);
  const room = await new Client(base).joinOrCreate("world", { token: play.token });
  const st = { msgs: 0, rtts: [], room };
  room.onMessage("*", () => { st.msgs++; });
  return st;
}

const t0 = Date.now();
const bots = [];
for (let i = 0; i < BOTS; i++) bots.push(await bot(i));
console.log(`${BOTS} bots no mundo em ${((Date.now() - t0) / 1000).toFixed(1)} s; rodando ${SECS} s…`);

let seq = 0;
const timers = [];
for (const b of bots) {
  const r = b.room;
  const me = () => r.state.players?.get(r.sessionId);
  // Anda: muda de direção a cada ~1,2 s (8 direções; Dir 0..7), às vezes para.
  timers.push(setInterval(() => {
    const dir = Math.random() < 0.15 ? null : Math.floor(Math.random() * 8);
    const p = me();
    const from = p ? `${p.x},${p.y}` : "";
    const sent = performance.now();
    r.send("move", { dir, seq: ++seq });
    if (dir !== null && p) {
      // Ida e volta: tempo até a posição mudar no estado (passo aceito + patch).
      const check = setInterval(() => {
        const q = me();
        if (q && `${q.x},${q.y}` !== from) { b.rtts.push(performance.now() - sent); clearInterval(check); }
      }, 5);
      setTimeout(() => clearInterval(check), 1000);
    }
  }, 1200 + Math.random() * 400));
  // Ataca o monstro mais perto (até 8 tiles) a cada 3 s.
  timers.push(setInterval(() => {
    const p = me();
    if (!p || !r.state.monsters) return;
    let best = null, bd = 9;
    r.state.monsters.forEach((m, id) => { const d = Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)); if (d < bd) { bd = d; best = id; } });
    if (best) r.send("attack", { targetId: best });
  }, 3000));
  // Fala de vez em quando.
  timers.push(setInterval(() => r.send("chat", { text: "carga " + Math.floor(Math.random() * 100), channel: "global" }), 15000 + Math.random() * 10000));
}

await new Promise((res) => setTimeout(res, SECS * 1000));
for (const t of timers) clearInterval(t);

const rtts = bots.flatMap((b) => b.rtts).sort((a, b) => a - b);
const pct = (q) => (rtts.length ? rtts[Math.min(rtts.length - 1, Math.floor(q * rtts.length))].toFixed(0) : "-");
const msgs = bots.reduce((n, b) => n + b.msgs, 0);
console.log(`passos medidos: ${rtts.length}; ida e volta p50 ${pct(0.5)} ms, p95 ${pct(0.95)} ms, máx ${pct(0.999)} ms`);
console.log(`mensagens (não-estado) recebidas: ${(msgs / SECS / BOTS).toFixed(1)}/s por bot`);
for (const b of bots) await b.room.leave().catch(() => {});
process.exit(0);
