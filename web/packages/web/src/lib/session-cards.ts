// Pure card-state logic for the session-surface terminal pane (Phase ④):
// which card the center of the pane shows (none / start / recovery) and which
// end-of-session card a dead agent terminal shows. Kept free of React/fetch
// so the state machine is unit-testable.
import type { SessionCloseResult, SessionGitStatus } from "@zuzuu-web/protocol";

// ── Receipts transcript (Task 6) ────────────────────────────────────────
// The session pane renders the host session as a *conversation of receipts*,
// not a wall of monospace. The only real per-event source today is the
// terminal's OSC-133 command blocks (command + exit code + duration), so each
// block collapses to a one-line receipt. The derivation below — a humanist
// sans label ("Ran npm test"), the machine detail for the mono meta slot, and
// the running/ok/bad tone — is pure so it is unit-tested without a DOM.

export type ReceiptTone = "default" | "ok" | "bad";

export interface CommandReceipt {
  /** the humanist sans label — "Ran npm test", "Edited store.mjs" */
  label: string;
  /** machine-data meta for the mono chip — duration, exit code (null while running) */
  meta: string | null;
  tone: ReceiptTone;
  /** leading glyph hint, mapped to an icon path by the view */
  glyph: "run" | "edit" | "guardrail" | "search" | "git";
  /** still executing (no D marker yet) */
  running: boolean;
}

