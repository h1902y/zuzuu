// src/shared/zuzuu.ts — the zuzuu modules-dashboard contract (/api/zuzuu/*).
//
// The Project surface the workbench renders: modules, items, staged, per-module
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
  /** where this note was born — the session(s) it was mined from (U6 / R6). Present
   *  only on a mined note that landed after U4 carried provenance through evolve. */
  source?: ProvenanceSource;
}

/** An envelope file the CLI could not parse (fail-soft listing). */
export interface ModuleItemError {
  file: string;
  error: string;
}

/** A provenance pointer (U6 / R6): where a note/proposal was BORN — the session(s)
 *  observe mined it from. `sessions` are host-prefixed transcript session ids (e.g.
 *  `claude-code:abc`), NOT daemon PTY ids. The locator is session-ids-only today
 *  (no finer transcript offset is resolvable — see R-B); `locator.kind` leaves room
 *  for a richer offset later. Absent/null when a note wasn't mined (hand-authored,
 *  pre-U4, or a producer that omits it). */
export interface ProvenanceSource {
  /** what produced it — "observe" today. */
  producer?: string;
  /** the ROUTE kind it was mined as (command | entity | fact | guardrail | …). */
  kind?: string;
  /** the originating session ids (host-prefixed). */
  sessions?: string[];
  locator?: { kind?: string; sessions?: string[]; [k: string]: unknown };
  [k: string]: unknown;
}

/** One piece of corroborating evidence behind a mined proposal — the array observe
 *  writes (`evidence: [{ kind, occurrences, sessions, … }]`). The session count is
 *  what the reason line counts; extra keys (failures, …) ride through untyped. */
export interface StagedEvidence {
  /** the ROUTE kind: command | entity | fact | guardrail | correction | workflow */
  kind?: string;
  occurrences?: number;
  /** distinct sessions the signal corroborated across (a count today; see U4) */
  sessions?: number;
  [k: string]: unknown;
}

export interface StagedSummary {
  id: string;
  module: string;
  title: string;
  /** create | update | delete | relate | deprecate — the staged op. */
  op?: string;
  /** the note id this change targets (for an update: the current note whose body is
   *  the diff's "before"; null/absent for a create). */
  target?: string | null;
  /** a short preview of the content being approved — best-effort */
  preview?: string;
  /** why this was proposed (observe writes the candidate body here). */
  rationale?: string;
  /** the corroborating evidence behind the proposal — feeds the reason line. */
  evidence?: StagedEvidence[];
  /** the staged change body (the note that lands on approve: type/title/body/…). */
  change?: Record<string, unknown>;
  /** the persisted confidence bucket, when a producer sets it (null today — never
   *  faked from `score`, which is a number). */
  confidence?: string | null;
  /** where this proposal was born — the session(s) observe mined it from (U6 / R6).
   *  Feeds the card's "born from N session(s)" line and the session↔proposal cross-ref. */
  source?: ProvenanceSource;
}

