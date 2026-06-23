// src/server/zuzuu-peek.ts — one job: the shared substrate for the /api/zuzuu
// routes. The CLI-ABSENT frontmatter PEEK (so the dashboard still renders without
// the zz binary), the proposal shaping the read side needs, and the id/slug guards
// both halves use. The CLI is the parser of record (`zuzuu module items …`); this
// is the degraded fallback only — never a re-implementation of the envelope grammar.

import fsp from "node:fs/promises";
import path from "node:path";
import { runZuzuu } from "./zuzuu-cli.js";

/** The five built-in module slugs — used ONLY for the CLI-absent degraded fallback
 *  (peek enumerates the home dirs for the known built-ins). N-module routing is
 *  slug-validated, not allowlist-gated. */
export const BUILTIN_MODULES = ["knowledge", "memory", "actions", "instructions", "guardrails"] as const;

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
export async function peekModuleItems(agent: string, key: string): Promise<Record<string, string>[]> {
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

export interface EnvelopeListing {
  items: unknown[];
  errors: { file: string; error: string }[];
  degraded: boolean;
}

/** One module's envelope items: CLI first (full envelopes), peek fallback. */
export async function moduleEnvelopeItems(root: string, agent: string, key: string, binary?: string): Promise<EnvelopeListing> {
  const viaCli = await runZuzuu(root, ["module", "items", key], { binary }) as
    { items?: unknown[]; errors?: { file: string; error: string }[] } | null;
  if (viaCli && Array.isArray(viaCli.items))
    return { items: viaCli.items, errors: Array.isArray(viaCli.errors) ? viaCli.errors : [], degraded: false };
  return { items: await peekModuleItems(agent, key), errors: [], degraded: true };
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

// ── proposal shaping (the read side's ProposalSummary) ──────────────────

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
 *  the title, a payload preview (the WHAT block), and the persisted confidence. */
export function proposalSummary(p: Record<string, unknown>, key: string) {
  const preview = proposalPreview(p);
  const score = p.score as { confidence?: string } | undefined;
  return {
    id: String(p.id ?? "?"),
    module: key,
    title: proposalTitle(p),
    ...(preview ? { preview } : {}),
    ...(score?.confidence ? { confidence: score.confidence } : {}),
  };
}
