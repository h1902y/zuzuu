// src/client/lib/api.ts — the typed REST client over the daemon.
//
// One thin `request` wrapper + a flat `api` object; every shape comes from
// #shared so the client and server can't drift. Surface: workspace · sessions ·
// fs · search + the modules dashboard (`zuzuu.*`).

import type {
  ApproveResult,
  CreateSessionRequest,
  DirListing,
  FileListResponse,
  HeldActionResult,
  HeldSessionList,
  ListResponse,
  ModuleDetail,
  ModuleGenerationList,
  ModuleItem,
  ModuleOverviewResponse,
  ModuleSchema,
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
} from "#shared/index.js";

/** A setup verb's response — the CLI JSON the daemon passes through (shape varies). */
type SetupResult = { ok?: boolean } & Record<string, unknown>;

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    if (res.status === 401) {
      throw new ApiError(401, "not authorized — open the URL printed by the zz-web daemon");
    }
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, body?.error ?? `request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

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
    init: () => request<SetupResult>("/api/zuzuu/setup/init", json({})),
    enable: () => request<SetupResult>("/api/zuzuu/setup/enable", json({})),
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
    projectState: () => request<ProjectState>("/api/zuzuu/project-state"),
    // the held-session CODE queue — sessions awaiting a merge decision (the close
    // card's code section reads it). CLI absent / non-git → { held: [] }.
    held: () => request<HeldSessionList>("/api/zuzuu/held"),
    // the session-start readiness brief — `zz doctor` + `zz digest` as raw text
    // (either null when the CLI is absent), embedded in the agent's first turn.
    readiness: () => request<{ doctor: string | null; digest: string | null }>("/api/zuzuu/readiness"),
    // the module's notes — optionally filtered·sorted·paginated server-side (the index
    // SELECT). No query ⇒ the whole module (the default the graph/search/review reads use).
    module: (key: string, query?: ModuleQuery) => request<ModuleDetail>(`/api/zuzuu/module/${key}${moduleQs(query)}`),
    item: (key: string, id: string) => request<ModuleItem>(`/api/zuzuu/module/${key}/item/${id}`),
    schema: (key: string) => request<ModuleSchema>(`/api/zuzuu/module/${key}/schema`),
    generations: (key: string) => request<ModuleGenerationList>(`/api/zuzuu/module/${key}/generations`),
    // a write resolves to a PENDING proposal (a staged change), not a landed row — it
    // surfaces in the review queue and lands only on approve (the gate, as data-provider
    // semantics). All 6 ops route here: create/update/delete/deprecate carry a `target`
    // note; relate/unrelate carry the edge in `change` ({from,type,to}) and need no target.
    stage: (key: string, body: { op: StagedChange["op"]; target?: string; change?: Record<string, unknown> }) =>
      request<StagedChange>(`/api/zuzuu/module/${key}/stage`, json(body)),
    // the daemon route requires { module } in the body (it 400s without it) — the
    // mutation request body isn't in #shared, so this contract is enforced by hand.
    approve: (id: string, module: string) =>
      request<ApproveResult>(`/api/zuzuu/staged/${id}/approve`, json({ module })),
    reject: (id: string, module: string, reason?: string) =>
      request<RejectResult>(`/api/zuzuu/staged/${id}/reject`, json({ module, reason })),
    rollback: (key: string, id: string) =>
      request<RollbackResult>(`/api/zuzuu/module/${key}/generation/${id}/rollback`, { method: "POST" }),
  },
};

/** ws://host or wss://host for a daemon WS path (same origin as the page). */
export function wsUrl(path: string): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}${path}`;
}
