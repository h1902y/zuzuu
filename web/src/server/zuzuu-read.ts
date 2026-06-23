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
  BUILTIN_MODULES,
  SAFE_SLUG,
  moduleEnvelopeItems,
  peekModuleItems,
  proposalSummary,
  readJsonDir,
} from "./zuzuu-peek.js";

export function createZuzuuReadApi(getRoot: () => string, binary?: string): Hono {
  const app = new Hono();
  const agentDir = (root: string) => resolveSafe(root, ".zuzuu");
  const proposalsOf = (agent: string, key: string) => readJsonDir(path.join(agent, key, "proposals"));

  // The batched module surface: ONE `zuzuu module overview --json` spawn covers
  // all modules (manifest ui descriptors + counts + top titles + pending). CLI
  // absent → peek fallback (counts survive, ui descriptors degrade to the web
  // kit's built-in metadata).
  app.get("/overview", async (c) => {
    const root = getRoot();
    const viaCli = await runZuzuu(root, ["module", "overview"], { binary }) as { modules?: unknown[] } | null;
    if (viaCli && Array.isArray(viaCli.modules)) return c.json(viaCli);
    const agent = await agentDir(root);
    const modules = await Promise.all(BUILTIN_MODULES.map(async (id) => {
      const [items, proposals] = await Promise.all([peekModuleItems(agent, id), proposalsOf(agent, id)]);
      return {
        id,
        title: id.charAt(0).toUpperCase() + id.slice(1),
        enabled: true,
        counts: { items: items.length, pending: proposals.length, errors: 0 },
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
    const agent = await agentDir(root);
    const { items, errors, degraded } = await moduleEnvelopeItems(root, agent, key, binary);
    const proposals = (await proposalsOf(agent, key)).map((p) => proposalSummary(p, key));
    return c.json({ key, items, proposals, errors, ...(degraded ? { degraded: true } : {}) });
  });

  app.get("/module/:key/schema", async (c) => {
    const key = c.req.param("key");
    if (!SAFE_SLUG.test(key)) return c.json({ error: "unknown module" }, 404);
    const root = getRoot();
    const viaCli = await runZuzuu(root, ["module", "schema", key], { binary });
    if (viaCli) return c.json({ key, schema: viaCli, source: "cli" });
    // CLI absent → the seeded payload schema in the home (zuzuu init writes it)
    const agent = await agentDir(root);
    try {
      const schema: unknown = JSON.parse(await fsp.readFile(path.join(agent, key, "schema.json"), "utf8"));
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
    const agent = await agentDir(root);
    const dir = path.join(agent, ".generations", key);
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
