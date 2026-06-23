// src/client/composer/composer-logic.ts — pure composer logic (no React, no DOM).
//
// The composer is a REMOTE KEYBOARD into the live interactive host TUI (Claude
// Code et al.) — we forward the user's message to the PTY, we never drive the host
// headlessly. The hard-won lesson: a full-screen TUI owns its own line editor, so
// HOW we deliver matters.
//
//  - Deliver the body and the submit (CR) as TWO writes, with a settle delay
//    between them. Sending `…text…\r` in one write races Claude Code's paste /
//    line-editor debounce and the CR gets swallowed — the message lands in the box
//    but never submits (the "our input doesn't reach their input" bug).
//  - Single-line → raw keystrokes (most robust; no paste framing to debounce).
//    Multi-line → ONE bracketed-paste block, so inner newlines are content, not
//    submits. The CR is delivered separately in both cases.
//
// Kept pure + tested so the React Composer stays thin.

const PASTE_START = "\x1b[200~";
const PASTE_END = "\x1b[201~";

/** Wrap text as a bracketed-paste block — NO trailing submit (the CR is a
 *  separate, delayed write). Inner newlines ride inside as content. Internal to the
 *  multi-line path of inputFrames; the body never carries the submit. */
function pasteBlock(text: string): string {
  return PASTE_START + text + PASTE_END;
}

/** The settle window between delivering the message body and the submit CR, so the
 *  host TUI's paste / line editor finishes ingesting the body before Enter. */
export const SUBMIT_DELAY_MS = 60;

/** How a host accepts a turn — the submit key + whether multi-line rides in as a
 *  bracketed paste. Supplied per-host (composer/host-input.ts); defaulted here so
 *  callers/tests can omit it (the Claude-verified behavior). */
export interface InputOpts {
  submit: string;
  multilinePaste: boolean;
}
export const DEFAULT_INPUT_OPTS: InputOpts = { submit: "\r", multilinePaste: true };

/**
 * Split a message into the two writes a TUI line-editor reliably accepts: the
 * body, then a SEPARATE submit. Single-line bodies go as raw keystrokes; multi-line
 * bodies go as one bracketed-paste block (when the host supports it). The body
 * NEVER carries the submit — the caller delivers `submit` after SUBMIT_DELAY_MS.
 */
export function inputFrames(text: string, opts: InputOpts = DEFAULT_INPUT_OPTS): { body: string; submit: string } {
  const body = opts.multilinePaste && text.includes("\n") ? pasteBlock(text) : text;
  return { body, submit: opts.submit };
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
