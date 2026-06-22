// /api/zuzuu/* — observe + act routes over a project's zuzuu `.zuzuu/` home.
// Reads: raw data (proposals, per-module generations, digest) comes from disk;
// computed views (status, modules) read disk too, CLI-first where a v2 verb
// exists (the spawn layer lives in zuzuu-cli.ts), falling back to file-reads.
// Writes: mutations (approve/reject, per-module mint/rollback) are CLI-ONLY —
// the daemon never reimplements module writes; no CLI → 503. Mirrors fs-api.ts.
//
// Generations are PER-MODULE atoms: each module owns its lineage under
// `.zuzuu/.generations/<module>/` (`<n>.json` files + an `active` integer),
// matching src/grow/snapshot.mjs.
//
// (Pruned 2026-06-22 with the v2 CLI: whole-brain checkpoints, the OTLP session
// views — inspect/trace/tree/content + trace-linked file authors — and
// eval/inbox; all were dead v1 surface. "What a session changed" stays as a
// git-derived view, reimplemented via git.ts in a later rung.)

import fsp from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import type { Context } from "hono";
import { PathError, resolveSafe } from "./safe-path.js";
import { binAvailable, runZuzuu, runZuzuuMut } from "./zuzuu-cli.js";

/** The five built-in module slugs — used ONLY for the CLI-absent degraded fallback
 *  (peek enumerates the home dirs for the known built-ins). N-module routing is
 *  slug-validated, not allowlist-gated. */
const BUILTIN_MODULES = ["knowledge", "memory", "actions", "instructions", "guardrails"] as const;

/** Ids/slugs/generation-ids that may ride into a zuzuu argv. Validated BEFORE any spawn. */
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/i;

/** A safe module slug: lowercase alphanumeric start, then alphanumeric/underscore/hyphen. */
const SAFE_SLUG = /^[a-z0-9][a-z0-9_-]*$/;
const MAX_REASON_LEN = 500;

interface ApiOpts { binary?: string; }

// ── Module Standard envelope listing ────────────────────────────────────
// The CLI is the parser of record (`zuzuu module items <f> --json` returns
// the full envelopes incl. payload/body). When it's absent we degrade to a
// count-only frontmatter PEEK: read the items dir, lift the tiny top-level
// scalar lines (title:/status:/kind:) best-effort — counts still render,
// detail degrades. Never a re-implementation of the envelope grammar.

/** Flat envelope item dirs per module; actions are dir-shaped (ACTION.md). */
const ITEM_DIRS: Record<string, string[]> = {
  knowledge: ["knowledge", "items"],
  memory: ["memory", "entries"],
  instructions: ["instructions", "items"],
  guardrails: ["guardrails", "items"],
};

const PEEK_KEYS = new Set(["id", "module", "kind", "title", "status", "created_at", "updated_at"]);

function unquoteScalar(s: string): string {
  const t = s.trim();
  if (t.startsWith('"') && t.endsWith('"') && t.length >= 2) {
    try { return JSON.parse(t) as string; } catch { return t.slice(1, -1); }
  }
  if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) return t.slice(1, -1);
  return t;
}

/** Best-effort peek at an envelope's top-level frontmatter scalars. */
function peekFrontmatter(text: string): Record<string, string> {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const raw of (m[1] ?? "").split("\n")) {
    if (/^\s/.test(raw)) continue; // indented = provenance/payload children
    const kv = raw.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv && PEEK_KEYS.has(kv[1]!)) out[kv[1]!] = unquoteScalar(kv[2] ?? "");
  }
  return out;
}

