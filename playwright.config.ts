// Testes E2E (Playwright, Chromium) — `npm run test:e2e`. Sobe um servidor próprio (porta E2E_PORT, padrão 2851) com
// banco temporário; ver e2e/start-server.mjs e packages/server/src/e2e.ts.
import { defineConfig, devices } from "@playwright/test";
import { E2E_NAMES, E2E_PORT } from "./e2e/names.ts";

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  // CI (2 vCPUs, sem GPU): com 2 workers os testes de 2 navegadores ficam sem CPU e o personagem não "assenta".
  workers: process.env.CI ? 1 : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    // Trace grava cada resposta e trava o carregamento (24 MB de sprites) com vários workers: só na 2ª tentativa
    // (CI) ou com --trace on.
    trace: "on-first-retry",
    // GPU de verdade quando houver (o SwiftShader padrão do headless deixa o Phaser lento com vários workers).
    launchOptions: { args: process.env.E2E_SWIFTSHADER || process.platform !== "win32" ? [] : ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] },
  },
  projects: [{ name: "chromium" }],
  webServer: {
    command: "node e2e/start-server.mjs",
    url: `http://127.0.0.1:${E2E_PORT}/health`,
    timeout: 180_000,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    env: { E2E_PORT: String(E2E_PORT), E2E_ADMINS: E2E_NAMES.join(",") },
  },
});