export interface ModuleDetail {
  key: string;
  items: ModuleItem[];
  /** the PRE-paginate match count (the index COUNT over the same filter) — `items` is
   *  one page of it. The client paginates off this; absent ⇒ fall back to items.length. */
  total?: number;
  staged: StagedSummary[];
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

/** GET /module/:key/schema — the module's declared typed-column schema. `schema` is
 *  the CLI's `{ key, fields:[{name,type}] }` (source "cli") or the seeded home
 *  schema.json (source "home") or null (absent); the client reads it tolerantly. */
export interface ModuleSchema {
  key: string;
  schema: unknown;
  source?: string;
}

/** One note-level change between two of a module's generations — git's own
 *  `--name-status` letter (A add · M modify · D delete · R… rename) + the note id
 *  (the `.md` suffix stripped). */
export interface GenerationChange {
  status: string;
  id: string;
}

/** GET /module/:key/generation/:from/diff/:to — the §G.2 generation strip's
 *  "what changed" panel: `zz gen diff <m> <a> <b>` (git holds the bytes; this
 *  never re-derives them). `degraded` = the CLI produced nothing (absent, or
 *  `from` has no backing commit — the module's very first generation has no
 *  "before" to diff against). */
export interface GenerationDiffResult {
  module: string;
  from: string;
  to: string;
  changes: GenerationChange[];
  degraded?: boolean;
}

// ── A note's history (§G.1) — the module's mutation log, filtered to one note ──

/** One line of a module's log.jsonl (src/notes/log.mjs's `append`/`logMutation`).
 *  `event` is the mutation kind (create|update|delete|deprecate); `ts` is ISO or
 *  null (most mutation-log entries are honestly null today — nothing in the write
 *  path stamps one yet, see log.mjs); `actor` names who did it (human|agent|
 *  migration|ingestion are the substrate's named buckets — `agent` never lands in
 *  practice since the moat refuses a non-operator commit, and migration/ingestion
 *  are designed-not-yet-wired per §I.2 — anything else, e.g. `init`'s seed writes,
 *  rides through as its raw string, never relabeled). Everything past the four
 *  known keys is a per-op breadcrumb (`proposal`, `backfill`, `rename`, `merge`,
 *  `refactor`, `rollback`, `relation`, …) — read tolerantly, never enumerated. */
export interface HistoryEntry {
  event: string;
  ts: string | null;
  note: string;
  actor?: string;
  [k: string]: unknown;
}

/** GET /module/:key/item/:id/history — one note's mutation trail: the module's
 *  log.jsonl filtered to `note === id`, newest first, capped 50. `bornAt` is the
 *  earliest `create` entry (the footer's "born here" line links to it); null when
 *  the note predates the log (a legacy note, or the log itself is absent). */
export interface NoteHistoryResponse {
  key: string;
  id: string;
  entries: HistoryEntry[];
  bornAt: HistoryEntry | null;
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

/** DELETE /module/:key/row/:id — the OPERATOR lane's instant row delete (P1:
 *  `zz note delete`, lands NOW, no gate; distinct from POST .../stage's
 *  op:"delete", which is the agent-lane proposal twin). */
export interface DeleteRowResult {
  ok: boolean;
  deleted?: string;
}

/** POST /staged/:id/approve and /actions/:slug/approve */
export interface ApproveResult {
  ok: boolean;
  action?: string;
  itemIds?: string[];
  warnings?: string[];
}

/** POST /staged/:id/reject and /actions/:slug/reject */
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

/** POST /module/:key/column and PATCH /module/:key/column/:name (§H.5, the
 *  field-config panel) — the CLI's `module add-column`/`alter-column` JSON, passed
 *  through whole: the module's fields AFTER the change + the generation it minted
 *  (rollback-able). `fields` rides untyped here (raw FieldDef-shaped objects) —
 *  the client re-derives typed FieldDef[] via schema-fields.ts, same as the
 *  GET .../schema route's `fields` block. */
export interface ModuleColumnResult {
  key: string;
  fields: Record<string, unknown>[];
  generation: number;
}

/** POST /module/:key/stage — the write entry-door. A create/update resolves to a
 *  PENDING proposal (a staged change), NOT a landed row: it surfaces in the review
 *  queue and lands only on approve. The handle the DataProvider returns from a write. */
export interface StagedChange {
  id: string;
  op: "create" | "update" | "delete" | "relate" | "unrelate" | "deprecate";
  module: string;
  target: string | null;
  status: "pending";
  score: number;
  /** true = an identical change was already staged (content-hash dedup — idempotent) */
  duplicate?: boolean;
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

// ── The held-session merge gate (the CODE queue, mirroring the brain queue) ───

/** One session awaiting a merge decision — GET /api/zuzuu/held (shells `zz session
 *  status --json` → its `held[]`). The code-gate queue: each held branch with its
 *  pure-read review (U4 — diff summary + mergeability). `id` is the session id the
 *  merge/discard actions take, derived from the branch namespace: `zz/session-<id>`
 *  (worktree-backed — the workbench's agents) vs `zz/held-<id>` (in-place fallback). */
export interface HeldSession {
  id: string;
  branch: string;
  /** worktree = a `zz/session-<id>` worktree-backed hold (merge via `worktree close`);
   *  inplace = a `zz/held-<id>` in-place hold (merge via `session merge`). */
  kind: "worktree" | "inplace";
  checkpoints: number;
  files: number;
  added: number;
  removed: number;
  mergeability: "ready" | "conflict" | "unknown";
  /** workspace-relative path of the worktree holding this branch (U8 / R9) —
   *  present only for a `worktree`-kind hold git reports a worktree for. It lets a
   *  `conflict` route to resolution: the workbench opens a shell session AT the
   *  worktree (cwd) so the user can fix the merge in place, then `zz session merge`.
   *  Undefined for in-place holds (no worktree) or when the dir can't be expressed
   *  safely under root (then the conflict routes to the CLI instruction instead). */
  worktreePath?: string;
}

export interface HeldSessionList {
  held: HeldSession[];
}

/** The result of a held-session merge/discard action (POST /api/sessions/held/:id/*).
 *  The daemon shells the `zz` verb and passes its JSON through; shape varies by verb
 *  (a merge carries `mergedAs`/`commits`, a discard `branch`), so it's read tolerantly. */
export type HeldActionResult = { ok?: boolean } & Record<string, unknown>;

/** Stored on a daemon session after the agent-exit close hook ran; read via
 *  GET /api/sessions/:id. `pending` is the count of staged proposals AFTER the
 *  close-time `zz observe` ran (U5/KTD5) — the signal the "what this session
 *  taught" close card keys off (`pending > 0` → fire once). Present only on a
 *  success arm (the close hook ran → observe ran → the count is meaningful);
 *  absent when the CLI was absent or the close failed.
 *
 *  U3: END now FINALIZES (holds) — the daemon shells `zz session worktree finalize`
 *  on PTY exit, so the live arm is the `held` variant (`branch` = the held
 *  `zz/session-*` branch). The squash-merge moved behind the explicit `zz session
 *  merge` verb (U6 enriches this with the diff summary + mergeability). The `merge`
 *  variant stays for the explicit-merge path. */
export type SessionCloseResult =
  | { cliAbsent: true }
  | { ok: true; merge: SessionMergeResult; pending?: number }
  | {
      ok: true;
      held: true;
      branch: string;
      pending?: number;
      /** U4: the pure-read review of the held branch (`zz session review`) — the
       *  data the merge card needs. Optional here: U4 ships the CLI read + the
       *  type; U6 wires the daemon to populate it on the close hook. */
      diffSummary?: { files: number; added: number; removed: number; checkpoints: number };
      /** mergeability of the held branch vs current `main`, computed at read time
       *  via the pure-read `git merge-tree --write-tree` probe. 'unknown' = git
       *  < 2.38 or an un-probeable state. */
      mergeability?: "ready" | "conflict" | "unknown";
    }
  | { ok: false; stderr?: string; refusal?: Record<string, unknown> };

// ── The world map (/api/zuzuu/graph → `zz graph --json`) ──────────────────────
// The whole project as one nodes+links document. ADDR-keyed (`module:id`) — bare
// ids collide across modules. Rendered by the client world engine (client/world).

export interface WorldGraphNode {
  addr: string;
  id: string;
  module: string;
  type: string;
  title: string;
  status: string | null;
  degree: number;
  ageDays: number | null;
  bytes: number;
  hasBody: boolean;
  /** the `--props` allowlist columns, when requested (peek values, truncated) */
  props?: Record<string, string>;
}

export interface WorldGraphLink {
  source: string;
  target: string;
  type: string;
  note?: string;
}

export interface WorldGraph {
  nodes: WorldGraphNode[];
  links: WorldGraphLink[];
  /** true = zuzuu CLI absent; the map degrades to empty */
  degraded?: boolean;
}

/** A pending create proposal rendered IN the map (the moat made visible): a dashed
 *  translucent node near its module until the human approves and it solidifies. */
export interface WorldGhost {
  addr: string;
  module: string;
  stagedId: string;
  title: string;
}

// ── The Flow projection (/api/zuzuu/flow) — §I rung 5: the third view of a
// Project. Every `type: workflow` note project-wide, joined with its runs (the
// `runs` module) for a run-count/latest-status summary — the data the header
// toggle's availability check and the workflow picker both need in one read. ──

/** One workflow note's run tally, by the `runs` module's `status` field. */
export interface FlowRunCounts {
  total: number;
  running: number;
  waiting: number;
  done: number;
  failed: number;
}

export interface FlowLatestRun {
  id: string;
  status: string;
  startedAt: string | null;
}

/** One `type: workflow` note, summarized for the Flow picker + the toggle's
 *  availability check. `addr` is `module:id` (the Flow NavNode's target). */
export interface FlowWorkflowSummary {
  addr: string;
  module: string;
  id: string;
  title: string;
  stepCount: number;
  runs: FlowRunCounts;
  latestRun: FlowLatestRun | null;
}

/** GET /api/zuzuu/flow — every workflow note project-wide + its run summary.
 *  `degraded: true` = the CLI is absent (the workflow list read failed); the
 *  toggle then reads "unavailable" rather than falsely "no workflows yet." */
export interface FlowListResponse {
  workflows: FlowWorkflowSummary[];
  degraded?: boolean;
}
