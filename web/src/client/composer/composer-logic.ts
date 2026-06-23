// src/client/composer/composer-logic.ts — pure composer logic (no React, no DOM).
//
// bracketedPaste(): wrap a message as a terminal bracketed-paste block so the host
// CLI receives it as ONE pasted unit (inner newlines don't submit) followed by a
// submit (CR). The tmux send-keys / Warp pattern — framing only; the existing
// terminal transport (TermConnection.sendInput) carries it. Kept pure + tested so
// the React Composer stays thin.

const PASTE_START = "\x1b[200~";
const PASTE_END = "\x1b[201~";

/** Wrap text as a bracketed-paste block followed by a trailing CR (the submit). */
export function bracketedPaste(text: string): string {
  return PASTE_START + text + PASTE_END + "\r";
}

/** The quiet window after the last PTY output before the agent is considered
 *  ready for the next turn — the output-quiescence heuristic (there is no protocol
 *  signal; agent sessions carry no shell-integration markers). */
export const QUIET_MS = 600;

/** Ready = no PTY output for at least quietMs. The composer queues a send while
 *  busy and flushes on the busy→ready edge, so we never inject mid-turn. */
export function isReady(lastOutputAt: number, now: number, quietMs: number = QUIET_MS): boolean {
  return now - lastOutputAt >= quietMs;
}
