import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Raiz do repositório (onde ficam assets/, data/ e packages/). LEMONQUEST_ROOT sobrescreve.
 * Padrão: três níveis acima deste arquivo — vale tanto para `packages/server/src/paths.ts` (tsx) quanto para o
 * bundle `packages/server/dist/server.mjs` (esbuild), que ficam à mesma profundidade.
 */
export const ROOT_DIR = process.env.LEMONQUEST_ROOT
  ? path.resolve(process.env.LEMONQUEST_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
