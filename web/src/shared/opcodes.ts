// src/shared/opcodes.ts — the terminal WebSocket wire format.
//
// The terminal socket (`/ws/term/:id`) uses ttyd-style BINARY frames: one
// opcode byte, then the payload — raw bytes for I/O, UTF-8 JSON for control.
// This is the universal seam: the server (term-protocol) and the client (connection)
// both encode/decode against exactly these opcodes. Nothing else fits here.

// ── client → server ──────────────────────────────────────────────────────────
export const ClientOp = {
  /** payload: raw UTF-8 keystrokes / pasted data */
  Input: 0x00,
  /** payload: JSON {@link ResizePayload} */
  Resize: 0x01,
  /**
   * payload: JSON {@link AckPayload} — the client reports bytes it has fully
   * written to xterm. This drives server-side flow control (see flow.ts).
   */
  Ack: 0x02,
} as const;
export type ClientOp = (typeof ClientOp)[keyof typeof ClientOp];

// ── server → client ──────────────────────────────────────────────────────────
export const ServerOp = {
  /** payload: raw PTY output bytes */
  Output: 0x00,
  /** payload: JSON `{ exitCode, signal? }` — the PTY exited */
  Exit: 0x01,
  /**
   * payload: raw bytes — the serialized terminal state replayed on attach.
   * Rendered like Output but EXCLUDED from flow-control accounting.
   */
  Replay: 0x02,
  /** payload: JSON `{ title }` */
  Title: 0x03,
  /** payload: JSON {@link CwdPayload} — the shell's working directory changed */
  Cwd: 0x04,
} as const;
export type ServerOp = (typeof ServerOp)[keyof typeof ServerOp];

export interface ResizePayload { cols: number; rows: number }
export interface AckPayload {
  /** bytes the client has finished writing to the terminal since its last ack */
  bytes: number;
}
export interface CwdPayload {
  /** workspace-relative ("" = root) unless `outside` is true, then absolute */
  cwd: string;
  outside?: boolean;
}
