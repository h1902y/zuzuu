// src/server/zuzuu-read.ts — one job: the READ side of /api/zuzuu/* (GET routes).
// module overview · module detail · payload schema · per-module generation lineage.
// CLI-first (zuzuu-cli), degrading to the file-read peek (zuzuu-peek) when the zz
// binary is absent. Never mutates — every write lives in zuzuu-write.ts.

import fsp from "node:fs/promises";
import path from "node:path";
import { Hono } from "hono";
import { resolveSafe } from "./safe-path.js";
import { runZuzuu } from "./zuzuu-cli.js";
import {
  SAFE_SLUG,
  SAFE_ID,
  listModuleDirs,
  moduleEnvelopeItems,
  peekModuleItems,
  stagedSummary,
  readJsonDir,
} from "./zuzuu-peek.js";

export function createZuzuuReadApi(getRoot: () => string, binary?: string): Hono {
  const app = new Hono();
  const homeDir = (root: string) => resolveSafe(root, ".zuzuu");
  const stagedOf = (home: string, key: string) => readJsonDir(path.join(home, key, "staged"));

  // The batched module surface: ONE `zuzuu module overview --json` spawn covers
  // all modules (manifest ui descriptors + counts + top titles + pending). CLI
  // absent → peek fallback (counts survive, ui descriptors degrade to the web
  // kit's built-in metadata).
  app.get("/overview", async (c) => {
    const root = getRoot();
    const viaCli = await runZuzuu(root, ["module", "overview"], { binary }) as { modules?: unknown[] } | null;
    if (viaCli && Array.isArray(viaCli.modules)) return c.json(viaCli);
    const home = await homeDir(root);
    const ids = await listModuleDirs(home); // real dirs on disk, not a hardcoded list
    const modules = await Promise.all(ids.map(async (id) => {
      const [items, staged] = await Promise.all([peekModuleItems(home, id), stagedOf(home, id)]);
      return {
        id,
        title: id.charAt(0).toUpperCase() + id.slice(1),
        enabled: true,
        counts: { items: items.length, pending: staged.length, errors: 0 },
        top: items.slice(0, 3).map((it) => String(it.title ?? it.id)),
        declarative: false,
      };
    }));
    return c.json({ modules, degraded: true });
  });

  app.get("/module/:key", async (c) => {
    const key = c.req.param("key");
    if (!SAFE_SLUG.test(key)) return c.json({ error: "unknown module" }, 404);
    const root = getRoot();
    const home = await homeDir(root);
    const { items, errors, degraded } = await moduleEnvelopeItems(root, home, key, binary);
    const staged = (await stagedOf(home, key)).map((p) => stagedSummary(p, key));
    return c.json({ key, items, staged, errors, ...(degraded ? { degraded: true } : {}) });
  });

  // One record (getOne) — CLI `zz module item <key> <id>`. Absent/unknown → 404.
  app.get("/module/:key/item/:id", async (c) => {
    const key = c.req.param("key");
    const id = c.req.param("id");
    if (!SAFE_SLUG.test(key)) return c.json({ error: "unknown module" }, 404);
    if (!SAFE_ID.test(id)) return c.json({ error: "bad id" }, 400);
    const viaCli = await runZuzuu(getRoot(), ["module", "item", key, id], { binary });
    if (viaCli) return c.json(viaCli);
    return c.json({ error: "not found" }, 404);
  });

  app.get("/module/:key/schema", async (c) => {
    const key = c.req.param("key");
    if (!SAFE_SLUG.test(key)) return c.json({ error: "unknown module" }, 404);
    const root = getRoot();
    const viaCli = await runZuzuu(root, ["module", "schema", key], { binary });
    if (viaCli) return c.json({ key, schema: viaCli, source: "cli" });
    // CLI absent → the seeded payload schema in the home (zuzuu init writes it)
    const home = await homeDir(root);
    try {
      const schema: unknown = JSON.parse(await fsp.readFile(path.join(home, key, "schema.json"), "utf8"));
      return c.json({ key, schema, source: "home" });
    } catch {
      return c.json({ key, schema: null, source: "absent" });
    }
  });

  // Per-module generation lineage. Generations are per-module atoms; this lists
  // ONE module's lineage + active. CLI-first (`zz module <m> generations`); falls
  // back to reading `.zuzuu/.generations/<module>/` directly.
  app.get("/module/:key/generations", async (c) => {
    const key = c.req.param("key");
    if (!SAFE_SLUG.test(key)) return c.json({ error: "unknown module" }, 404);
    const root = getRoot();
    const viaCli = await runZuzuu(root, ["module", key, "generations"], { binary });
    if (viaCli) return c.json(viaCli);
    const home = await homeDir(root);
    const dir = path.join(home, ".generations", key);
    const gens = (await readJsonDir(dir)).filter((g) => typeof g.n === "number");
    let active: string | null = null;
    try { active = (await fsp.readFile(path.join(dir, "active"), "utf8")).trim() || null; } catch { active = null; }
    return c.json({
      module: key,
      active,
      generations: gens
        .sort((a, b) => (a.n as number) - (b.n as number))
        .map((g) => ({ id: String(g.n), mintedAt: (g.mintedAt as string) ?? null, mintedFrom: (g.mintedFrom as string[]) ?? [] })),
    });
  });

  return app;
}
