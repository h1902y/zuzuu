// src/server/zuzuu-routes.ts — the /api/zuzuu/* composition point.
//
// Mounts the READ half (GET — module overview/detail/schema/generations, CLI-first
// with a peek fallback) and the WRITE half (POST mutations, CLI-only). The substrate
// they share — the CLI-absent frontmatter peek, proposal shaping, and the id/slug
// guards — lives in zuzuu-peek.ts. The one onError here maps the read side's
// resolveSafe PathError → 403; everything else → 500.
//
// (Pruned 2026-06-22 with the v2 CLI: whole-zuzuu checkpoints, the OTLP session
// views, and eval/inbox — all dead v1 surface. "What a session changed" stays a
// git-derived view for a later rung.)

import { Hono } from "hono";
import { PathError } from "./safe-path.js";
import { createZuzuuReadApi } from "./zuzuu-read.js";
import { createZuzuuWriteApi } from "./zuzuu-write.js";
import { createZuzuuSetupApi } from "./zuzuu-setup.js";

interface ApiOpts { binary?: string; }

export function createZuzuuApi(getRoot: () => string, opts: ApiOpts = {}): Hono {
  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof PathError) return c.json({ error: err.message }, 403);
    return c.json({ error: "internal error" }, 500);
  });
  app.route("/", createZuzuuReadApi(getRoot, opts.binary));
  app.route("/", createZuzuuWriteApi(getRoot, opts.binary));
  app.route("/", createZuzuuSetupApi(getRoot, opts.binary)); // onboarding setup verbs (root-scoped)
  return app;
}
