import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { WorldRoom } from "./rooms/WorldRoom.ts";
import { authRouter } from "./persistence/auth.ts";

const PORT = Number(process.env.PORT ?? 2567);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const app = express();
// Em dev o cliente (Vite :3000) chama a API na :2567.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});
app.use(express.json());
app.use("/api", authRouter);
app.get("/health", (_req, res) => { res.json({ ok: true }); });

// Em produção o próprio servidor entrega o cliente buildado (uma porta só no escritório).
if (process.env.NODE_ENV === "production") {
  const dist = path.join(root, "packages/client/dist");
  app.use(express.static(dist));
}

const httpServer = http.createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });
gameServer.define("world", WorldRoom);

await gameServer.listen(PORT, "0.0.0.0");
console.log(`[tibinha] servidor ouvindo em http://0.0.0.0:${PORT}`);
