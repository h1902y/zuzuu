// src/shared/zuzuu.ts — the zuzuu modules-dashboard contract (/api/zuzuu/*).
//
// The Project surface the workbench renders: modules, items, proposals, per-module
// generations, the agent-exit session-git auto-merge, and the human-gated
// mutations (always shelled through the `zz` CLI on the server).
//
// PRUNED from the v1 protocol (2026-06-22 — these features are gone from the v2
// CLI/workbench, so their DTOs were dead weight): the OTLP trace views, whole-
// Project checkpoints (generations are per-module), `eval`/`inbox` (never v2
// verbs), and the read-only session list / session-diff / hosts / health / status
// views (the panel renders overview + per-module detail only).

/** One Module-Standard envelope item (one .md: strict frontmatter + prose body).
 *  The daemon passes the CLI's parsed envelope through whole; CLI-absent degrades
 *  to a frontmatter peek (id/kind/title/status survive; body/payload may not). */
export interface ModuleItem {
  id: string;
  module: string;
  /** per-module kinds: fact|entity|command|… · episode · runbook|script · steering|amendment · rule */
  kind: string;
  title: string;
  /** active | archived */
  status?: string;
  created_at?: string;
  updated_at?: string;
  provenance?: Record<string, string>[];
  payload?: Record<string, unknown>;
  body?: string;
}

/** An envelope file the CLI could not parse (fail-soft listing). */
export interface ModuleItemError {
  file: string;
  error: string;
}

export interface ProposalSummary {
  id: string;
  module: string;
  title: string;
  /** a short preview of the content being approved — best-effort */
  preview?: string;
  /** the persisted confidence bucket (high|med|low), when present */
  confidence?: string | null;
}

export interface ModuleDetail {
  key: string;
  items: ModuleItem[];
  proposals: ProposalSummary[];
  errors?: ModuleItemError[];
  /** true = zuzuu CLI absent; items are a best-effort frontmatter peek */
  degraded?: boolean;
}

export interface GenerationSummary {
  id: string;
  mintedAt: string | null;
  mintedFrom: string[];
}

/** GET /module/:key/generations — ONE module's lineage + active (generations are
 *  per-module atoms). */
export interface ModuleGenerationList {
  module: string;
  active: string | null;
  generations: GenerationSummary[];
}

// ── Module overview (ONE call for the whole panel root) ───────────────────────

/** One module in GET /overview. The peek fallback (CLI absent) omits
 *  tagline/kinds — counts and top survive. The manifest `ui` block (icon/accent/
 *  teaching) rides through untyped; the workbench renders from id/title/counts. */
export interface ModuleOverviewEntry {
  id: string;
  title: string;
  tagline?: string;
  ui?: { icon?: string; accent?: string; teaching?: string };
  kinds?: string[];
  declarative?: boolean;
  counts: { items: number; pending: number; errors: number };
  /** up to 3 top item titles */
  top: string[];
  /** enabled (default true; toggled via zuzuu module enable/disable) */
  enabled?: boolean;
}

export interface ModuleOverviewResponse {
  modules: ModuleOverviewEntry[];
  /** true = zuzuu CLI absent; counts come from a frontmatter peek */
  degraded?: boolean;
}

// ── Write side (mutations are CLI-only; the daemon shells out to `zz`) ─────────

/** POST /proposals/:id/approve and /actions/:slug/approve */
export interface ApproveResult {
  ok: boolean;
  action?: string;
  itemIds?: string[];
  warnings?: string[];
}

/** POST /proposals/:id/reject and /actions/:slug/reject */
export interface RejectResult {
  ok: boolean;
  id?: string;
}

/** POST /module/:key/generation/:id/rollback — restore ONE module by content. */
export interface RollbackResult {
  ok: boolean;
  module?: string;
  restored: number;
  active: string;
}

// ── Session-git (the invisible session branch: agent session = zz/session-*) ──

/** `zuzuu session merge --json` (also the agent-exit auto-merge). */
export interface SessionMergeResult {
  ok: boolean;
  /** squash commit sha, or null when the session had no changes */
  mergedAs?: string | null;
  /** branch the squash landed on */
  mergedTo?: string;
  commits?: number;
  branch?: string;
  conflict?: boolean;
  /** e.g. 'no-session-branch' | 'empty-squash-with-checkpoints' */
  reason?: string;
  warning?: string;
  restoredTo?: string | null;
}

/** Stored on a daemon session after the agent-exit auto-merge ran; read via
 *  GET /api/sessions/:id. */
export type SessionCloseResult =
  | { cliAbsent: true }
  | { ok: true; merge: SessionMergeResult }
  | { ok: false; stderr?: string; refusal?: Record<string, unknown> };
