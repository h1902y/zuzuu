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
    // 5s (Vitest's pure-JS-unit default) is too tight for THIS suite: many server
    // tests fork a subprocess (the `zz` CLI / a shell stub) or stand up a PTY, and
    // under full parallel load (70+ files) a cheap `/bin/sh` spawn can transiently
    // overshoot 5s on a CPU-saturated machine — the `zuzuu-stage` getOne flake. A
    // genuine hang still fails (it never resolves), so the higher bound only absorbs
    // scheduling contention, never masks a real deadlock.
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
});