/** CLI-less fallback: degraded envelope items (no payload/body) from disk. */
async function peekModuleItems(agent: string, key: string): Promise<Record<string, string>[]> {
  const files: { id: string; file: string }[] = [];
  if (key === "actions") {
    const base = path.join(agent, "actions");
    let names: string[] = [];
    try { names = (await fsp.readdir(base)).sort(); } catch { return []; }
    for (const n of names) {
      if (n === "inbox" || n === "proposals" || n === "_rolledback") continue;
      files.push({ id: n, file: path.join(base, n, "ACTION.md") });
    }
  } else {
    const rel = ITEM_DIRS[key];
    if (!rel) return [];
    const dir = path.join(agent, ...rel);
    let names: string[] = [];
    try { names = (await fsp.readdir(dir)).sort(); } catch { return []; }
    for (const n of names) {
      if (!n.endsWith(".md") || n === "README.md") continue;
      files.push({ id: n.replace(/\.md$/, ""), file: path.join(dir, n) });
    }
  }
  const items: Record<string, string>[] = [];
  for (const { id, file } of files) {
    let fm: Record<string, string>;
    try { fm = peekFrontmatter(await fsp.readFile(file, "utf8")); } catch { continue; }
    items.push({ kind: "?", ...fm, id: fm.id ?? id, module: key, title: fm.title ?? id });
  }
  return items;
}

interface EnvelopeListing {
  items: unknown[];
  errors: { file: string; error: string }[];
  degraded: boolean;
}

/** One module's envelope items: CLI first (full envelopes), peek fallback. */
async function moduleEnvelopeItems(root: string, agent: string, key: string, binary?: string): Promise<EnvelopeListing> {
  const viaCli = await runZuzuu(root, ["module", "items", key], { binary }) as
    { items?: unknown[]; errors?: { file: string; error: string }[] } | null;
  if (viaCli && Array.isArray(viaCli.items))
    return { items: viaCli.items, errors: Array.isArray(viaCli.errors) ? viaCli.errors : [], degraded: false };
  return { items: await peekModuleItems(agent, key), errors: [], degraded: true };
}

/** Read every *.json in a dir into objects; missing dir → [], corrupt file → skipped. */
async function readJsonDir(dir: string): Promise<Record<string, unknown>[]> {
  let names: string[] = [];
  try { names = (await fsp.readdir(dir)).filter((n) => n.endsWith(".json")); } catch { return []; }
  const out: Record<string, unknown>[] = [];
  for (const n of names) {
    try { out.push(JSON.parse(await fsp.readFile(path.join(dir, n), "utf8"))); } catch { /* skip corrupt */ }
  }
  return out;
}

const firstLine = (s: unknown, n = 80) => (String(s ?? "").split("\n")[0] ?? "").slice(0, n);

/** A proposal's best-effort one-line title (file-read fallback; the CLI inbox uses adapters). */
function proposalTitle(p: Record<string, unknown>): string {
  const cand = p.candidate as { body?: string } | undefined;
  const payload = p.payload as { body?: string } | undefined;
  return firstLine(cand?.body ?? payload?.body ?? p.id);
}

/** A short preview of the actual content being approved — the WHAT block in the
 *  review/detail card. Knowledge → the body's first lines; a guardrail rule →
 *  pattern → action; an action → its exec command. Best-effort, never throws. */
function proposalPreview(p: Record<string, unknown>): string {
  const payload = (p.payload ?? p.candidate) as Record<string, unknown> | undefined;
  if (!payload) return "";
  // guardrail rule: pattern → action
  const pattern = payload.pattern ?? (payload.attributes as Record<string, unknown> | undefined)?.pattern;
  const action = payload.action ?? (payload.attributes as Record<string, unknown> | undefined)?.action;
  if (typeof pattern === "string" && pattern) {
    return typeof action === "string" && action ? `${pattern} → ${action}` : String(pattern);
  }
  // action runbook/script: the exec line
  const exec = payload.exec ?? (payload.attributes as Record<string, unknown> | undefined)?.exec;
  if (typeof exec === "string" && exec) return exec;
  // default: the body's first ~3 lines
  const body = payload.body;
  if (typeof body === "string" && body) {
    return body.split("\n").slice(0, 3).join("\n").slice(0, 400);
  }
  return "";
}

/** Enrich a raw on-disk proposal into the ProposalSummary the panel renders —
 *  carrying the payload preview + the persisted score/signals/evidence so the
 *  module-detail card shows the same WHAT/WHY a review card does. Best-effort:
 *  every enrichment field is optional and omitted when absent. */
