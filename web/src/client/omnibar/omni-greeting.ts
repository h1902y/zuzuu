// src/client/omnibar/omni-greeting.ts — the GREETING (§E.4): the omnibar's
// zero-state is an assist, not an empty input. One calm block composed entirely
// from EXISTING reads — the needs-me composite (pending proposals + held
// sessions), the last session, integrity, and the readiness digest WHEN IT'S
// ALREADY CACHED (the session-kickoff fetch; the greeting never respawns the
// CLI for it) — then suggested rows, each a canned registry invocation. Typing
// collapses it instantly; Esc lands on the World; nothing auto-fires an agent.
// Pure — PaletteBody renders it; tests drive it.

import type { PaletteCommand } from "../palette/palette-commands.js";
import { needsMeCopy } from "../shell/overview/overview-model.js";

export interface GreetingInput {
  /** local hour 0–23 (injected — the model stays pure/testable) */
  hour: number;
  projectName: string;
  pending: number;
  held: number;
  /** Σ module integrity issues (broken · orphans · stale) — quiet when 0 */
  integrity: number;
  /** the most recent terminal/agent session, if any */
  lastSession: { id: string; label: string } | null;
  /** the FIRST line of the cached readiness digest (null = not cached — never fetch) */
  digestLine: string | null;
  /** non-null while a setup rung (git-init/init/enable) is still pending — the
   *  companion pin's own label (e.g. "Setup 2/3", from companionView), reused
   *  verbatim so the copy matches everywhere. The greeting must NEVER claim
   *  "All caught up" while this is set (bug: false all-caught-up mid-setup). */
  setupLabel: string | null;
}

export interface GreetingModel {
  salutation: string;
  /** the brief — 0–3 quiet lines (needs-me · where you were · integrity/digest) */
  brief: string[];
  /** suggested rows — canned invocations over the registry, ranked */
  rows: PaletteCommand[];
}

export function salutationFor(hour: number, name: string): string {
  const part = hour < 5 ? "Up late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return `${part} — ${name}`;
}

export function greetingModel(input: GreetingInput): GreetingModel {
  const { hour, projectName, pending, held, integrity, lastSession, digestLine, setupLabel } = input;
  const needsMe = pending + held;

  const brief: string[] = [];
  // bug fix: setup leads — honest first, never masked by a calm "All caught up."
  if (setupLabel) brief.push(`${setupLabel} — finish setup to get started.`);
  if (needsMe > 0) brief.push(needsMeCopy(pending, held));
  if (lastSession) brief.push(`You were in ${lastSession.label}.`);
  if (integrity > 0) brief.push(`${integrity} integrity issue${integrity === 1 ? "" : "s"} worth a look.`);
  else if (digestLine) brief.push(digestLine);
  if (!brief.length) brief.push("All caught up.");

  const rows: PaletteCommand[] = [];
  if (needsMe > 0) {
    rows.push({
      value: "greet-review", label: `Review ${needsMe} waiting`, meta: needsMeCopy(pending, held),
      action: { kind: "review" }, hint: "R",
    });
  }
  if (lastSession) {
    rows.push({
      value: "greet-resume", label: `Resume ${lastSession.label}`, meta: "session",
      action: { kind: "open-session", id: lastSession.id }, hint: "↵",
    });
  }
  rows.push({ value: "greet-session", label: "Start a session", action: { kind: "new-shell" }, lane: "instant" });
  rows.push({ value: "greet-everything", label: "Open Everything", meta: "one table over every module", action: { kind: "open-everything" } });

  return { salutation: salutationFor(hour, projectName), brief: brief.slice(0, 3), rows };
}
