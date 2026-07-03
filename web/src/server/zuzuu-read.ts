// src/server/zuzuu-read.ts — one job: the READ side of /api/zuzuu/* (GET routes).
// module overview · module detail · payload schema · per-module generation lineage.
// CLI-first (zuzuu-cli), degrading to the file-read peek (zuzuu-peek) when the zz
// binary is absent. Never mutates — every write lives in zuzuu-write.ts.

import fsp from "node:fs/promises";
import path from "node:path";
import { Hono } from "hono";
import { runCommand, runCommandText } from "./zuzuu-catalog.js";
import { readHeld } from "./held-sessions.js";
import {
  SAFE_SLUG,
  SAFE_ID,
  buildModuleQueryFlags,
  listModuleDirs,
  moduleEnvelopeItems,
  peekModuleItems,
  readMutationLog,
  resolveHome,
  stagedSummary,
  readJsonDir,
} from "./zuzuu-peek.js";
import type { HistoryEntry } from "#shared/index.js";

export function createZuzuuReadApi(getRoot: () => string, binary?: string): Hono {
  const app = new Hono();
  // root-mode aware: the peek's module dirs live at the repo root when the root
  // project.md marker is present; `.zuzuu/` otherwise. STAGED proposals ride the
  // MODULE dir (`<home>/<module>/staged/` — zz stage writes there), so they move
  // with the home too: a root-mode project's queue lives at `<root>/<m>/staged`.
  // (This was `.zuzuu`-fixed — root-mode proposals, and the World's ghosts, were
  // invisible to the daemon.)
  const homeDir = (root: string) => resolveHome(root);
  const stagedOf = async (root: string, key: string) => readJsonDir(path.join(await resolveHome(root), key, "staged"));

  // The batched module surface: ONE `zuzuu module overview --json` spawn covers
  // all modules (manifest ui descriptors + counts + top titles + pending). CLI
  // absent → peek fallback (counts survive, ui descriptors degrade to the web
  // kit's built-in metadata).
  app.get("/overview", async (c) => {
    const root = getRoot();
    const viaCli = await runCommand(root, "module.overview", {}, { binary }) as
      | { modules?: unknown[] }
      | Array<{ key: string; title?: string; enabled?: boolean; items: number; pending: number; top?: string[] }>
      | null;
    if (viaCli && !Array.isArray(viaCli) && Array.isArray(viaCli.modules)) return c.json(viaCli);
    // the CLI emits a bare rows array ({key,title,items,pending,top,enabled}) —
    // map it onto the dashboard DTO (this route used to expect {modules} and fell
    // through to the degraded peek on EVERY project; the map is the real fast path)
    if (Array.isArray(viaCli)) {
      const modules = viaCli.map((r) => ({
        id: r.key,
        title: r.title || r.key,
        enabled: r.enabled ?? true,
        counts: { items: r.items ?? 0, pending: r.pending ?? 0, errors: 0 },
        top: Array.isArray(r.top) ? r.top : [],
        declarative: false,
      }));
      return c.json({ modules });
    }
    const home = await homeDir(root);
    const ids = await listModuleDirs(home); // real dirs on disk, not a hardcoded list
    const modules = await Promise.all(ids.map(async (id) => {
      const [items, staged] = await Promise.all([peekModuleItems(home, id), stagedOf(root, id)]);
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
    // server-side filter·sort·paginate: the URL query → validated `module items` flags
    // (the index does the SELECT). `where` repeats; everything else is single-valued.
    const flags = buildModuleQueryFlags({
      text: c.req.query("text"), type: c.req.query("type"), status: c.req.query("status"),
      tag: c.req.query("tag"), sort: c.req.query("sort"), where: c.req.queries("where"),
      limit: c.req.query("limit"), offset: c.req.query("offset"),
    });
    const { items, total, errors, degraded } = await moduleEnvelopeItems(root, home, key, binary, flags);
    const staged = (await stagedOf(root, key)).map((p) => stagedSummary(p, key));
    // The contract this route promises the client is `ModuleDetail`: `items`/
    // `staged` are ALWAYS arrays, never omitted/null, on every path — CLI
    // success, CLI-absent peek, an empty/unknown module, a root-mode home.
    // Traced end to end: moduleEnvelopeItems (zuzuu-peek.ts) returns a real
    // array on its CLI branch (guarded by `Array.isArray(viaCli.items)`, else
    // it falls through to peekModuleItems, which itself always resolves an
    // array — `[]` for an unmapped/empty module dir, never undefined) and
    // stagedOf/readJsonDir the same (missing staged/ dir → `[]`). So today
    // every branch already holds this contract — no live "success with no
    // items" path was found. The `?? []` below is the response boundary's own
    // guarantee anyway: this exact class of bug (a CLI/degraded shape silently
    // drifting from what the client assumes) already broke /overview once and
    // /module/:key/generations once (see the comments above each) before this
    // route existed to prove it wrong; asserting the contract AT THE WIRE means
    // a future refactor of the read helpers can't reopen this class of crash
    // even if it stops guaranteeing arrays internally.
    return c.json({
      key, items: items ?? [], total, staged: staged ?? [], errors,
      ...(degraded ? { degraded: true } : {}),
    });
  });

  // The UNIFIED table (one table over everything): every module's rows through the
  // same filter·sort·paginate contract — `zz module items --all`. Each row carries
  // its module; the Everything grid renders module as a COLUMN, not a silo. No peek
  // fallback: with the CLI absent the unified view degrades to empty (the per-module
  // routes still peek).
  app.get("/items", async (c) => {
    const root = getRoot();
    const flags = buildModuleQueryFlags({
      text: c.req.query("text"), type: c.req.query("type"), status: c.req.query("status"),
      tag: c.req.query("tag"), sort: c.req.query("sort"), where: c.req.queries("where"),
      limit: c.req.query("limit"), offset: c.req.query("offset"),
    });
    const viaCli = await runCommand(root, "module.items.all", {}, { binary, extra: flags }) as
      { items?: unknown[]; total?: number; errors?: unknown[] } | null;
    if (viaCli && Array.isArray(viaCli.items)) {
      return c.json({ key: "", items: viaCli.items, total: viaCli.total ?? viaCli.items.length, staged: [], errors: viaCli.errors ?? [] });
    }
    return c.json({ key: "", items: [], total: 0, staged: [], errors: [], degraded: true });
  });

  // One record (getOne) — CLI `zz module item <key> <id>`. Absent/unknown → 404.
  app.get("/module/:key/item/:id", async (c) => {
    const key = c.req.param("key");
    const id = c.req.param("id");
    if (!SAFE_SLUG.test(key)) return c.json({ error: "unknown module" }, 404);
    if (!SAFE_ID.test(id)) return c.json({ error: "bad id" }, 400);
    const viaCli = await runCommand(getRoot(), "module.item", { key, id }, { binary });
    if (viaCli) return c.json(viaCli);
    return c.json({ error: "not found" }, 404);
  });

  // A note's history (§G.1) — the module's log.jsonl filtered to ONE note, newest
  // first, capped 50. Peek-only (readMutationLog — no CLI verb exists for this;
  // §G's brief is explicit: don't add one this pass). root-mode aware via
  // resolveHome, same as every other read here.
  app.get("/module/:key/item/:id/history", async (c) => {
    const key = c.req.param("key");
    const id = c.req.param("id");
    if (!SAFE_SLUG.test(key)) return c.json({ error: "unknown module" }, 404);
    if (!SAFE_ID.test(id)) return c.json({ error: "bad id" }, 400);
    const home = await homeDir(getRoot());
    const all = (await readMutationLog(home, key)) as HistoryEntry[];
    const mine = all.filter((e) => e.note === id);
    const entries = mine.slice(-50).reverse(); // last 50 in file order, newest first
    const bornAt = mine.find((e) => e.event === "create") ?? null;
    return c.json({ key, id, entries, bornAt });
  });

  app.get("/module/:key/schema", async (c) => {
    const key = c.req.param("key");
    if (!SAFE_SLUG.test(key)) return c.json({ error: "unknown module" }, 404);
    const root = getRoot();
    const viaCli = await runCommand(root, "module.schema", { key }, { binary });
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
    // the CLI's raw shape is `{active: number, generations: [{n, mintedAt,
    // mintedFrom}]}` — NUMBER `n`/`active`, no `module` key. The peek fallback
    // below already normalizes to the wire contract (`id: string`, `module`); this
    // fast path used to pass the CLI's shape straight through, so every project
    // with a working `zz` binary (the common case) shipped `id: undefined` to the
    // client (the §G.2 generation strip surfaced this live). Normalize here too.
    const viaCli = await runCommand(root, "module.generations", { key }, { binary }) as
      { active?: number | string | null; generations?: { n: number; mintedAt?: string | null; mintedFrom?: string[] }[] } | null;
    if (viaCli && Array.isArray(viaCli.generations)) {
      return c.json({
        module: key,
        active: viaCli.active != null ? String(viaCli.active) : null,
        generations: viaCli.generations
          .slice()
          .sort((a, b) => a.n - b.n)
          .map((g) => ({ id: String(g.n), mintedAt: g.mintedAt ?? null, mintedFrom: g.mintedFrom ?? [] })),
      });
    }
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

  // Diff two of a module's generations (§G.2, the generation strip's "what changed"
  // panel): `zz gen diff <m> <a> <b>` — which notes were added/modified/deleted.
  // `gen diff` has no `io` descriptor on the CLI side yet, so from/to ride as
  // validated `extra` positionals rather than a catalog param (see zuzuu-catalog.ts).
  // The CLI's `--json` output is the BARE changes array (`emit()` prints its `value`
  // arg whole — `genDiff`'s handler passes `r.changes` there, not a `{changes}`
  // wrapper), so `viaCli` IS the array; this was read as `viaCli.changes` at first
  // (always undefined → every diff read "nothing to compare," live-verify caught
  // it). A non-existent `from` (the module's first generation has no "before")
  // makes the CLI exit non-zero → runCommand degrades to null → `degraded: true`,
  // never an error (the client reads that as "nothing to diff against").
  app.get("/module/:key/generation/:from/diff/:to", async (c) => {
    const key = c.req.param("key");
    const from = c.req.param("from");
    const to = c.req.param("to");
    if (!SAFE_SLUG.test(key)) return c.json({ error: "unknown module" }, 404);
    if (!/^\d+$/.test(from) || !/^\d+$/.test(to)) return c.json({ error: "bad generation id" }, 400);
    const viaCli = await runCommand(getRoot(), "gen.diff", {}, { binary, extra: [key, from, to] });
    if (Array.isArray(viaCli)) return c.json({ module: key, from, to, changes: viaCli });
    return c.json({ module: key, from, to, changes: [], degraded: true });
  });

  // The session-start readiness brief: the human-readable `zz doctor` health check +
  // `zz digest` (where the project stands), shelled as raw text (neither has a --json
  // mode). The workbench embeds this in the agent's first turn (the session kickoff).
  // Either field is null when the CLI is absent / the verb produced nothing.
  app.get("/readiness", async (c) => {
    const root = getRoot();
    const [doctor, digest] = await Promise.all([
      runCommandText(root, "doctor", {}, { binary }),
      runCommandText(root, "digest", {}, { binary }),
    ]);
    return c.json({ doctor, digest });
  });

  // The map surface (P2): the whole project as nodes + links — `zz graph --json`.
  // `?props=a,b` rides chosen frontmatter columns on nodes. No peek fallback: a map
  // without the CLI degrades to empty (the shell renders its onboarding state).
  app.get("/graph", async (c) => {
    const raw = c.req.query("props") ?? "";
    const props = raw.split(",").map((s) => s.trim()).filter((s) => SAFE_SLUG.test(s)).join(",");
    const viaCli = await runCommand(getRoot(), "graph", props ? { props } : {}, { binary });
    if (viaCli) return c.json(viaCli);
    return c.json({ nodes: [], links: [], degraded: true });
  });

  // The Flow projection's summary read (§I rung 5): every `type: workflow` note
  // project-wide (`module items --all --type workflow` — the SAME unified-table
  // verb `/items` already shells), joined with the `runs` module's notes grouped
  // by their `workflow` field. Two spawns, no new CLI verb — composing the
  // existing `module items` shape was NOT clunky here, so no bespoke catalog
  // entry was needed; the join (counts + latest-by-created_at) is the only new
  // logic, and it belongs server-side so the toggle's availability check and the
  // workflow picker both read one small document instead of two + a client join.
  // Root-mode aware via runCommand→resolveHome same as every other route; no peek
  // fallback (a workflow's `steps` never survive the frontmatter-scalar peek —
  // `degraded: true` when the CLI can't answer, same doctrine as /graph).
  app.get("/flow", async (c) => {
    const root = getRoot();
    const wfFlags = buildModuleQueryFlags({ type: "workflow" });
    const viaWf = await runCommand(root, "module.items.all", {}, { binary, extra: wfFlags }) as
      { items?: Array<Record<string, unknown>> } | null;
    if (!viaWf || !Array.isArray(viaWf.items)) return c.json({ workflows: [], degraded: true });
    const workflows = viaWf.items;
    if (!workflows.length) return c.json({ workflows: [] });

    // the `runs` module may not exist yet (no run has ever started) — that's a
    // normal empty state, not a degraded read: runCommand already returns null on
    // ANY CLI failure (absent binary, non-zero exit, unparseable), so an unknown
    // module here just yields an empty run list, same as "started none yet."
    const viaRuns = await runCommand(root, "module.items", { key: "runs" }, { binary }) as
      { items?: Array<Record<string, unknown>> } | null;
    const runs = Array.isArray(viaRuns?.items) ? viaRuns.items : [];
    const byWorkflow = new Map<string, Array<Record<string, unknown>>>();
    for (const r of runs) {
      const wf = typeof r.workflow === "string" ? r.workflow : null;
      if (!wf) continue;
      const list = byWorkflow.get(wf);
      if (list) list.push(r); else byWorkflow.set(wf, [r]);
    }

    const RUN_STATUSES = ["running", "waiting", "done", "failed"] as const;
    const summaries = workflows.map((w) => {
      const module = String(w.module ?? "");
      const id = String(w.id ?? "");
      const addr = `${module}:${id}`;
      const wruns = byWorkflow.get(addr) ?? [];
      const counts = { total: wruns.length, running: 0, waiting: 0, done: 0, failed: 0 };
      for (const r of wruns) {
        const st = String(r.status ?? "");
        if ((RUN_STATUSES as readonly string[]).includes(st)) counts[st as typeof RUN_STATUSES[number]] += 1;
      }
      const latest = wruns.length
        ? wruns.slice().sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0]
        : undefined;
      return {
        addr, module, id, title: String(w.title ?? id),
        stepCount: Array.isArray(w.steps) ? w.steps.length : 0,
        runs: counts,
        latestRun: latest
          ? { id: String(latest.id ?? ""), status: String(latest.status ?? ""), startedAt: typeof latest.started_at === "string" ? latest.started_at : null }
          : null,
      };
    });
    return c.json({ workflows: summaries });
  });

  // The CODE gate queue: the workspace's held sessions awaiting a merge decision
  // (shells `zz session status --json` → its `held[]`, id-enriched). The close card's
  // code section reads this to surface the diff summary + mergeability beside the
  // brain proposals; the merge/discard actions live on /api/sessions (they mutate).
  // CLI absent / non-git → { held: [] } (degrades to "nothing held," never errors).
  app.get("/held", async (c) => {
    return c.json({ held: await readHeld(getRoot(), binary) });
  });

  return app;
}