function proposalSummary(p: Record<string, unknown>, key: string) {
  const payload = (p.payload ?? p.candidate) as Record<string, unknown> | undefined;
  const kind = typeof payload?.type === "string" ? payload.type
    : typeof p.kind === "string" && p.kind !== "item" ? p.kind
      : undefined;
  const preview = proposalPreview(p);
  const score = p.score as { score?: number; confidence?: string; rationale?: string } | undefined;
  const evidence = p.evidence as Record<string, unknown> | undefined;
  const erVerdict = (p.analysis as { er?: { verdict?: string } } | undefined)?.er?.verdict
    ?? (p.er as { verdict?: string } | undefined)?.verdict;
  const ev: Record<string, unknown> = {};
  if (typeof evidence?.occurrences === "number") ev.occurrences = evidence.occurrences;
  if (typeof evidence?.sessions === "number") ev.sessions = evidence.sessions;
  if (typeof evidence?.failures === "number") ev.failures = evidence.failures;
  if (typeof erVerdict === "string") ev.erVerdict = erVerdict;
  return {
    id: String(p.id ?? "?"),
    module: key,
    title: proposalTitle(p),
    ...(kind ? { kind } : {}),
    ...(preview ? { preview } : {}),
    ...(score && typeof score.score === "number" ? { score: score.score } : {}),
    ...(score?.confidence ? { confidence: score.confidence } : {}),
    ...(score?.rationale ? { rationale: score.rationale } : {}),
    ...(Object.keys(ev).length ? { evidence: ev } : {}),
  };
}

