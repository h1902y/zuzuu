// src/shared/rest.ts — the daemon's REST contract (the non-terminal HTTP API).
//
// The browser talks to the daemon two ways: the binary terminal socket
// (opcodes.ts) and these JSON REST endpoints — sessions, filesystem, search,
// health. Types only; one source of truth so the client and server can never
// drift on a shape.

// ── Sessions REST (/api/sessions) ─────────────────────────────────────────────
/** "shell" = the user's login shell with rc injection; "agent" = a host coding
 *  agent CLI spawned directly on the PTY (no shell, no injection) — an agent exit
 *  triggers the zuzuu session-git auto-merge. */
export type SessionType = "shell" | "agent";

export interface SessionInfo {
  id: string;
  title: string;
  cwd: string;
  /** true while the PTY process is alive */
  alive: boolean;
  createdAt: number;
  type: SessionType;
  /** host CLI name for agent sessions (e.g. "claude") */
  host?: string;
}

export interface CreateSessionRequest {
  /** workspace-relative cwd, defaults to the workspace root */
  cwd?: string;
  cols?: number;
  rows?: number;
  /** program to run directly on the PTY instead of a shell — validated against a
   *  server-side allowlist; spawned as an argv array, never shell-interpreted. */
  command?: string;
  args?: string[];
  type?: SessionType;
  host?: string;
}

/** GET /api/sessions/:id — SessionInfo plus, after an agent PTY exited, the
 *  result of the automatic `zuzuu session merge`. */
export interface SessionDetail extends SessionInfo {
  closeResult?: import("./zuzuu.js").SessionCloseResult;
}

// ── Filesystem REST (/api/fs/*) ───────────────────────────────────────────────
export type EntryKind = "file" | "dir" | "symlink" | "other";

export interface FsEntry {
  name: string;
  kind: EntryKind;
  /** for symlinks: what the target resolves to, if it resolves inside the root */
  targetKind?: EntryKind;
  size: number;
  mtimeMs: number;
}

export interface ListResponse {
  /** the normalized workspace-relative path that was listed */
  path: string;
  entries: FsEntry[];
}

export interface MkdirRequest { path: string }
export interface RenameRequest { from: string; to: string }
export interface DeleteRequest { paths: string[] }
export interface OpenRequest {
  path: string;
  /** reveal in the system file manager instead of opening the file */
  reveal?: boolean;
}
export interface WriteRequest { path: string; content: string }

export interface WorkspaceInfo {
  /** absolute path of the served root (display only) */
  root: string;
  name: string;
  version: string;
}

// ── Filesystem-events WS (/ws/fs) — JSON text frames ──────────────────────────
export type FsClientMessage =
  | { type: "watch"; path: string }
  | { type: "unwatch"; path: string };
export type FsServerMessage = {
  type: "changed";
  /** the workspace-relative directory whose contents changed */
  path: string;
};

export interface ApiError { error: string }

// ── Content search (GET /api/search) ──────────────────────────────────────────
export interface SearchMatch {
  line: number;
  text: string;
  /** [start, end) byte offsets of match highlights within `text` */
  ranges: [number, number][];
}
export interface SearchFileResult { path: string; matches: SearchMatch[] }
export interface SearchResponse {
  results: SearchFileResult[];
  total: number;
  truncated: boolean;
  engine: "rg" | "grep";
}

// ── Quick-open file list (GET /api/files) ─────────────────────────────────────
export interface FileListResponse {
  /** workspace-relative file paths (dirs excluded) */
  files: string[];
  truncated: boolean;
}

