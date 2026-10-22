// Teste de carga: N "jogadores" bot entram no mundo, andam, atacam o monstro mais perto e falam de vez em quando.
// Use contra um servidor em modo E2E (sem limite de contas por IP). Os bots têm nomes fixos ("Bot 01", "Bot 02"…):
// passe-os em E2E_ADMINS para poderem usar /tp (ir para uma cave) e /status (ler o tick do servidor no fim).
//
//   node tools/loadtest.mjs --print-admins 10                                  → "Bot 01,Bot 02,…" para o E2E_ADMINS
//   E2E_PORT=2872 E2E_SKIP_BUILD=1 E2E_ADMINS="$(node tools/loadtest.mjs --print-admins 10)" node e2e/start-server.mjs
//   node tools/loadtest.mjs http://127.0.0.1:2872 --bots 10 --secs 130                     (vila, como no ciclo 2)
//   node tools/loadtest.mjs http://127.0.0.1:2872 --bots 10 --secs 300 --tp 120,40 --auto --max-p95 300 --max-tick 25
//
// Opções: --bots N · --secs N · --tp x,y (teleporta os bots para perto desse tile; exige admin) · --level N (/level
// antes de ir: bots de lv 1 numa cave só morrem; exige admin) · --auto (ataque automático + perseguir, como um jogador
// caçando) · --max-p95 ms (falha se a ida e volta p95 passar) · --max-tick ms (falha se o "máx" do tick lido no
// /status passar; exige admin). Sai com 1 se algum limite estourar.
// O desempenho detalhado continua no log do servidor (`[tick] …` a cada 60 s fora de produção).
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:/.test(a)) ?? "http://127.0.0.1:2872").replace(/\/$/, "");
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : d; };
const str = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const flag = (n) => args.includes(n);
const BOTS = opt("--bots", 10), SECS = opt("--secs", 70);
const MAX_P95 = opt("--max-p95", 0), MAX_TICK = opt("--max-tick", 0);
const AUTO = flag("--auto");
const LEVEL = opt("--level", 0);
const TP = str("--tp")?.split(",").map(Number);

const botName = (i) => `Bot ${String(i + 1).padStart(2, "0")}`;
if (flag("--print-admins")) { console.log(Array.from({ length: opt("--print-admins", BOTS) }, (_, i) => botName(i)).join(",")); process.exit(0); }
if (TP && (TP.length !== 2 || TP.some((v) => !Number.isInteger(v)))) { console.error("--tp espera x,y"); process.exit(2); }

const here = path.dirname(fileURLToPath(import.meta.url));
const sdkEntry = createRequire(path.join(here, "../packages/client/package.json")).resolve("@colyseus/sdk");
const { Client } = await import(pathToFileURL(sdkEntry).href);

