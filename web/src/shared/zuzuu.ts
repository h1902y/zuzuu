// src/shared/zuzuu.ts — the zuzuu modules-dashboard contract (/api/zuzuu/*).
//
// The brain surface the workbench renders: modules, items, proposals, per-module
// generations, the invisible session-git branch, "what a session changed", and
// the human-gated mutations (always shelled through the `zz` CLI on the server).
//
// PRUNED from the v1 protocol (2026-06-22 — these features are gone from the v2
// CLI, so their DTOs were dead weight): the OTLP trace views (session
// inspect/trace/tree/content + trace-linked file authors — the trace layer was
// dropped), whole-brain checkpoints (cut; generations are per-module), and
// `eval`/`inbox` (never v2 verbs). The "Changes" view survives via git, not the
// trace.

/** A module key is any slug ("knowledge", "memory", a user-composed "todo", …).
 *  The five built-ins are just seed templates. */
export type ModuleKey = string;

/** The five built-in module keys (seed templates; kept for fallback metadata). */
export const BUILTIN_MODULE_KEYS = ["knowledge", "memory", "actions", "instructions", "guardrails"] as const;

export interface ZuzuuHealth {
  home: boolean;
  zuzuuBin: boolean;
}

export interface ZuzuuStatus {
  home: boolean;
  /** per-module active generation ids: { knowledge: "gen_006" | null, … } */
  generations: Record<string, string | null>;
  pending: Record<string, number>;
  drift: { dirty: boolean; items: unknown[] };
}

export interface ModuleSummary {
  key: ModuleKey;
  count: number;
  pending: number;
}

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

/** GET /module/:key/schema — the module's payload schema (JSON-Schema subset),
 *  falling back to the seeded .zuzuu/<module>/schema.json when the CLI is absent. */
export interface ModuleSchema {
  key: string;
  schema: unknown;
  source: "cli" | "home" | "absent";
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

/** GET /module/:key/generation/:id — that generation's diff vs its parent. */
export interface ModuleGenerationDiff {
  id: string;
  module: string;
  forkedFrom: string | null;
  against: string | null;
  mintedFrom: string[];
  mintedAt: string | null;
  added: string[];
  changed: string[];
  removed: string[];
}

// ── Module overview (ONE call for the whole panel root) ───────────────────────

/** The manifest `ui` block — the card descriptor the workbench renders from (no
 *  per-module frontend code needed for a new module). */
export interface ModuleUiDescriptor {
  /** icon name (book | clock | play | compass | shield | …) */
  icon: string;
  /** accent name (info | neutral | success | warning | danger) */
  accent: string;
  /** the ONE teaching sentence for empty states */
  teaching: string;
}

/** One module in GET /overview. The peek fallback (CLI absent) omits
 *  ui/tagline/kinds — counts and top survive. */
export interface ModuleOverviewEntry {
  id: string;
  title: string;
  tagline?: string;
  ui?: ModuleUiDescriptor;
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

// ── Sessions list + labels ────────────────────────────────────────────────────

/** Session lifecycle states; post-hoc = captured. */
export type ZuzuuSessionState =
  | "opening" | "active" | "completed" | "abandoned" | "crashed" | "captured";

/** One recorded session. The fallback (CLI absent) may lack the state label and
 *  derived fields — id/host survive. */
export interface ZuzuuSessionEntry {
  id: string;
  host?: string;
  state?: ZuzuuSessionState | string;
  startedAt?: string | null;
  endedAt?: string | null;
  durationMs?: number;
  counts?: { turns: number; tools: number; errors: number };
  generation?: string | null;
  git?: { commit: string | null; branch: string | null };
  /** daemon PTY runtime id when the session ran in the workbench; absent for CLI
   *  / non-workbench sessions. Backward-tolerant: older records omit it. */
  ptyId?: string;
  /** a user-given name (set via `session label`); absent when unnamed. */
  label?: string;
}

export interface SessionsResponse { sessions: ZuzuuSessionEntry[] }

/** POST /session-label/:id — `zuzuu session label <id> --text <label> --json`. */
export interface SessionLabelResponse {
  sessionId: string;
  label: string | null;
}

export interface DigestResponse { text: string }

/** GET /hosts — from `zuzuu status`; cliAbsent means the CLI wasn't runnable. */
export interface HostsResponse {
  hosts: { name: string }[];
  cliAbsent: boolean;
}

// ── "What a session changed" — git-derived, not trace-derived ─────────────────

/** One changed file in a session's diff. `status` is the git letter
 *  (A added · M modified · D deleted · R renamed · C copied). */
export interface SessionDiffFile {
  path: string;
  status: string;
  additions: number;
  deletions: number;
}

/** GET /session-diff/:id — resolved from the session's git branch (live) or merge
 *  commit (past). Fail-soft: unresolvable → available:false, files []. */
export interface SessionDiffResponse {
  sessionId: string;
  available: boolean;
  base?: string;
  tip?: string;
  totals: { files: number; additions: number; deletions: number };
  files: SessionDiffFile[];
}

/** GET /session-file-diff/:id?path=… — the unified diff text for ONE file (size-capped). */
export interface SessionFileDiffResponse {
  sessionId: string;
  path: string;
  diff: string;
  truncated?: boolean;
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

export interface SessionGitActive {
  branch: string;
  checkpoints: number;
  dirty: boolean;
  /** checkpoints exist but the tree equals main (exploration-only session) */
  noNetChanges: boolean;
}

/** GET /api/zuzuu/session — `zuzuu session status --json`; cliAbsent:true when
 *  the zuzuu CLI wasn't runnable. */
export interface SessionGitStatus {
  enabled: boolean;
  mainBranch?: string | null;
  active?: SessionGitActive | null;
  onSessionBranch?: boolean;
  cliAbsent?: boolean;
}

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
