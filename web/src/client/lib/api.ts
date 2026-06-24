// src/client/lib/api.ts — the typed REST client over the daemon.
//
// One thin `request` wrapper + a flat `api` object; every shape comes from
// #shared so the client and server can't drift. Surface: workspace · sessions ·
// fs · search + the modules dashboard (`zuzuu.*`).

import type {
  ApproveResult,
  CreateSessionRequest,
  FileListResponse,
  ListResponse,
  ModuleDetail,
  ModuleGenerationList,
  ModuleOverviewResponse,
  RejectResult,
  RollbackResult,
  SearchResponse,
  SessionInfo,
  WorkspaceInfo,
} from "#shared/index.js";

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

  // sessions
  listSessions: () => request<SessionInfo[]>("/api/sessions"),
  createSession: (body: CreateSessionRequest = {}) => request<SessionInfo>("/api/sessions", json(body)),
  closeSession: (id: string) => request<{ ok: true }>(`/api/sessions/${id}`, { method: "DELETE" }),

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
    module: (key: string) => request<ModuleDetail>(`/api/zuzuu/module/${key}`),
    generations: (key: string) => request<ModuleGenerationList>(`/api/zuzuu/module/${key}/generations`),
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
