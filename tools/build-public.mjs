// Gera packages/client/.public com apenas o que o jogo usa em produção
// (em vez de publicar a pasta assets/ inteira: músicas, gifs, previews, mapgen...).
// Uso: node tools/build-public.mjs   (o vite.config.ts também chama no `vite build`)
import { cpSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { dirname, join, basename, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assets = join(root, "assets");
export const PUBLIC_DIR = join(root, "packages", "client", ".public");

// Itens de assets/ninja que não são usados pelo jogo.
const NINJA_SKIP = [
  /[\\/]Audio[\\/]Musics([\\/]|$)/,
  // Sons de ambiente (23 MB) não são usados pelo jogo (sfx.ts). Se passar a usar, remova esta linha.
  /[\\/]Audio[\\/]Sounds[\\/]Ambient([\\/]|$)/,
  /\.gif$/i,
  /[\\/]preview[^\\/]*\.png$/i,
  /[\\/]Example[^\\/]*$/i,
  /[\\/]MusicCover\.png$/i,
];

export function buildPublic() {
  rmSync(PUBLIC_DIR, { recursive: true, force: true });
  mkdirSync(PUBLIC_DIR, { recursive: true });

  const copy = (rel, filter) => {
    const src = join(assets, rel);
    if (!existsSync(src)) throw new Error(`build-public: assets/${rel} não existe`);
    cpSync(src, join(PUBLIC_DIR, rel), { recursive: true, filter });
  };

  copy("ninja", (src) => !NINJA_SKIP.some((re) => re.test(src)));
  copy("icons", (src) => !/preview/i.test(basename(src)));
  copy("addons", (src) => !/preview/i.test(basename(src)));
  // Só o mapa; os previews .png ficam de fora.
  mkdirSync(join(PUBLIC_DIR, "maps"), { recursive: true });
  cpSync(join(assets, "maps", "world.json"), join(PUBLIC_DIR, "maps", "world.json"));
  return PUBLIC_DIR;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log("public curado em", relative(process.cwd(), buildPublic()));
}
