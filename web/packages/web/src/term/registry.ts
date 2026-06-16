import type { TermConnection } from "./connection";

/**
 * Live connections by session id, so non-terminal UI (the file tree's
 * "cd here", workflow runs, future palette actions) can send input to a session.
 */
const connections = new Map<string, TermConnection>();

/**
 * Initial input queued for a session that hasn't mounted its TermView yet
 * (the "start with a task" path): startAgentSession() creates the PTY, then
 * queues the task text here; the TermView drains it once its connection opens.
 * Peek-then-clear (not take) keeps it StrictMode-safe — dev double-mounts a
 * TermView (mount → cleanup → mount), and the throwaway first mount must not
 * consume the prompt before the real connection exists.
 */
const pendingInput = new Map<string, string>();

export const termRegistry = {
  set: (id: string, conn: TermConnection) => connections.set(id, conn),
  delete: (id: string) => connections.delete(id),
  get: (id: string | null) => (id ? connections.get(id) : undefined),

  /** Queue text to inject as a session's first input (drained on connect). */
  setPendingInput: (id: string, data: string) => pendingInput.set(id, data),
  /** Peek the queued initial input (does NOT consume — see pendingInput). */
  getPendingInput: (id: string) => pendingInput.get(id),
  /** Consume the queued initial input after it has actually been sent. */
  clearPendingInput: (id: string) => pendingInput.delete(id),
};
