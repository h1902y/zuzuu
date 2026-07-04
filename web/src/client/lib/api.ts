// src/client/lib/api.ts — the typed REST client over the daemon.
//
// One thin `request` wrapper + a flat `api` object; every shape comes from
// #shared so the client and server can't drift. Surface: workspace · sessions ·
// fs · search + the modules dashboard (`zuzuu.*`).

import type {
  ApproveResult,
  CreateSessionRequest,
  DeleteRowResult,
  DirListing,
  FileListResponse,
  FlowListResponse,
  GenerationDiffResult,
  HeldActionResult,
  HeldSessionList,
  ListResponse,
  ModuleColumnResult,
  ModuleDetail,
  ModuleGenerationList,
  ModuleItem,
  ModuleOverviewResponse,
  ModuleSchema,
  NoteHistoryResponse,
  ProjectState,
  ProjectsList,
  RecentsList,
  RejectResult,
  RollbackResult,
  SearchResponse,
  SessionCloseResult,
  SessionDetail,
  SessionInfo,
  StagedChange,
  WorkspaceInfo,
  WorldGraph,
} from "#shared/index.js";

/** A setup verb's response — the CLI JSON the daemon passes through (shape varies). */
type SetupResult = { ok?: boolean } & Record<string, unknown>;

/** POST /module/:key/row's response — the CLI's `note create` result passed
 *  straight through (`{ok:true, addr:"module:id"}`, src/cli/verbs/data.mjs).
 *  Not in #shared: like SetupResult above, a thin pass-through the client
 *  only reads `ok`/`addr` off of, not a shape the server independently
 *  constructs a DTO for. */
type CreateRowResult = { ok: boolean; addr?: string };

/** The server-side module-list query (Rung 7): filter·sort·paginate the daemon pushes
 *  to the index. `type` is the note kind, `where` are repeatable `key=val` EAV filters,
 *  `sort` is `col[:desc]`. All optional — an empty query lists the module unfiltered. */
export interface ModuleQuery {
  text?: string; type?: string; status?: string; tag?: string;
  sort?: string; where?: string[]; limit?: number; offset?: number;
}

