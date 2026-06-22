import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// The client is a plain Vite SPA rooted at src/client, built to dist/web — the
// exact dir the daemon's static handler serves (webDist = <pkg>/dist/web). The
// `#shared` alias mirrors vitest.config.ts so the browser bundle imports the one
// wire protocol the server uses. In dev, Vite proxies /api + /ws to the daemon.
export default defineConfig({
  root: fileURLToPath(new URL("./src/client", import.meta.url)),
  resolve: {
    alias: [
      { find: /^#shared/, replacement: fileURLToPath(new URL("./src/shared", import.meta.url)) },
    ],
  },
  build: {
    outDir: fileURLToPath(new URL("./dist/web", import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:7770",
      "/auth": "http://127.0.0.1:7770",
      "/ws": { target: "ws://127.0.0.1:7770", ws: true },
    },
  },
});
