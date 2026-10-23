// Empacota o servidor (+ @lemonquest/shared + dependências) num único arquivo ESM: packages/server/dist/server.mjs.
// Também gera dist/admin.mjs (CLI de administração: reset de senha, personagens excluídos...).
// O esbuild lê tsconfig.base.json (experimentalDecorators + useDefineForClassFields:false) — os decorators do
// @colyseus/schema são compilados do mesmo jeito que no tsx. Uso: `npm run build:server`.
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

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

// --- pré-compressão do cliente ---------------------------------------------------------------------------------------
// O Express não comprime nada; em vez de uma dependência (`compression`), o build gera `<arquivo>.gz` (zlib nível 9)
// para os arquivos de texto grandes e o servidor os entrega quando o navegador aceita gzip (packages/server/src/gzipStatic.ts).
// Roda aqui (build:server) porque vem depois do build:client no `npm run build`; o E2E só builda o cliente e segue sem .gz.
const dist = path.join(root, "packages/client/dist");
const targets = [];
if (fs.existsSync(dist)) {
  for (const f of ["index.html", "ranking.html"]) if (fs.existsSync(path.join(dist, f))) targets.push(path.join(dist, f));
  const assetsDir = path.join(dist, "assets");
  if (fs.existsSync(assetsDir)) {
    for (const f of fs.readdirSync(assetsDir)) if (/\.(js|css)$/.test(f)) targets.push(path.join(assetsDir, f));
  }
  // O mapa servido em produção é assets/maps/world.json; o .gz vai para dist/maps (o servidor só o usa se for mais novo).
  const worldJson = path.join(root, "assets/maps/world.json");
  if (fs.existsSync(worldJson)) {
    fs.mkdirSync(path.join(dist, "maps"), { recursive: true });
    targets.push({ src: worldJson, out: path.join(dist, "maps/world.json.gz") });
  }
}
let before = 0, after = 0;
for (const t of targets) {
  const src = typeof t === "string" ? t : t.src;
  const outGz = typeof t === "string" ? `${t}.gz` : t.out;
  const data = fs.readFileSync(src);
  const gz = gzipSync(data, { level: 9 });
  fs.writeFileSync(outGz, gz);
  before += data.length;
  after += gz.length;
}
console.log(`[build:server] gzip: ${targets.length} arquivos, ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB em packages/client/dist`);
