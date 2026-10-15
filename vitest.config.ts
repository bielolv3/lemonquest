import { defineConfig } from "vitest/config";
// Metade dos núcleos (mínimo 1, máximo 4): o padrão usa todos e trava PCs comuns. VITEST_MAX_WORKERS sobrescreve.
import os from "node:os";
const workers = Number(process.env.VITEST_MAX_WORKERS) || Math.min(4, Math.max(1, Math.floor(os.cpus().length / 2)));
export default defineConfig({ test: { include: ["packages/*/src/**/*.test.ts", "packages/*/data/**/*.test.ts"], passWithNoTests: true, maxWorkers: workers } });
