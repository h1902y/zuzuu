// src/server/projects-routes.ts — the MACHINE-GLOBAL Project routes (/api/projects/*).
//
// Unlike /api/zuzuu/* (root-scoped via getRoot), these read across Projects: the
// recents list (~/.webcode/config.json) for the switcher, and the names-only
// directory autocomplete for "Open a folder…". They take getRoot only to mark the
// current row. Switching itself reuses the daemon's existing POST /api/workspace/switch.

import { Hono } from "hono";
import * as config from "./config.js";
import { reconcileRecents } from "./recents.js";

interface ProjectsOpts {
  /** injectable for tests; defaults to the real ~/.webcode/config.json loader. */
  load?: () => Promise<{ recent: string[] }>;
}

export function createProjectsApi(getRoot: () => string, opts: ProjectsOpts = {}): Hono {
  const app = new Hono();
  const load = opts.load ?? config.load;

  // GET /recents — recents (most-recent-first), current marked (R16).
  app.get("/recents", async (c) => {
    const cfg = await load();
    return c.json({ recents: reconcileRecents(cfg.recent, getRoot()) });
  });

  return app;
}
