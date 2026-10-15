// Sobe o servidor dos testes E2E: banco/backup temporários (apagados a cada execução), modo E2E (cliente buildado +
// comandos de dev para os nomes de teste). Usado pelo webServer do playwright.config.ts.
//   E2E_SKIP_BUILD=1  pula o `npm run build:client` (cliente já buildado)
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.E2E_PORT ?? "2851";
const tmp = path.join(os.tmpdir(), `lemonquest-e2e-${port}`);
const win = process.platform === "win32";

fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(path.join(tmp, "backups"), { recursive: true });

if (process.env.E2E_SKIP_BUILD !== "1") {
  const b = spawnSync(win ? "npm.cmd" : "npm", ["run", "build:client"], { cwd: root, stdio: "inherit", shell: win });
  if (b.status !== 0) process.exit(b.status ?? 1);
}

const env = {
  ...process.env,
  NODE_ENV: "test",
  NODE_OPTIONS: "--disable-warning=ExperimentalWarning",
  PORT: port,
  LEMONQUEST_E2E: "1",
  LEMONQUEST_DB: path.join(tmp, "e2e.db"),
  LEMONQUEST_BACKUP_DIR: path.join(tmp, "backups"),
  LEMONQUEST_DEV_COMMANDS: "1",
  // Quem fecha a aba some em 2 s (em vez de 20): sem personagens fantasmas competindo pelos monstros do teste seguinte.
  LEMONQUEST_RECONNECT_S: process.env.LEMONQUEST_RECONNECT_S ?? "2",
  LEMONQUEST_ADMINS: process.env.E2E_ADMINS ?? "",
};
const tsx = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
// cwd = packages/server: o tsx usa o tsconfig de lá (decorators do @colyseus/schema).
const child = spawn(process.execPath, [tsx, "src/index.ts"], { cwd: path.join(root, "packages/server"), env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => child.kill(sig));
