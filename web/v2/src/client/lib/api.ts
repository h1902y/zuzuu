// src/client/lib/api.ts — the typed REST client over the daemon.
//
// One thin `request` wrapper + a flat `api` object; every shape comes from
// #shared so the client and server can't drift. Rung 4 ships the CORE surface
// (sessions · fs · search · git · history · health · workspace); the modules
// dashboard (/api/zuzuu) lands in Rung 5.

import type {
  BrowseResponse,
  CreateSessionRequest,
  FileListResponse,
  GitDiffResponse,
  GitStatusResponse,
  HealthResponse,
  HistoryResponse,
  ListResponse,
  SearchResponse,
  SessionDetail,
  SessionInfo,
  WorkspaceConfig,
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
  health: () => request<HealthResponse>("/api/health"),
  workspaceConfig: () => request<WorkspaceConfig>("/api/workspace/config"),
  browse: (path?: string) =>
    request<BrowseResponse>(`/api/browse${path ? `?path=${encodeURIComponent(path)}` : ""}`),

  // sessions
  listSessions: () => request<SessionInfo[]>("/api/sessions"),
  createSession: (body: CreateSessionRequest = {}) => request<SessionInfo>("/api/sessions", json(body)),
  closeSession: (id: string) => request<{ ok: true }>(`/api/sessions/${id}`, { method: "DELETE" }),
  sessionDetail: (id: string) => request<SessionDetail>(`/api/sessions/${id}`),
  saveRecording: (sessionId: string, path: string) =>
    request<{ ok: true; path: string; truncated: boolean }>(`/api/sessions/${sessionId}/recording`, json({ path })),

  // filesystem
  listDir: (path: string) => request<ListResponse>(`/api/fs/list?path=${encodeURIComponent(path)}`),
  mkdir: (path: string) => request<{ ok: true }>("/api/fs/mkdir", json({ path })),
  rename: (from: string, to: string) => request<{ ok: true }>("/api/fs/rename", json({ from, to })),
  remove: (paths: string[]) => request<{ ok: true }>("/api/fs/delete", json({ paths })),
  readFile: async (path: string) => {
    const res = await fetch(`/api/fs/download?path=${encodeURIComponent(path)}&inline=1`);
    if (!res.ok) throw new ApiError(res.status, `failed to read (${res.status})`);
    return res.text();
  },
  writeFile: (path: string, content: string) => request<{ ok: true }>("/api/fs/write", json({ path, content })),
  openLocal: (path: string, reveal = false) => request<{ ok: true }>("/api/fs/open", json({ path, reveal })),
  listFiles: () => request<FileListResponse>("/api/files"),

  // search
  search: (q: string, opts: { path?: string; regex?: boolean; caseSensitive?: boolean } = {}) => {
    const qs = new URLSearchParams({ q });
    if (opts.path) qs.set("path", opts.path);
    if (opts.regex) qs.set("regex", "1");
    if (opts.caseSensitive) qs.set("case", "1");
    return request<SearchResponse>(`/api/search?${qs}`);
  },

  // git
  gitStatus: () => request<GitStatusResponse>("/api/git/status"),
  gitDiff: (path: string) => request<GitDiffResponse>(`/api/git/diff?path=${encodeURIComponent(path)}`),
  gitStage: (paths: string[]) => request<{ ok: true }>("/api/git/stage", json({ paths })),
  gitUnstage: (paths: string[]) => request<{ ok: true }>("/api/git/unstage", json({ paths })),
  gitCommit: (message: string) => request<{ ok: true }>("/api/git/commit", json({ message })),

  // shell quick-fixes
  history: () => request<HistoryResponse>("/api/history"),
  killPort: (port: number) => request<{ ok: true }>("/api/fix/kill-port", json({ port })),
};

/** ws://host or wss://host for a daemon WS path (same origin as the page). */
export function wsUrl(path: string): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}${path}`;
}
