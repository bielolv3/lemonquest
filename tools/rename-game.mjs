#!/usr/bin/env node
// Troca o nome do jogo em tudo que o jogador e quem instala veem.
//
//   node tools/rename-game.mjs "Novo Nome"            (aplica)
//   node tools/rename-game.mjs "Novo Nome" --dry-run  (só mostra o que mudaria)
//
// Fonte da verdade: packages/shared/src/brand.json ({ name, slug }). O cliente lê o nome de lá
// (tela de login e título da aba). Este script atualiza o brand.json e substitui o nome antigo
// e os caminhos de instalação (C:\<slug>, logs, serviço do Windows) na documentação e nos scripts.
//
// NÃO mexe em identificadores internos: pacotes @tibinha/*, variáveis TIBINHA_*, arquivo do banco
// (data/tibinha.db) e chaves do localStorage. Trocar isso quebraria bancos e configurações existentes.
//
// Depois de rodar: `npm run build` e reinicie o servidor. Se o serviço do Windows já estiver
// instalado com o nome antigo, reinstale-o (veja deploy/windows/README-DEPLOY.md).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandFile = path.join(root, "packages/shared/src/brand.json");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const newName = args.filter((a) => a !== "--dry-run").join(" ").trim();

if (!newName) {
  console.error('Uso: node tools/rename-game.mjs "Novo Nome" [--dry-run]');
  process.exit(1);
}
if (newName.length > 40 || /[<>"`$\\]/.test(newName)) {
  console.error("Nome inválido: use até 40 caracteres, sem < > \" ` $ \\");
  process.exit(1);
}

/** "Hora Extra!" → "horaextra" (sem acentos, espaços ou símbolos). */
function toSlug(name) {
  return name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

const old = JSON.parse(fs.readFileSync(brandFile, "utf8"));
const next = { name: newName, slug: toSlug(newName) };
if (!next.slug) {
  console.error("O nome precisa ter pelo menos uma letra ou número.");
  process.exit(1);
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Substituições: nome visível (palavra inteira) + caminhos/arquivos derivados do slug. */
function rewrite(text) {
  let s = text;
  if (old.name !== next.name) s = s.replace(new RegExp(`(?<![\\w@])${esc(old.name)}(?![\\w])`, "g"), next.name);
  if (old.slug !== next.slug) {
    const o = esc(old.slug);
    s = s
      .replace(new RegExp(`([A-Za-z]:\\\\)${o}(?=\\\\|\\b)`, "g"), `$1${next.slug}`) // C:\slug
      .replace(new RegExp(`\\b${o}(\\.(?:out|err)\\.log)`, "g"), `${next.slug}$1`) // slug.out.log
      .replace(new RegExp(`backups-${o}\\b`, "g"), `backups-${next.slug}`)
      .replace(new RegExp(`start-${o}\\.cmd`, "g"), `start-${next.slug}.cmd`)
      .replace(new RegExp(`(clone \\S+ )${o}\\b`, "g"), `$1${next.slug}`)
      .replace(new RegExp(`\\[${o}\\]`, "g"), `[${next.slug}]`); // prefixo de log nos scripts
  }
  return s;
}

// Arquivos com texto visível ou instruções de instalação.
const files = [
  "README.md",
  "packages/client/index.html",
  ...fs.readdirSync(path.join(root, "deploy/windows")).map((f) => `deploy/windows/${f}`),
].filter((f) => fs.existsSync(path.join(root, f)) && fs.statSync(path.join(root, f)).isFile());

let changed = 0;
for (const rel of files) {
  const abs = path.join(root, rel);
  const before = fs.readFileSync(abs, "utf8");
  const after = rewrite(before);
  if (after !== before) {
    changed++;
    console.log(`${dryRun ? "[dry-run] " : ""}atualizado: ${rel}`);
    if (!dryRun) fs.writeFileSync(abs, after);
  }
}

// Atalho de início manual: start-<slug>.cmd
const oldCmd = path.join(root, `deploy/windows/start-${old.slug}.cmd`);
const newCmd = path.join(root, `deploy/windows/start-${next.slug}.cmd`);
if (old.slug !== next.slug && fs.existsSync(oldCmd)) {
  console.log(`${dryRun ? "[dry-run] " : ""}renomeado: start-${old.slug}.cmd → start-${next.slug}.cmd`);
  if (!dryRun) fs.renameSync(oldCmd, newCmd);
}

if (!dryRun) fs.writeFileSync(brandFile, JSON.stringify(next, null, 2) + "\n");

console.log(`\n${dryRun ? "[dry-run] " : ""}${old.name} (${old.slug}) → ${next.name} (${next.slug}); ${changed} arquivo(s).`);
if (!dryRun) {
  console.log("Próximos passos: `npm run build` e reinicie o servidor.");
  if (old.slug !== next.slug) {
    console.log(`Se o serviço do Windows "${old.name}" já estiver instalado, reinstale com o novo nome (deploy/windows/README-DEPLOY.md).`);
  }
}