export function createZuzuuApi(getRoot: () => string, opts: ApiOpts = {}): Hono {
  const app = new Hono();
  let root = getRoot();
  app.use("*", async (_c, next) => { root = getRoot(); await next(); });
  app.onError((err, c) => {
    if (err instanceof PathError) return c.json({ error: err.message }, 403);
    return c.json({ error: "internal error" }, 500);
  });

  const agentDir = () => resolveSafe(root, ".zuzuu");
  const proposalsOf = async (agent: string, key: string) => readJsonDir(path.join(agent, key, "proposals"));

  app.get("/health", async (c) => {
    const agent = await agentDir();
    return c.json({ home: existsSync(agent), zuzuuBin: binAvailable(opts.binary ?? "zuzuu") });
  });

  app.get("/modules", async (c) => {
    const agent = await agentDir();
    const modules = await Promise.all(BUILTIN_MODULES.map(async (key) => {
      const [{ items }, proposals] = await Promise.all([
        moduleEnvelopeItems(root, agent, key, opts.binary),
        proposalsOf(agent, key),
      ]);
      return { key, count: items.length, pending: proposals.length };
    }));
    return c.json({ modules });
  });

  // The batched module surface: ONE `zuzuu module overview --json` spawn
  // covers all modules (manifest ui descriptors + counts + top titles +
  // pending) — replaces the 5-spawn-per-cycle /modules pattern for the
  // panel root. CLI absent → peek fallback (counts survive, ui descriptors
  // degrade to the web kit's built-in metadata).
  app.get("/overview", async (c) => {
    const viaCli = await runZuzuu(root, ["module", "overview"], { binary: opts.binary }) as
      { modules?: unknown[] } | null;
    if (viaCli && Array.isArray(viaCli.modules)) return c.json(viaCli);
    const agent = await agentDir();
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
    const agent = await agentDir();
    const { items, errors, degraded } = await moduleEnvelopeItems(root, agent, key, opts.binary);
    const proposals = (await proposalsOf(agent, key)).map((p) => proposalSummary(p, key));
    return c.json({ key, items, proposals, errors, ...(degraded ? { degraded: true } : {}) });
  });

  app.get("/module/:key/schema", async (c) => {
    const key = c.req.param("key");
    if (!SAFE_SLUG.test(key)) return c.json({ error: "unknown module" }, 404);
    const viaCli = await runZuzuu(root, ["module", "schema", key], { binary: opts.binary });
    if (viaCli) return c.json({ key, schema: viaCli, source: "cli" });
    // CLI absent → the seeded payload schema in the home (zuzuu init writes it)
    const agent = await agentDir();
    try {
      const schema: unknown = JSON.parse(await fsp.readFile(path.join(agent, key, "schema.json"), "utf8"));
      return c.json({ key, schema, source: "home" });
    } catch {
      return c.json({ key, schema: null, source: "absent" });
    }
  });

  // Per-module generation lineage. Generations are per-module atoms; this lists
  // ONE module's lineage + active. CLI-first (`zz module <m> generations`); falls
  // back to reading `.zuzuu/.generations/<module>/` directly (`<n>.json` entries
  // + an `active` integer file — the on-disk shape src/grow/snapshot.mjs writes).
  app.get("/module/:key/generations", async (c) => {
    const key = c.req.param("key");
    if (!SAFE_SLUG.test(key)) return c.json({ error: "unknown module" }, 404);
    const viaCli = await runZuzuu(root, ["module", key, "generations"], { binary: opts.binary });
    if (viaCli) return c.json(viaCli);
    const agent = await agentDir();
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

  // Sessions list. The v1 `sessions.json` index was cut (a session IS a git
  // branch now), and there is no `zz sessions` verb — so this is an honest empty
  // list until the client rebuild wires the real source (git branches), rather
  // than shelling a dead verb or reading a dead index.
  app.get("/sessions", (c) => c.json({ sessions: [] }));

  app.get("/digest", async (c) => {
    const agent = await agentDir();
    try { return c.json({ text: await fsp.readFile(path.join(agent, ".live", "digest.md"), "utf8") }); }
    catch { return c.json({ text: "" }); }
  });

  // What the session changed (`zuzuu session diff <id> --json`): files + counts,
  // resolved from the session's git branch (live) or merge commit (past). CLI-first;
  // absent → 503, unknown → { available:false } 404. Read-only: pure git reads,
  // never touches the PTY / capture / working tree.
  app.get("/session-diff/:id", async (c) => {
    const id = c.req.param("id");
    if (!SAFE_ID.test(id)) return c.json({ error: "bad id" }, 400);
    const r = await runZuzuuMut(root, ["session", "diff", id], { binary: opts.binary });
    if (!r.ok) {
      if (r.code === "absent") return c.json({ error: "zuzuu CLI required" }, 503);
      return c.json({ sessionId: id, available: false, totals: { files: 0, additions: 0, deletions: 0 }, files: [] }, 404);
    }
    return c.json(r.data as Record<string, unknown>);
  });

  // One file's unified diff for a session (`zuzuu session diff <id> --file <path>
  // --json`). The path is an argv element (no shell), bounded by `git diff -- <path>`;
  // absent → 503, unknown → { diff:"" } 404.
  app.get("/session-file-diff/:id", async (c) => {
    const id = c.req.param("id");
    const path = c.req.query("path");
    if (!SAFE_ID.test(id)) return c.json({ error: "bad id" }, 400);
    if (!path) return c.json({ error: "path required" }, 400);
    const r = await runZuzuuMut(root, ["session", "diff", id, "--file", path], { binary: opts.binary });
    if (!r.ok) {
      if (r.code === "absent") return c.json({ error: "zuzuu CLI required" }, 503);
      return c.json({ sessionId: id, path, diff: "" }, 404);
    }
    return c.json(r.data as Record<string, unknown>);
  });

  // Set/clear a session's user label (`zuzuu session label <id> --text <label>`).
  // A blank label clears it. Persisted outside the index (survives re-capture).
  app.post("/session-label/:id", async (c) => {
    const id = c.req.param("id");
    if (!SAFE_ID.test(id)) return c.json({ error: "bad id" }, 400);
    const body = await readBody(c);
    const label = typeof body.label === "string" ? body.label : "";
    if (label.length > 200) return c.json({ error: "label too long" }, 400);
    return mutate(c, ["session", "label", id, "--text", label]);
  });

  // The panel-root status: per-module active generation + pending counts, read
  // straight from disk (the v2 `zz status` is a different, host-facing view, so
  // there is no CLI-first here). Generation actives live at
  // `.zuzuu/.generations/<module>/active` (a bare integer — see snapshot.mjs).
  app.get("/status", async (c) => {
    const agent = await agentDir();
    const pending: Record<string, number> = {};
    for (const key of BUILTIN_MODULES) pending[key] = (await proposalsOf(agent, key)).length;
    const generations: Record<string, string | null> = {};
    for (const key of BUILTIN_MODULES) {
      try { generations[key] = (await fsp.readFile(path.join(agent, ".generations", key, "active"), "utf8")).trim() || null; } catch { generations[key] = null; }
    }
    return c.json({ home: existsSync(agent), generations, pending, drift: { dirty: false, items: [] } });
  });

  // Per-module generation diff (show). CLI-only (the diff needs the parser).
  app.get("/module/:key/generation/:id", async (c) => {
    const key = c.req.param("key");
    if (!SAFE_SLUG.test(key)) return c.json({ error: "unknown module" }, 404);
    const id = c.req.param("id");
    if (!SAFE_ID.test(id)) return c.json({ error: "bad id" }, 400);
    const viaCli = await runZuzuu(root, ["module", key, "generation", "show", id], { binary: opts.binary });
    if (viaCli) return c.json(viaCli);
    return c.json({ error: "generation diff needs the zuzuu CLI" }, 503);
  });

  // ── Write side: mutations are CLI-only — every route below shells out to
  // `zuzuu … --json` via runZuzuuMut and never touches module files itself.

  const readBody = async (c: Context): Promise<Record<string, unknown>> => {
    try { const b = await c.req.json(); return b && typeof b === "object" ? b as Record<string, unknown> : {}; }
    catch { return {}; }
  };
  /** Run a mutation and map the result: absent → 503, failed → 502, success → 200 + CLI JSON. */
  const mutate = async (c: Context, args: string[]) => {
    const r = await runZuzuuMut(root, args, { binary: opts.binary });
    if (!r.ok) {
      return r.code === "absent"
        ? c.json({ error: "zuzuu CLI required" }, 503)
        : c.json({ error: "zuzuu command failed", stderr: r.stderr ?? "", data: r.data ?? null }, 502);
    }
    return c.json(r.data as Record<string, unknown>);
  };
  /** A valid module arg: any safe slug (the CLI reports not-found for unknown ones). */
  const isModule = (f: unknown): f is string =>
    typeof f === "string" && SAFE_SLUG.test(f);

  // Toggle a module's enabled flag. Body: { enabled: boolean }.
  // Shells out to `zuzuu module enable <key>` or `zuzuu module disable <key>`.
  app.post("/module/:key/enabled", async (c) => {
    const key = c.req.param("key");
    if (!SAFE_SLUG.test(key)) return c.json({ error: "unknown module" }, 404);
    const { enabled } = await readBody(c);
    if (typeof enabled !== "boolean") return c.json({ error: "body must be {enabled: boolean}" }, 400);
    const subcommand = enabled ? "enable" : "disable";
    return mutate(c, ["module", subcommand, key]);
  });

  // Guided module creation (WS-D). Body: {id, title, tagline, capabilities[],
  // kinds[], required[]}. Slug-validate id, then shell out to
  // `zuzuu module new <id> --title … --capabilities a,b --kinds x --required body`.
  // Strings ride as single argv elements (shell-meta inert); CLI JSON returned.
  app.post("/module/new", async (c) => {
    const body = await readBody(c);
    const { id, title, tagline, capabilities, kinds, required } = body;
    if (!isModule(id)) return c.json({ error: "bad module id" }, 400);
    const okStr = (v: unknown, max = 200): v is string => typeof v === "string" && v.length <= max;
    const okList = (v: unknown): v is string[] =>
      v === undefined ||
      (Array.isArray(v) && v.length <= 50 && v.every((s) => typeof s === "string" && s.length <= 100 && !s.includes(",")));
    if (title !== undefined && !okStr(title)) return c.json({ error: "bad title" }, 400);
    if (tagline !== undefined && !okStr(tagline)) return c.json({ error: "bad tagline" }, 400);
    if (!okList(capabilities)) return c.json({ error: "bad capabilities" }, 400);
    if (!okList(kinds)) return c.json({ error: "bad kinds" }, 400);
    if (!okList(required)) return c.json({ error: "bad required" }, 400);
    const args = ["module", "new", id];
    if (okStr(title) && title) args.push("--title", title);
    if (okStr(tagline) && tagline) args.push("--tagline", tagline);
    if (Array.isArray(capabilities) && capabilities.length) args.push("--capabilities", capabilities.join(","));
    if (Array.isArray(kinds) && kinds.length) args.push("--kinds", kinds.join(","));
    if (Array.isArray(required) && required.length) args.push("--required", required.join(","));
    return mutate(c, args);
  });

  app.post("/proposals/:id/approve", async (c) => {
    const id = c.req.param("id");
    if (!SAFE_ID.test(id)) return c.json({ error: "bad id" }, 400);
    const { module } = await readBody(c);
    if (!isModule(module)) return c.json({ error: "bad module" }, 400);
    return mutate(c, ["proposals", "approve", id, "--module", module]);
  });

  app.post("/proposals/:id/reject", async (c) => {
    const id = c.req.param("id");
    if (!SAFE_ID.test(id)) return c.json({ error: "bad id" }, 400);
    const { module, reason } = await readBody(c);
    if (!isModule(module)) return c.json({ error: "bad module" }, 400);
    if (reason !== undefined && (typeof reason !== "string" || reason.length > MAX_REASON_LEN))
      return c.json({ error: "bad reason" }, 400);
    // reason rides as ONE argv element — spawn arrays make shell-meta inert
    return mutate(c, ["proposals", "reject", id, "--module", module, ...(reason ? ["--reason", reason] : [])]);
  });

  for (const verb of ["approve", "reject"] as const) {
    app.post(`/actions/:slug/${verb}`, async (c) => {
      const slug = c.req.param("slug");
      if (!SAFE_ID.test(slug)) return c.json({ error: "bad slug" }, 400);
      return mutate(c, ["act", verb, slug]);
    });
  }

  // Per-module mint (freeze ONE module's current items into its next gen). The
  // review ceremony does this automatically; this is the explicit/web surface.
  app.post("/module/:key/generation/mint", async (c) => {
    const key = c.req.param("key");
    if (!isModule(key)) return c.json({ error: "bad module" }, 400);
    const { from } = await readBody(c);
    if (from !== undefined &&
        (!Array.isArray(from) || from.length > 200 || !from.every((f) => typeof f === "string" && SAFE_ID.test(f))))
      return c.json({ error: "bad from ids" }, 400);
    const fromIds = (from as string[] | undefined) ?? [];
    return mutate(c, ["module", key, "generation", "mint", ...(fromIds.length ? ["--from", fromIds.join(",")] : [])]);
  });

  // Per-module rollback (restore ONE module's bytes + active to a past gen).
  app.post("/module/:key/generation/:id/rollback", async (c) => {
    const key = c.req.param("key");
    if (!isModule(key)) return c.json({ error: "bad module" }, 400);
    const id = c.req.param("id");
    if (!SAFE_ID.test(id)) return c.json({ error: "bad id" }, 400);
    return mutate(c, ["module", key, "generation", "rollback", id]);
  });

  // ── Session-git (the invisible zz/session-* branch) — CLI-only, no
  // file-read fallback: branch state lives in git, only the CLI computes it.

  app.get("/session", async (c) => {
    const viaCli = await runZuzuu(root, ["session", "status"], { binary: opts.binary });
    if (viaCli) return c.json(viaCli);
    return c.json({ enabled: false, cliAbsent: true });
  });

  app.post("/session/merge", (c) => mutate(c, ["session", "merge"]));
  app.post("/session/continue", (c) => mutate(c, ["session", "continue"]));
  // --yes rides server-side: the SPA's confirm dialog is the human gate
  app.post("/session/discard", (c) => mutate(c, ["session", "discard", "--yes"]));

  app.get("/hosts", async (c) => {
    const data = await runZuzuu(root, ["status"], { binary: opts.binary });
    const hosts = (data as { hosts?: { name: string }[] } | null)?.hosts ?? [];
    return c.json({ hosts, cliAbsent: data === null });
  });

  return app;
}
