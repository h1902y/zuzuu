import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The client is a Vite + React 19 SPA rooted at src/client, built to dist/web —
// the exact dir the daemon's static handler serves (webDist = <pkg>/dist/web).
// The `#shared` alias mirrors vitest.config.ts so the browser bundle imports the
// one wire protocol the server uses. In dev, Vite proxies /api + /ws + /auth to
// the daemon on :7770.
export default defineConfig({
  root: fileURLToPath(new URL("./src/client", import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [{ find: /^#shared/, replacement: fileURLToPath(new URL("./src/shared", import.meta.url)) }],
  },
  build: {
    outDir: fileURLToPath(new URL("./dist/web", import.meta.url)),
    emptyOutDir: true,
    // The only chunks over 500 KB are the LAZY Monaco core + its workers (deferred
    // to file-open, never on first paint), so the default warning is noise.
    chunkSizeWarningLimit: 4000,
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:7770",
      "/auth": "http://127.0.0.1:7770",
      // changeOrigin so the upgrade reaches the daemon with Host=127.0.0.1:7770
      // (its Host allowlist rejects localhost:5173) — matching the /api rewrite,
      // else the terminal WS 403s and the footer shows "reconnecting".
      "/ws": { target: "ws://127.0.0.1:7770", ws: true, changeOrigin: true },
    },
  },
});
