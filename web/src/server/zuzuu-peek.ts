// src/server/zuzuu-peek.ts — one job: the shared substrate for the /api/zuzuu
// routes. The CLI-ABSENT frontmatter PEEK (so the dashboard still renders without
// the zz binary), the proposal shaping the read side needs, and the id/slug guards
// both halves use. The CLI is the parser of record (`zuzuu module items …`); this
// is the degraded fallback only — never a re-implementation of the envelope grammar.

import fsp from "node:fs/promises";
import path from "node:path";
import { runZuzuu } from "./zuzuu-cli.js";

/** Enumerate the ACTUAL module dirs on disk for the CLI-absent degraded fallback:
 *  non-dot subdirs of `.zuzuu` that hold a `module.md` (mirrors src/notes/module.mjs
 *  listModules). No prebuilt content modules — an empty Project has only instructions,
 *  so a fresh repo degrades to an empty/instructions-only dashboard, not five empty tiles.
 *  N-module routing is slug-validated, not allowlist-gated. */
export async function listModuleDirs(home: string): Promise<string[]> {
  let entries: import("node:fs").Dirent[];
  try { entries = await fsp.readdir(home, { withFileTypes: true }); } catch { return []; }
  const dirs: string[] = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith(".")) continue;
    try { await fsp.access(path.join(home, e.name, "module.md")); dirs.push(e.name); }
    catch { /* a dir without a module.md is not a module */ }
  }
  return dirs.sort();
}

/** Ids/slugs/generation-ids that may ride into a zuzuu argv. Validated BEFORE any spawn. */
export const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/i;
/** A safe module slug: lowercase alphanumeric start, then alphanumeric/underscore/hyphen. */
export const SAFE_SLUG = /^[a-z0-9][a-z0-9_-]*$/;
export const MAX_REASON_LEN = 500;

