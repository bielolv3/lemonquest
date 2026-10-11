import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  publicDir: "../../assets",
  server: { host: true, port: 3000 },
});
