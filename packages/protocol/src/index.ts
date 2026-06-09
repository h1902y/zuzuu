/**
 * Shared wire protocol between the webcode daemon and the web UI.
 *
 * Terminal WebSocket (`/ws/term/:sessionId`) uses binary frames with a
 * 1-byte opcode prefix (ttyd-style). Everything after the opcode byte is
 * the payload: raw bytes for I/O, UTF-8 JSON for control frames.
 */

// ── Terminal WS: client → server ────────────────────────────────────────
export const ClientOp = {
  /** payload: raw UTF-8 keystrokes / pasted data */
  Input: 0x00,
  /** payload: JSON ResizePayload */
  Resize: 0x01,
  /**
   * payload: JSON AckPayload — client reports bytes fully written to
   * xterm.js (via term.write callback). Drives server-side flow control.
   */
  Ack: 0x02,
} as const;
export type ClientOp = (typeof ClientOp)[keyof typeof ClientOp];

// ── Terminal WS: server → client ────────────────────────────────────────
export const ServerOp = {
  /** payload: raw PTY output bytes */
  Output: 0x00,
  /** payload: JSON ExitPayload — PTY exited */
  Exit: 0x01,
  /**
   * payload: raw bytes — serialized terminal state replayed on attach.
   * Rendered like Output but excluded from flow-control accounting.
   */
  Replay: 0x02,
  /** payload: JSON TitlePayload */
  Title: 0x03,
} as const;
export type ServerOp = (typeof ServerOp)[keyof typeof ServerOp];

export interface ResizePayload {
  cols: number;
  rows: number;
}

export interface AckPayload {
  /** bytes the client has finished writing to the terminal since last ack */
  bytes: number;
}

export interface ExitPayload {
  exitCode: number;
  signal?: number;
}

export interface TitlePayload {
  title: string;
}

/** Flow control watermarks (bytes in flight, i.e. sent but not yet acked). */
export const FLOW_HIGH_WATER = 128 * 1024;
export const FLOW_LOW_WATER = 16 * 1024;
/** Client sends an ack at least every this-many written bytes. */
export const ACK_INTERVAL = 32 * 1024;

// ── Sessions REST (/api/sessions) ───────────────────────────────────────
export interface SessionInfo {
  id: string;
  title: string;
  cwd: string;
  /** true while the PTY process is alive */
  alive: boolean;
  createdAt: number;
}

export interface CreateSessionRequest {
  /** workspace-relative cwd, defaults to workspace root */
  cwd?: string;
  cols?: number;
  rows?: number;
}

// ── Filesystem REST (/api/fs/*) ─────────────────────────────────────────
export type EntryKind = "file" | "dir" | "symlink" | "other";

export interface FsEntry {
  name: string;
  kind: EntryKind;
  /** for symlinks: what the target resolves to (file/dir), if it resolves inside the root */
  targetKind?: EntryKind;
  size: number;
  mtimeMs: number;
}

export interface ListResponse {
  /** workspace-relative path that was listed, normalized */
  path: string;
  entries: FsEntry[];
}

export interface MkdirRequest {
  path: string;
}

export interface RenameRequest {
  from: string;
  to: string;
}

export interface DeleteRequest {
  paths: string[];
}

export interface WorkspaceInfo {
  /** absolute path of the served root (display only) */
  root: string;
  name: string;
  version: string;
}

// ── Filesystem events WS (/ws/fs) — JSON text frames ────────────────────
export type FsClientMessage =
  | { type: "watch"; path: string }
  | { type: "unwatch"; path: string };

export type FsServerMessage = {
  type: "changed";
  /** workspace-relative directory whose contents changed */
  path: string;
};

export interface ApiError {
  error: string;
}