const post = async (p, body) => (await fetch(`${base}/api/${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();
const vocs = ["knight", "paladin", "sorcerer", "druid"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function bot(i) {
  // Conta e personagem fixos por índice: rodar de novo reaproveita (o personagem precisa existir para o nome ser admin).
  const account = `loadbot${String(i + 1).padStart(2, "0")}`, password = "carga-123456", name = botName(i);
  // Cria primeiro: login numa conta inexistente conta como tentativa falha do IP (5 em 5 min bloqueiam), criar uma
  // conta que já existe não.
  let s = await post("login", { account, password, create: true });
  if (!s.ok && s.error === "account_taken") s = await post("login", { account, password });
  if (!s.ok) throw new Error(`login ${account}: ${JSON.stringify(s)}`);
  if (!s.characters?.some((c) => c.name === name)) {
    const r = await post("characters", { session: s.session, name, vocation: vocs[i % 4] });
    if (!r.ok) throw new Error(`personagem ${name}: ${JSON.stringify(r)}`);
  }
  const play = await post("play", { session: s.session, name });
  if (!play.ok) throw new Error(`play: ${JSON.stringify(play)}`);
  const room = await new Client(base).joinOrCreate("world", { token: play.token });
  const st = { msgs: 0, rtts: [], room, notices: [] };
  room.onMessage("notice", (m) => { st.notices.push(m?.text ?? ""); });
  room.onMessage("*", () => { st.msgs++; });
  return st;
}

const t0 = Date.now();
const bots = [];
for (let i = 0; i < BOTS; i++) bots.push(await bot(i));
console.log(`${BOTS} bots no mundo em ${((Date.now() - t0) / 1000).toFixed(1)} s; rodando ${SECS} s…`);

if (LEVEL > 0) {
  for (const b of bots) b.room.send("chat", { text: `/level ${LEVEL}`, channel: "global" });
  await sleep(300);
  if (bots[0].notices.some((t) => /desconhecido/i.test(t))) { console.error("--level exige os bots em E2E_ADMINS (--print-admins)"); process.exit(2); }
  // Vida/mana cheias no level novo.
  for (const b of bots) b.room.send("chat", { text: "/heal", channel: "global" });
  await sleep(200);
}
if (TP) {
  // Espalha os bots num raio de 3 tiles do ponto pedido (tiles bloqueados são recusados pelo servidor: tenta de novo).
  for (const [i, b] of bots.entries()) {
    for (let tries = 0; tries < 6; tries++) {
      const x = TP[0] + ((i * 7 + tries) % 7) - 3, y = TP[1] + ((i * 3 + tries) % 7) - 3;
      const before = b.notices.length;
      b.room.send("chat", { text: `/tp ${x} ${y}`, channel: "global" });
      await sleep(150);
      const reply = b.notices.slice(before).join(" ");
      if (/Teleportado/.test(reply)) break;
      if (/desconhecido/i.test(reply)) { console.error(`${botName(i)} não é admin: inclua os bots em E2E_ADMINS (--print-admins)`); process.exit(2); }
    }
  }
  console.log(`bots teleportados para perto de ${TP[0]},${TP[1]}`);
}
if (AUTO) for (const b of bots) b.room.send("fightMode", { stance: "offensive", chase: true, auto: true });

let seq = 0;
const timers = [];
for (const b of bots) {
  const r = b.room;
  const me = () => r.state.players?.get(r.sessionId);
  // Anda: muda de direção a cada ~1,2 s (8 direções; Dir 0..7), às vezes para. Com --auto anda menos (está caçando).
  timers.push(setInterval(() => {
    const dir = Math.random() < (AUTO ? 0.6 : 0.15) ? null : Math.floor(Math.random() * 8);
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
  // Ataca o monstro mais perto (até 8 tiles) a cada 3 s (sem --auto; com --auto o servidor escolhe sozinho).
  if (!AUTO) timers.push(setInterval(() => {
    const p = me();
    if (!p || !r.state.monsters) return;
    let best = null, bd = 9;
    r.state.monsters.forEach((m, id) => { const d = Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)); if (d < bd) { bd = d; best = id; } });
    if (best) r.send("attack", { targetId: best });
  }, 3000));
  // Fala de vez em quando.
  timers.push(setInterval(() => r.send("chat", { text: "carga " + Math.floor(Math.random() * 100), channel: "global" }), 15000 + Math.random() * 10000));
}

await sleep(SECS * 1000);
for (const t of timers) clearInterval(t);

const rtts = bots.flatMap((b) => b.rtts).sort((a, b) => a - b);
const pctv = (q) => (rtts.length ? rtts[Math.min(rtts.length - 1, Math.floor(q * rtts.length))] : NaN);
const pct = (q) => (rtts.length ? pctv(q).toFixed(0) : "-");
const msgs = bots.reduce((n, b) => n + b.msgs, 0);
console.log(`passos medidos: ${rtts.length}; ida e volta p50 ${pct(0.5)} ms, p95 ${pct(0.95)} ms, máx ${pct(0.999)} ms`);
console.log(`mensagens (não-estado) recebidas: ${(msgs / SECS / BOTS).toFixed(1)}/s por bot`);
const deaths = bots.reduce((n, b) => n + b.notices.filter((t) => /foi derrotado/.test(t)).length, 0);
if (AUTO) console.log(`avisos de morte vistos: ${deaths}`);

let failed = false;
if (MAX_P95 && pctv(0.95) > MAX_P95) { console.error(`FALHOU: p95 ${pct(0.95)} ms > ${MAX_P95} ms`); failed = true; }

// /status do servidor pelo primeiro bot (admin): tick médio/máx do anel de 1200 ticks.
{
  const b = bots[0];
  const before = b.notices.length;
  b.room.send("chat", { text: "/status", channel: "global" });
  await sleep(1500);
  const lines = b.notices.slice(before);
  for (const l of lines) console.log(`[status] ${l}`);
  const tick = lines.map((l) => /Tick: média ([\d.]+) ms, máx ([\d.]+) ms/.exec(l)).find(Boolean);
  if (MAX_TICK) {
    if (!tick) { console.error("FALHOU: /status não respondeu (o Bot 01 precisa estar em E2E_ADMINS)"); failed = true; }
    else if (Number(tick[2]) > MAX_TICK) { console.error(`FALHOU: tick máx ${tick[2]} ms > ${MAX_TICK} ms`); failed = true; }
  }
}

for (const b of bots) await b.room.leave().catch(() => {});
process.exit(failed ? 1 : 0);
