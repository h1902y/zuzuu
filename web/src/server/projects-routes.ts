// src/server/projects-routes.ts — the MACHINE-GLOBAL Project routes (/api/projects/*).
//
// Unlike /api/zuzuu/* (root-scoped via getRoot), these read across Projects: the
// recents list (~/.webcode/config.json) for the switcher, and the names-only
// directory autocomplete for "Open a folder…". They take getRoot only to mark the
// current row. Switching itself reuses the daemon's existing POST /api/workspace/switch.

import { Hono } from "hono";
import * as config from "./config.js";
import { reconcileRecents } from "./recents.js";
import { listDirs } from "./dir-complete.js";
import { readRegistry, chooseSource, type RegistryStatus } from "./registry-read.js";

interface ProjectsOpts {
  /** injectable for tests; defaults to the real ~/.webcode/config.json loader. */
  load?: () => Promise<{ recent: string[] }>;
  /** injectable for tests; defaults to reading the active registry via the CLI. */
  registry?: (root: string) => Promise<RegistryStatus | null>;
}

export function createProjectsApi(getRoot: () => string, opts: ProjectsOpts = {}): Hono {
  const app = new Hono();
  const load = opts.load ?? config.load;
  const registry = opts.registry ?? readRegistry;

  // GET /recents — recents (most-recent-first), current marked (R16).
  app.get("/recents", async (c) => {
    const cfg = await load();
    return c.json({ recents: reconcileRecents(cfg.recent, getRoot()) });
  });

  // GET /list — the Projects Home: every recent + its health read from disk (no
  // daemon running). Cross-project; current marked.
  app.get("/list", async (c) => {
    const cfg = await load();
    const root = getRoot();
    // the fallback ladder: a configured registry wins; else the recents pass.
    const reg = await registry(root).catch(() => null);
    const { source, projects } = chooseSource(reg, cfg.recent, root);
    return c.json({ source, projects });
  });

  // GET /dir?prefix= — names-only directory autocomplete for "Open a folder…" (R17).
  // The one deliberately out-of-jail read (see dir-complete.ts) — never throws.
  app.get("/dir", async (c) => c.json(await listDirs(c.req.query("prefix") ?? "")));

  return app;
}