/** Format a block duration for the mono meta chip. */
export function fmtDuration(ms: number | null): string | null {
  if (ms === null || ms < 0) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const FIRST_WORD = /^\s*(\S+)/;

/**
 * Humanize a shell command into a receipt label + glyph. We classify by the
 * leading token so a `git commit` reads "Ran git commit" with a git glyph and
 * an `nvim file.ts` reads "Edited file.ts" — turning terminal noise into a
 * scannable timeline. Honest about its source: this is the command text the
 * shell saw, not a synthesized tool-call event.
 */
export function receiptForCommand(command: string): { label: string; glyph: CommandReceipt["glyph"] } {
  const first = (command.trim().split("\n")[0] ?? "").trim();
  const verb = (FIRST_WORD.exec(first)?.[1] ?? "").toLowerCase();
  const arg = first.slice(verb.length).trim();
  const base = (p: string) => p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || p;
  const editors = new Set(["vim", "nvim", "vi", "nano", "code", "emacs", "subl"]);
  if (editors.has(verb)) {
    const file = base(arg.split(/\s+/).pop() ?? "");
    return { label: file ? `Edited ${file}` : "Opened an editor", glyph: "edit" };
  }
  if (verb === "git") return { label: first, glyph: "git" };
  if (verb === "rg" || verb === "grep" || verb === "find" || verb === "ag")
    return { label: first, glyph: "search" };
  if (verb === "rm" || verb === "sudo" || verb === "kill" || verb === "chmod")
    return { label: first, glyph: "guardrail" };
  return { label: first || "(empty command)", glyph: "run" };
}

/** Map one command block onto its receipt shape (label, mono meta, tone). */
export function blockReceipt(block: {
  command: string;
  exitCode: number | null;
  durationMs: number | null;
}): CommandReceipt {
  const { label, glyph } = receiptForCommand(block.command);
  const running = block.exitCode === null;
  const dur = fmtDuration(block.durationMs);
  const meta = running
    ? null
    : block.exitCode === 0
      ? dur
      : [dur, `exit ${block.exitCode}`].filter(Boolean).join(" · ");
  const tone: ReceiptTone = running ? "default" : block.exitCode === 0 ? "ok" : "bad";
  return { label, meta, tone, glyph, running };
}

export type CenterCard =
  | { kind: "none" }
  | { kind: "recovery"; branch: string; checkpoints: number };

/**
 * Plain-language copy for the recovery banner (U4 — no git/checkpoint jargon).
 * Exported as a pure function so unit tests can assert exact strings without a
 * DOM renderer.
 */
export function recoveryBannerCopy(branch: string, checkpoints: number): {
  lead: string;
  branchLabel: string;
  stepCount: string;
  resumeLabel: string;
  saveLabel: string;
} {
  return {
    lead: "You have unfinished work from a previous session.",
    branchLabel: branch,
    stepCount: `${checkpoints} saved step${checkpoints === 1 ? "" : "s"}`,
    resumeLabel: "Resume this work",
    saveLabel: "Save to main & start new",
  };
}

/**
 * What the terminal pane's center shows. Starting sessions moved to the
 * bottom composer bar — the center keeps only the load-time recovery card:
 * - sessions exist → nothing (the terminals),
 * - no sessions + a leftover session branch (same condition as the footer
 *   indicator's "leftover": active && !onSessionBranch) WITH ≥1 saved step
 *   → recovery card,
 * - a leftover branch with 0 saved steps → nothing (there is nothing to
 *   recover — typically a session running OUTSIDE the workbench, so its
 *   branch is empty + not abandoned),
 * - a leftover branch that belongs to a currently-live session (its branch is
 *   in `liveBranches`) → nothing (it's running, not abandoned),
 * - otherwise → nothing (the calm resting state above the composer).
 */
export function centerCard(
  tabCount: number,
  git: SessionGitStatus | undefined,
  liveBranches?: Iterable<string>,
): CenterCard {
  if (tabCount > 0) return { kind: "none" };
  if (git?.enabled && !git.cliAbsent && git.active && !git.onSessionBranch) {
    // Nothing to recover: the leftover branch has no saved steps. This is the
    // empty-branch-of-an-outside-session case — don't nag.
    if (git.active.checkpoints === 0) return { kind: "none" };
    // The leftover branch is a currently-live session (running elsewhere) — not
    // abandoned work, so no recovery prompt.
    if (liveBranches) {
      const live = liveBranches instanceof Set ? liveBranches : new Set(liveBranches);
      if (live.has(git.active.branch)) return { kind: "none" };
    }
    return { kind: "recovery", branch: git.active.branch, checkpoints: git.active.checkpoints };
  }
  return { kind: "none" };
}

// ── Session-end tail state (honest about live-outside-the-workbench) ──────
// The transcript/tree tail keys on TWO signals, not one:
//   • `alive`        — a workbench PTY is attached (live HERE),
//   • `sessionState` — the captured trace lifecycle state.
// A session can be NOT attached here yet still LIVE in the user's own terminal
// (trace state 'active'/'opening') — calling that "ended" is wrong. Three states:
//   "live"    → alive here → "the conversation is live in the terminal",
//   "outside" → not alive but state active/opening → running in the user's own
//               terminal, read-only here (NOT ended),
//   "ended"   → not alive and a terminal/unknown state → "Session ended."
export type TailState = "live" | "outside" | "ended";

/** Resolve the session tail state from whether a workbench PTY is attached and
 *  the captured trace lifecycle state. Pure so the three cases are unit-tested. */
export function tailState(alive: boolean, sessionState?: string): TailState {
  if (alive) return "live";
  if (sessionState === "active" || sessionState === "opening") return "outside";
  return "ended";
}

/** Single-active-agent v1 rule: at most ONE alive agent session (shells unlimited). */
export const hasAliveAgent = (tabs: { type: string; alive: boolean }[]): boolean =>
  tabs.some((t) => t.type === "agent" && t.alive);

// ── Active-session band resolution (U5) ─────────────────────────────────
// The active trace session is represented ONCE. With U4's ptyId join key we
// can tell whether the active session is already open in the workbench
// (its live PTY tab) and whether that tab is the one in front of you. The
// persistent "active session" band only lingers when the session is NOT the
// current conversation — when it IS, its state folds into the conversation
// header instead. A trace session with no live PTY (ran outside the
// workbench) must read honestly, never offering a terminal we can't resume.
//
//   "in-conversation" → the live PTY is the focused tab → NO separate band
//                       (the conversation header carries the state).
//   "resume"          → a live PTY exists but isn't focused → compact resume.
//   "outside"         → no live PTY (ptyId absent / tab gone) → honest
//                       "running outside the workbench", no false terminal.
export type ActiveBand = "in-conversation" | "resume" | "outside";

/** Resolve how the pinned active session renders, given whether the
 *  workbench owns its live PTY tab and whether that tab is focused. */
export function activeBand(opts: { liveTab: boolean; focused: boolean }): ActiveBand {
  if (!opts.liveTab) return "outside";
  return opts.focused ? "in-conversation" : "resume";
}

/** Find the unified trace session a live PTY tab belongs to, via the U4 ptyId
 *  join key. Pre-U4 records lack ptyId — for those the conversation header
 *  simply shows no folded trace state (the band has the pre-U4 fallback). */
export function traceSessionForTab<T extends { ptyId?: string }>(
  sessions: T[],
  tabId: string,
): T | undefined {
  return sessions.find((s) => s.ptyId === tabId);
}

export type EndCard =
  | { kind: "banner" } // shell sessions (and unknown outcomes) keep the plain exit banner
  | { kind: "utility" } // zuzuu utility runs (init / enable) — "Session finished", no merge story
  | { kind: "merged"; commits: number }
  | { kind: "no-changes" } // session ended cleanly with nothing to merge
  | { kind: "cli-absent" }
  | { kind: "no-net-changes"; checkpoints: number | null }
  | { kind: "conflict" }
  | { kind: "failed"; message: string };

/**
 * Map an exited session's type + host + the daemon-recorded auto-merge outcome
 * (GET /api/sessions/:id → closeResult) onto the end-of-session card.
 * `host === "zuzuu"` marks a utility run (init / enable) — those always get
 * the plain "Session finished" card, regardless of any merge outcome.
 */
export function endCard(
  type: string | undefined,
  host: string | undefined,
  closeResult: SessionCloseResult | undefined,
): EndCard {
  if (host === "zuzuu") return { kind: "utility" };
  if (type !== "agent" || closeResult === undefined) return { kind: "banner" };
  if ("cliAbsent" in closeResult) return { kind: "cli-absent" };
  if (closeResult.ok) {
    const m = closeResult.merge;
    if (m.conflict) return { kind: "conflict" };
    if (m.reason === "empty-squash-with-checkpoints") {
      return { kind: "no-net-changes", checkpoints: m.commits ?? null };
    }
    if (m.ok === false || m.mergedAs == null) return { kind: "no-changes" };
    return { kind: "merged", commits: m.commits ?? 1 };
  }
  // CLI refused (non-zero exit) — it still prints structured JSON
  const refusal = closeResult.refusal ?? {};
  const reason = typeof refusal.reason === "string" ? refusal.reason : null;
  if (reason === "empty-squash-with-checkpoints") {
    const commits = refusal.commits;
    const checkpoints = refusal.checkpoints;
    const n =
      typeof commits === "number" ? commits : typeof checkpoints === "number" ? checkpoints : null;
    return { kind: "no-net-changes", checkpoints: n };
  }
  if (reason === "no-session-branch") return { kind: "no-changes" };
  if (refusal.conflict === true || reason === "conflict") return { kind: "conflict" };
  return {
    kind: "failed",
    message: closeResult.stderr?.trim() || reason || "session merge failed",
  };
}
