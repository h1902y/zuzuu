// src/shared/rest.ts — the daemon's REST contract (the non-terminal HTTP API).
//
// The browser talks to the daemon two ways: the binary terminal socket
// (opcodes.ts) and these JSON REST endpoints — sessions, filesystem, git,
// search, workflows, health. Types only + two pure helpers; one source of
// truth so the client and server can never drift on a shape.

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

export interface SaveRecordingRequest {
  /** workspace-relative path for the .cast file */
  path: string;
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

// ── Health / onboarding / workspace picker ────────────────────────────────────
export interface HealthResponse {
  ok: true;
  version: string;
  uptimeMs: number;
  /** resident set size in bytes */
  rss: number;
  root: string;
  name: string;
}

export interface WorkspaceConfig {
  onboarded: boolean;
  /** recent workspace roots, most-recent-first */
  recent: string[];
}

export interface BrowseEntry { name: string; path: string }
export interface BrowseResponse {
  /** the absolute directory being listed */
  path: string;
  /** parent directory, or null at the filesystem root */
  parent: string | null;
  dirs: BrowseEntry[];
}
export interface SwitchRequest { path: string }
export interface MkdirInRequest { parent: string; name: string }

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

// ── Shell history (GET /api/history) ──────────────────────────────────────────
export interface HistoryResponse {
  /** most-recent-first, deduped */
  commands: string[];
}

// ── Git (GET/POST /api/git/*) ─────────────────────────────────────────────────
/** XY status codes from `git status --porcelain` (e.g. " M", "A ", "??"). */
export interface GitStatusEntry {
  path: string;
  /** staged (index) status char: M A D R C ? or space */
  index: string;
  /** unstaged (worktree) status char */
  worktree: string;
}
export interface GitStatusResponse {
  repo: boolean;
  branch: string;
  entries: GitStatusEntry[];
}
export interface GitDiffResponse {
  /** HEAD/index content for the diff editor's left side ("" for untracked) */
  original: string;
}
export interface KillPortRequest { port: number }

// ── Workflows (GET/POST /api/workflows) ───────────────────────────────────────
export interface WorkflowArg { name: string; placeholder?: string; default?: string }
export interface Workflow { name: string; command: string; description?: string; args?: WorkflowArg[] }
export interface WorkflowListResponse { workflows: Workflow[] }

// ── pure helpers (shared by both halves) ──────────────────────────────────────

/** POSIX single-quote escaping for a path injected into the terminal (e.g. the
 *  tree's "cd here"): wraps in single quotes, embedded quotes as '\'' so the
 *  shell never interprets the content. */
export function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** Substitute {{arg}} placeholders in a workflow command. */
export function applyWorkflow(command: string, values: Record<string, string>): string {
  return command.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, name: string) => values[name] ?? "");
}