// ── CLI-absent envelope peek ────────────────────────────────────────────
// The CLI is the parser of record (`zuzuu module items <f> --json` returns the
// full envelopes incl. payload/body). When it's absent we degrade to a count-only
// frontmatter PEEK: read the items dir, lift the tiny top-level scalar lines
// (title:/status:/kind:) best-effort — counts still render, detail degrades.

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
export function peekFrontmatter(text: string): Record<string, string> {
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
export async function peekModuleItems(home: string, key: string): Promise<Record<string, string>[]> {
  const files: { id: string; file: string }[] = [];
  if (key === "actions") {
    const base = path.join(home, "actions");
    let names: string[] = [];
    try { names = (await fsp.readdir(base)).sort(); } catch { return []; }
    for (const n of names) {
      if (n === "inbox" || n === "staged" || n === "_rolledback") continue;
      files.push({ id: n, file: path.join(base, n, "ACTION.md") });
    }
  } else {
    const rel = ITEM_DIRS[key];
    if (!rel) return [];
    const dir = path.join(home, ...rel);
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

export interface EnvelopeListing {
  items: unknown[];
  errors: { file: string; error: string }[];
  degraded: boolean;
}

/** One module's envelope items: CLI first (full envelopes), peek fallback. */
export async function moduleEnvelopeItems(root: string, home: string, key: string, binary?: string): Promise<EnvelopeListing> {
  const viaCli = await runZuzuu(root, ["module", "items", key], { binary }) as
    { items?: unknown[]; errors?: { file: string; error: string }[] } | null;
  if (viaCli && Array.isArray(viaCli.items))
    return { items: viaCli.items, errors: Array.isArray(viaCli.errors) ? viaCli.errors : [], degraded: false };
  return { items: await peekModuleItems(home, key), errors: [], degraded: true };
}

/** Read every *.json in a dir into objects; missing dir → [], corrupt file → skipped. */
export async function readJsonDir(dir: string): Promise<Record<string, unknown>[]> {
  let names: string[] = [];
  try { names = (await fsp.readdir(dir)).filter((n) => n.endsWith(".json")); } catch { return []; }
  const out: Record<string, unknown>[] = [];
  for (const n of names) {
    try { out.push(JSON.parse(await fsp.readFile(path.join(dir, n), "utf8"))); } catch { /* skip corrupt */ }
  }
  return out;
}

// ── proposal shaping (the read side's StagedSummary) ──────────────────

const firstLine = (s: unknown, n = 80) => (String(s ?? "").split("\n")[0] ?? "").slice(0, n);

/** The staged change body: observe writes it under `change` (the note that lands on
 *  approve). `candidate`/`payload` are legacy/inbox shapes kept as fallbacks so a
 *  differently-shaped record still degrades gracefully — never re-implemented. */
function changeBody(p: Record<string, unknown>): Record<string, unknown> | undefined {
  return (p.change ?? p.payload ?? p.candidate) as Record<string, unknown> | undefined;
}

/** A proposal's best-effort one-line title: the staged change's `title`, then its
 *  body's first line, then the rationale, and only as a last resort the id. */
function stagedTitle(p: Record<string, unknown>): string {
  const change = changeBody(p);
  const title = change?.title;
  if (typeof title === "string" && title) return firstLine(title);
  if (typeof change?.body === "string" && change.body) return firstLine(change.body);
  if (typeof p.rationale === "string" && p.rationale) return firstLine(p.rationale);
  return firstLine(p.id);
}

/** A short preview of the actual content being approved — the WHAT block in the
 *  review/detail card. Knowledge → the body's first lines; a guardrail rule →
 *  pattern → action; an action → its run/exec command. Best-effort, never throws. */
function stagedPreview(p: Record<string, unknown>): string {
  const change = changeBody(p);
  if (!change) return "";
  const attrs = change.attributes as Record<string, unknown> | undefined;
  // guardrail rule: pattern → action
  const pattern = change.pattern ?? attrs?.pattern;
  const action = change.action ?? attrs?.action;
  if (typeof pattern === "string" && pattern) {
    return typeof action === "string" && action ? `${pattern} → ${action}` : String(pattern);
  }
  // action: the run/exec line
  const run = change.run ?? change.exec ?? attrs?.exec;
  if (typeof run === "string" && run) return run;
  // default: the body's first ~3 lines
  const body = change.body;
  if (typeof body === "string" && body) {
    return body.split("\n").slice(0, 3).join("\n").slice(0, 400);
  }
  return "";
}

/** Enrich a raw on-disk proposal into the StagedSummary the panel renders — the
 *  title, the change preview (the WHAT block), the rationale + evidence (the WHY,
 *  feeding the reason line), the op + change (the diff source), and the persisted
 *  confidence (top-level `p.confidence` — null today; NEVER faked from `score`,
 *  which is a number). */
export function stagedSummary(p: Record<string, unknown>, key: string): import("#shared/index.js").StagedSummary {
  const preview = stagedPreview(p);
  const change = changeBody(p);
  const evidence = Array.isArray(p.evidence) ? (p.evidence as import("#shared/index.js").StagedEvidence[]) : undefined;
  const confidence = typeof p.confidence === "string" ? p.confidence : null;
  // Provenance (U6 / R6): observe persists `source` on the staged record (U4); carry
  // it through so the card can name the session(s) the proposal was born from.
  const source = p.source && typeof p.source === "object" && !Array.isArray(p.source)
    ? (p.source as import("#shared/index.js").ProvenanceSource) : undefined;
  return {
    id: String(p.id ?? "?"),
    module: key,
    title: stagedTitle(p),
    ...(typeof p.op === "string" ? { op: p.op } : {}),
    ...(typeof p.target === "string" ? { target: p.target } : {}),
    ...(preview ? { preview } : {}),
    ...(typeof p.rationale === "string" && p.rationale ? { rationale: p.rationale } : {}),
    ...(evidence ? { evidence } : {}),
    ...(change ? { change } : {}),
    ...(source ? { source } : {}),
    confidence,
  };
}
