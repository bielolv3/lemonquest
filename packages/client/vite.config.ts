import { defineConfig } from "vite";
import { resolve } from "node:path";
import preact from "@preact/preset-vite";
// @ts-ignore módulo .mjs sem tipos
import { buildPublic } from "../../tools/build-public.mjs";

// Dev: só localhost (LAN apenas com LEMONQUEST_DEV_LAN=1).
const lan = process.env.LEMONQUEST_DEV_LAN === "1";

export default defineConfig(({ command }) => ({
  plugins: [preact()],
  // Build: pasta curada (tools/build-public.mjs). Dev: assets/ completo.
  publicDir: command === "build" ? buildPublic() : "../../assets",
  build: {
    // (Um bloco só: com rollupOptions E rolldownOptions juntos, o Vite 8 ficava só com o segundo e a página do ranking
    // sumia do build.)
    rolldownOptions: {
      input: { main: resolve(__dirname, "index.html"), ranking: resolve(__dirname, "ranking.html") },
      // Phaser (~1,1 MB) num pedaço próprio: muda só quando a dependência muda, então fica no cache do navegador
      // (/assets/* é immutable) e um deploy novo baixa só o código do jogo.
      output: { codeSplitting: { groups: [{ name: "phaser", test: /node_modules[\\/]phaser[\\/]/ }] } },
    },
    // O pedaço do Phaser passa de 500 kB sozinho; acima disso o aviso só repetiria o óbvio.
    chunkSizeWarningLimit: 1400,
  },
  server: {
    host: lan ? true : "localhost",
    port: 3000,
    // Docker de dev no Windows: o bind mount nem sempre avisa mudanças de arquivo, então olha por polling — só o código.
    // Fazer polling de assets/ (milhares de PNGs pelo bind mount) deixava cada página levando >10 s; o publicDir é lido
    // na hora a cada pedido, então não precisa ser vigiado.
    watch: process.env.LEMONQUEST_DEV_POLL === "1"
      ? { usePolling: true, interval: 1000, binaryInterval: 5000, ignored: ["**/assets/**", "**/node_modules/**", "**/docker-data*/**", "**/.git/**", "**/test-results/**", "**/playwright-report/**"] }
      : undefined,
    fs: { deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/data/**", "**/*.db*", "**/.env*"] },
  },
}));
