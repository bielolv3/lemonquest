import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
// @ts-ignore módulo .mjs sem tipos
import { buildPublic } from "../../tools/build-public.mjs";

// Dev: só localhost (LAN apenas com LEMONQUEST_DEV_LAN=1).
const lan = process.env.LEMONQUEST_DEV_LAN === "1";

export default defineConfig(({ command }) => ({
  plugins: [preact()],
  // Build: pasta curada (tools/build-public.mjs). Dev: assets/ completo.
  publicDir: command === "build" ? buildPublic() : "../../assets",
  server: {
    host: lan ? true : "localhost",
    port: 3000,
    fs: { deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/data/**", "**/*.db*", "**/.env*"] },
  },
}));
