import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// The `#shared` subpath works at build/tsc time via package.json "imports", but
// Vitest (Vite) resolves through its own graph — alias it explicitly so the
// ported server tests resolve the protocol the same way the daemon does.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^#shared/, replacement: fileURLToPath(new URL("./src/shared", import.meta.url)) },
    ],
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
