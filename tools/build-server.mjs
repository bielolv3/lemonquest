// Empacota o servidor (+ @lemonquest/shared + dependências) num único arquivo ESM: packages/server/dist/server.mjs.
// Também gera dist/admin.mjs (CLI de administração: reset de senha, personagens excluídos...).
// O esbuild lê tsconfig.base.json (experimentalDecorators + useDefineForClassFields:false) — os decorators do
// @colyseus/schema são compilados do mesmo jeito que no tsx. Uso: `npm run build:server`.
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "packages/server/dist/server.mjs");

const result = await build({
  entryPoints: { server: path.join(root, "packages/server/src/index.ts"), admin: path.join(root, "packages/server/scripts/admin.ts") },
  outdir: path.join(root, "packages/server/dist"),
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  tsconfig: path.join(root, "packages/server/tsconfig.json"),
  minify: false,
  // OBRIGATÓRIO: o Colyseus acha o app do Express procurando um listener de nome "app" (listener.name === "app");
  // sem keepNames o esbuild renomeia a função (app2...) e as rotas /api deixam de funcionar.
  keepNames: true,
  sourcemap: "linked",
  legalComments: "none",
  logLevel: "info",
  metafile: true,
  // Pacotes CommonJS empacotados podem chamar require()/__dirname: oferece os dois no ESM.
  banner: {
    js: [
      'import { createRequire as __cr } from "node:module";',
      'import { fileURLToPath as __fu } from "node:url";',
      'import { dirname as __dn } from "node:path";',
      "const require = __cr(import.meta.url);",
      "const __filename = __fu(import.meta.url);",
      "const __dirname = __dn(__filename);",
    ].join("\n"),
  },
  // Dependências opcionais nativas que o servidor não usa (transporte `ws`).
  external: ["uWebSockets.js", "bufferutil", "utf-8-validate"],
});

const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log(`[build:server] ${path.relative(root, out)} — ${kb} KB, ${Object.keys(result.metafile.inputs).length} módulos`);
