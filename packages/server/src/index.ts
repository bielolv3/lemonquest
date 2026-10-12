import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server, matchMaker } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { WorldRoom } from "./rooms/WorldRoom.ts";
import { authRouter } from "./persistence/auth.ts";
import { checkpoint, closeDb, initDb } from "./persistence/db.ts";
import { backupDir, startBackups } from "./persistence/backup.ts";
import { devAdmins, devCommandsEnabled } from "./systems/devcommands.ts";

const PORT = Number(process.env.PORT ?? 2567);
const PROD = process.env.NODE_ENV === "production";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const CHECKPOINT_MS = 5 * 60_000;

// --- falhas no nível do processo ----------------------------------------------------------------------------------
// Os callbacks da sala já são protegidos pelo onUncaughtException do WorldRoom. O handler padrão do Colyseus
// (Utils.registerGracefulShutdown) DESLIGA o processo em qualquer uncaughtException — aqui ele fica desligado
// (gracefullyShutdown: false) e registramos os nossos: loga e segue; só desliga (salvando tudo) se virar uma enxurrada.
let crashes: number[] = [];
process.on("uncaughtException", (err, origin) => {
  console.error(`[processo] exceção não tratada (${origin}):`, err);
  const now = Date.now();
  crashes = crashes.filter((t) => now - t < 60_000);
  crashes.push(now);
  if (crashes.length >= 10) {
    console.error("[processo] 10 exceções em 1 min — desligando de forma ordenada (salvando tudo)");
    void shutdown("crash-loop", 1);
  }
});
process.on("unhandledRejection", (reason) => {
  console.error("[processo] promise rejeitada sem tratamento:", reason);
});

// --- checagens de boot -------------------------------------------------------------------------------------------
const dist = path.join(root, "packages/client/dist");
if (PROD && !fs.existsSync(path.join(dist, "index.html"))) {
  console.error(`[tibinha] cliente não encontrado em ${dist}. Rode \`npm run build\` primeiro.`);
  process.exit(1);
}
initDb();
if (devCommandsEnabled()) {
  const admins = [...devAdmins()];
  console.warn("!".repeat(72));
  console.warn(`!! COMANDOS DE DEV LIGADOS (TIBINHA_DEV_COMMANDS=1) para: ${admins.join(", ") || "(ninguém — defina TIBINHA_ADMINS)"}`);
  console.warn("!! /level /item /gold /heal /tp /ml — NÃO use isto no servidor do escritório.");
  console.warn("!".repeat(72));
}

// --- HTTP ------------------------------------------------------------------------------------------------------------
const app = express();
if (!PROD) {
  // Em dev o cliente (Vite :3000) chama a API na :2567.
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") { res.sendStatus(204); return; }
    next();
  });
}
app.use(express.json({ limit: "16kb" }));
app.use("/api", authRouter);
app.get("/health", (_req, res) => { res.json({ ok: true }); });

// Em produção o próprio servidor entrega o cliente buildado (uma porta só no escritório).
if (PROD) {
  // O mapa vem de assets/maps (o MESMO arquivo que o servidor carrega) — cliente e servidor nunca dessincronizam.
  app.use("/maps", express.static(path.join(root, "assets/maps"), { fallthrough: false }));
  app.use(express.static(dist));
}

// --- Colyseus ---------------------------------------------------------------------------------------------------------
const httpServer = http.createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }), gracefullyShutdown: false });
gameServer.define("world", WorldRoom);
// Só joinOrCreate pelo HTTP (create/join/joinById ficam fechados). A reconexão automática do SDK vai direto
// pelo WebSocket com o reconnectionToken, sem passar por /matchmake.
matchMaker.controller.exposedMethods = ["joinOrCreate"];
if (PROD) {
  // O Colyseus põe CORS aberto (Allow-Origin = origem pedida) em TODA resposta HTTP do servidor, inclusive /api.
  // Em produção cliente e API têm a mesma origem: sem cabeçalhos CORS.
  matchMaker.controller.DEFAULT_CORS_HEADERS = {} as typeof matchMaker.controller.DEFAULT_CORS_HEADERS;
  matchMaker.controller.getCorsHeaders = () => ({});
}

let stopBackups: () => void = () => {};
const checkpointTimer = setInterval(() => {
  try { checkpoint("PASSIVE"); } catch (e) { console.error("[db] checkpoint falhou:", e); }
}, CHECKPOINT_MS);
checkpointTimer.unref();

gameServer.onShutdown(async () => {
  stopBackups();
  clearInterval(checkpointTimer);
  try {
    closeDb(); // wal_checkpoint(TRUNCATE) + close
    console.log("[db] checkpoint + base fechada");
  } catch (e) {
    console.error("[db] erro ao fechar:", e);
  }
});

let shuttingDown = false;
async function shutdown(reason: string, code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[tibinha] desligando (${reason})...`);
  const force = setTimeout(() => { console.error("[tibinha] desligamento travou — saindo"); process.exit(code || 1); }, 15_000);
  force.unref();
  // Salva os jogadores (WorldRoom.onBeforeShutdown) → descarta salas → onShutdown (checkpoint + close).
  await gameServer.gracefullyShutdown(false);
  process.exit(code);
}
// SIGHUP: janela do console fechada; SIGBREAK: Ctrl+Break no Windows.
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"] as const) process.on(sig, () => void shutdown(sig));

await gameServer.listen(PORT, "0.0.0.0");
await matchMaker.createRoom("world", {}); // O mundo único, criado já no boot (joinOrCreate sempre cai nele).
stopBackups = startBackups();
console.log(`[tibinha] backups em ${backupDir()}`);
console.log(`[tibinha] servidor ouvindo em http://0.0.0.0:${PORT}`);