/** ModuleQuery → a `?...` querystring (omitting empty axes; `where` repeats). */
function moduleQs(q?: ModuleQuery): string {
  if (!q) return "";
  const p = new URLSearchParams();
  if (q.text) p.set("text", q.text);
  if (q.type) p.set("type", q.type);
  if (q.status) p.set("status", q.status);
  if (q.tag) p.set("tag", q.tag);
  if (q.sort) p.set("sort", q.sort);
  for (const w of q.where ?? []) p.append("where", w);
  if (q.limit != null) p.set("limit", String(q.limit));
  if (q.offset != null) p.set("offset", String(q.offset));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** The most PRECISE reason in a failed mutation's body (audit item 4). A 502 from
 *  the daemon carries `{error: "zuzuu command failed", stderr, data}` where `data`
 *  is the CLI's structured refusal (`{ok:false, error: "field 'company' is
 *  required"}`) — that inner reason is what the user can act on; the generic
 *  wrapper is what they used to get. Exported for tests. */
export function apiErrorMessage(status: number, body: unknown): string {
  const b = body as { error?: unknown; stderr?: unknown; data?: unknown } | null;
  const inner = (b?.data as { error?: unknown } | undefined)?.error;
  if (typeof inner === "string" && inner.trim()) return inner.trim();
  if (typeof b?.stderr === "string" && b.stderr.trim()) return b.stderr.trim().split("\n").at(-1)!;
  if (typeof b?.error === "string" && b.error.trim()) return b.error;
  return `request failed (${status})`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    if (res.status === 401) {
      throw new ApiError(401, "not authorized — open the URL printed by the zz-web daemon");
    }
    const body: unknown = await res.json().catch(() => null);
    throw new ApiError(res.status, apiErrorMessage(res.status, body));
  }
  return res.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const jsonMethod = (method: string, body: unknown): RequestInit => ({ ...json(body), method });

/** The field-config panel's Save body (§H.5) — one shape for both `+ column`
 *  (add: type required) and "Edit column" (alter: type optional, but the panel
 *  sends a full-snapshot save so it's present in practice too). Undefined keys
 *  are omitted client-side; on alter that means "leave unchanged". */
export interface ColumnFieldBody {
  type?: string;
  required?: boolean;
  options?: string[];
  default?: string;
  label?: string;
  description?: string;
  computed?: string;
}

export const api = {
  workspace: () => request<WorkspaceInfo>("/api/workspace"),
  // in-place re-root (the switcher; D1) — the daemon tears down sessions + rebuilds.
  switchWorkspace: (path: string) => request<{ ok: true; root: string }>("/api/workspace/switch", json({ path })),

  // the Project layer — switching (machine-global) + onboarding setup verbs.
  projects: {
    recents: () => request<RecentsList>("/api/projects/recents"),
    list: () => request<ProjectsList>("/api/projects/list"),
    dir: (prefix: string) => request<DirListing>(`/api/projects/dir?prefix=${encodeURIComponent(prefix)}`),
    // open the OS-native folder picker (local daemon) → the chosen absolute path.
    pick: () => request<{ path?: string; cancelled?: boolean; unsupported?: boolean; error?: string }>("/api/projects/pick"),
    // set (or clear, when emoji is "") a project's emoji override.
    setEmoji: (path: string, emoji: string) => request<{ ok: boolean }>("/api/projects/emoji", json({ path, emoji })),
  },
  setup: {
    // init/enable carry explicit consent (U3) — the daemon refuses them without it
    // (the explain-then-run contract; the caller POSTs only after the user affirms).
    init: () => request<SetupResult>("/api/zuzuu/setup/init", json({ consent: true })),
    enable: () => request<SetupResult>("/api/zuzuu/setup/enable", json({ consent: true })),
    observe: () => request<SetupResult>("/api/zuzuu/setup/observe", json({})),
    gitInit: () => request<SetupResult>("/api/zuzuu/setup/git-init", json({ confirm: true })),
  },

  // sessions
  listSessions: () => request<SessionInfo[]>("/api/sessions"),
  createSession: (body: CreateSessionRequest = {}) => request<SessionInfo>("/api/sessions", json(body)),
  // read one session, awaiting any pending agent-exit close hook — carries
  // `closeResult` (the auto-merge outcome + the post-close pending count, U5).
  sessionDetail: (id: string) => request<SessionDetail>(`/api/sessions/${id}`),
  // ending a session resolves only AFTER the daemon's squash-merge close hook
  // settles (agents) — the close result carries the merge + post-close pending count.
  closeSession: (id: string) =>
    request<{ ok: true; closeResult?: SessionCloseResult }>(`/api/sessions/${id}`, { method: "DELETE" }),
  // the CODE merge gate (U6): land or drop a held session by id. Merge squash-merges
  // the held branch onto main (serialized server-side); discard drops the branch +
  // checkpoints (the daemon shells the `--yes`-guarded verb).
  mergeHeld: (id: string) => request<HeldActionResult>(`/api/sessions/held/${id}/merge`, { method: "POST" }),
  discardHeld: (id: string) => request<HeldActionResult>(`/api/sessions/held/${id}/discard`, { method: "POST" }),

  // filesystem
  listDir: (path: string) => request<ListResponse>(`/api/fs/list?path=${encodeURIComponent(path)}`),
  readFile: async (path: string) => {
    const res = await fetch(`/api/fs/download?path=${encodeURIComponent(path)}&inline=1`);
    if (!res.ok) throw new ApiError(res.status, `failed to read (${res.status})`);
    return res.text();
  },
  writeFile: (path: string, content: string) => request<{ ok: true }>("/api/fs/write", json({ path, content })),
  listFiles: () => request<FileListResponse>("/api/files"),

  // search
  search: (q: string, opts: { path?: string; regex?: boolean; caseSensitive?: boolean } = {}) => {
    const qs = new URLSearchParams({ q });
    if (opts.path) qs.set("path", opts.path);
    if (opts.regex) qs.set("regex", "1");
    if (opts.caseSensitive) qs.set("case", "1");
    return request<SearchResponse>(`/api/search?${qs}`);
  },

  // the Project — the modules dashboard surface (/api/zuzuu/*). Mutations are
  // CLI-shelled by the daemon; the client only ever reads + posts intents.
  zuzuu: {
    overview: () => request<ModuleOverviewResponse>("/api/zuzuu/overview"),
    // the whole project as one nodes+links document (the world map reads this);
    // optional props ride chosen frontmatter columns on nodes
    graph: (props?: string[]) =>
      request<WorldGraph>(`/api/zuzuu/graph${props?.length ? `?props=${encodeURIComponent(props.join(","))}` : ""}`),
    projectState: () => request<ProjectState>("/api/zuzuu/project-state"),
    // the Flow projection's summary read (§I rung 5): every workflow note + its
    // run counts/latest-status — feeds the header toggle's availability check,
    // the `>flow` palette command, and the Flow stage's workflow picker.
    flow: () => request<FlowListResponse>("/api/zuzuu/flow"),
    // the held-session CODE queue — sessions awaiting a merge decision (the close
    // card's code section reads it). CLI absent / non-git → { held: [] }.
    held: () => request<HeldSessionList>("/api/zuzuu/held"),
    // the session-start readiness brief — `zz doctor` + `zz digest` as raw text
    // (either null when the CLI is absent), embedded in the agent's first turn.
    readiness: () => request<{ doctor: string | null; digest: string | null }>("/api/zuzuu/readiness"),
    // the module's notes — optionally filtered·sorted·paginated server-side (the index
    // SELECT). No query ⇒ the whole module (the default the graph/search/review reads use).
    module: (key: string, query?: ModuleQuery) => request<ModuleDetail>(`/api/zuzuu/module/${key}${moduleQs(query)}`),
    // the UNIFIED table (one table over everything): every module's rows, one page —
    // each row carries its module; the Everything grid renders module as a column
    items: (query?: ModuleQuery) => request<ModuleDetail>(`/api/zuzuu/items${moduleQs(query)}`),
    item: (key: string, id: string) => request<ModuleItem>(`/api/zuzuu/module/${key}/item/${id}`),
    // a note's history (§G.1): the module's mutation-log entries filtered to this
    // note, newest first — the NoteDocument's collapsed History group.
    history: (key: string, id: string) => request<NoteHistoryResponse>(`/api/zuzuu/module/${key}/item/${id}/history`),
    schema: (key: string) => request<ModuleSchema>(`/api/zuzuu/module/${key}/schema`),
    generations: (key: string) => request<ModuleGenerationList>(`/api/zuzuu/module/${key}/generations`),
    // §G.2 the generation strip's "what changed" panel: which notes were added/
    // modified/deleted between two of a module's generations. `degraded: true` =
    // nothing to diff against (e.g. `from` predates the module's first generation).
    generationDiff: (key: string, from: string, to: string) =>
      request<GenerationDiffResult>(`/api/zuzuu/module/${key}/generation/${from}/diff/${to}`),
    // a write resolves to a PENDING proposal (a staged change), not a landed row — it
    // surfaces in the review queue and lands only on approve (the gate, as data-provider
    // semantics). All 6 ops route here: create/update/delete/deprecate carry a `target`
    // note; relate/unrelate carry the edge in `change` ({from,type,to}) and need no target.
    stage: (key: string, body: { op: StagedChange["op"]; target?: string; change?: Record<string, unknown> }) =>
      request<StagedChange>(`/api/zuzuu/module/${key}/stage`, json(body)),
    // the OPERATOR lane's instant row delete (Two-Lanes.md: `zz note delete`,
    // lands NOW — distinct from `stage(...{op:"delete"})` above, the agent-lane
    // proposal twin). §H.3.4/S1: the omnibar's Selection→Delete loops this per row
    // (no batch route on the daemon yet — a one-batch-verb gap, noted not built).
    deleteRow: (key: string, id: string) =>
      request<DeleteRowResult>(`/api/zuzuu/module/${key}/row/${id}`, { method: "DELETE" }),
    // the OPERATOR lane's instant row CREATE (U5, live-views plan/KTD4): mints a
    // note directly (validated + provenance-logged by `zz note create`) — lands
    // NOW, no gate. Distinct from `stage(...{op:"create"})` above (the agent-lane
    // proposal twin the agent uses instead); the route is agent-denied
    // (`agentInvokable:false` on `note create`). `change` must carry its own
    // `type` key (the route has no separate --type param — see zuzuu-write.ts).
    createRow: (key: string, id: string, change: Record<string, unknown>) =>
      request<CreateRowResult>(`/api/zuzuu/module/${key}/row`, json({ id, change })),
    // the daemon route requires { module } in the body (it 400s without it) — the
    // mutation request body isn't in #shared, so this contract is enforced by hand.
    approve: (id: string, module: string) =>
      request<ApproveResult>(`/api/zuzuu/staged/${id}/approve`, json({ module })),
    reject: (id: string, module: string, reason?: string) =>
      request<RejectResult>(`/api/zuzuu/staged/${id}/reject`, json({ module, reason })),
    rollback: (key: string, id: string) =>
      request<RollbackResult>(`/api/zuzuu/module/${key}/generation/${id}/rollback`, { method: "POST" }),
    // §H.5 the field-config panel: add a column (the toolbar's "+ column") or
    // alter an existing one (the header caret's "Edit column" — name rides the
    // URL, never the body; rename isn't offered here). Both land instantly
    // (operator-gated) and mint a generation.
    addColumn: (key: string, name: string, body: ColumnFieldBody) =>
      request<ModuleColumnResult>(`/api/zuzuu/module/${key}/column`, json({ name, ...body })),
    alterColumn: (key: string, name: string, body: ColumnFieldBody) =>
      request<ModuleColumnResult>(`/api/zuzuu/module/${key}/column/${encodeURIComponent(name)}`, jsonMethod("PATCH", body)),
  },

  // the ACP drive lane: create a session, then attach /ws/acp/:id
  acp: {
    create: () => request<{ id: string }>("/api/acp", { method: "POST" }),
    list: () => request<{ ids: string[] }>("/api/acp"), // liveness — reconcile the client registry
  },
};

/** ws://host or wss://host for a daemon WS path (same origin as the page). */
export function wsUrl(path: string): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}${path}`;
}
