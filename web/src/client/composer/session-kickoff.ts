// composer/session-kickoff.ts — the auto session-start kickoff: the workbench drives
// the host agent's FIRST turn. When an agent session is STARTED here, once its CLI is
// up and idle the Composer delivers ONE kickoff message — orient the agent and have it
// self-check the workspace (zz doctor) before the user's first real task. The active
// complement to the passive SessionStart digest (which is context, not a turn).
//
// Pure message + fire-predicate (tested); a tiny pending-set registry like
// connections.ts. In-memory BY DESIGN: a page reload clears it, so a REATTACHED
// session (which is mid-work, not new) is never re-kicked.

const pending = new Set<string>();

/** Mark a freshly-started agent session to receive the kickoff (called at create). */
export function requestKickoff(sessionId: string): void { pending.add(sessionId); }

/** Is a kickoff still owed for this session? */
export function isKickoffPending(sessionId: string): boolean { return pending.has(sessionId); }

/** Consume the kickoff — on DELIVER, or on CANCEL (the user typed first). Idempotent. */
export function takeKickoff(sessionId: string): boolean { return pending.delete(sessionId); }

/** Fire once the agent is up (alt-screen on, or it has emitted output) AND idle — so
 *  the message lands at the TUI prompt, not into a still-booting CLI. */
export function shouldFireKickoff(o: { ready: boolean; agentUp: boolean; pending: boolean }): boolean {
  return o.pending && o.ready && o.agentUp;
}

/** The pre-fetched readiness brief embedded in the kickoff — `zz doctor` + `zz digest`
 *  raw text (either null when the CLI is absent). */
export interface Readiness { doctor?: string | null; digest?: string | null }

/**
 * The kickoff message delivered to the host agent as the session's first turn.
 *
 * With readiness (the workbench already ran the checks): a multi-line brief embedding
 * the digest + doctor output — delivered via bracketed paste, so inner newlines are
 * content, not submits. The agent skims a verified picture instead of running the
 * checks itself. Without readiness (CLI absent): a single-line fallback that asks the
 * agent to self-check.
 */
export function kickoffMessage(opts: { projectName?: string; readiness?: Readiness } = {}): string {
  const where = opts.projectName ? ` in ${opts.projectName}` : "";
  const intro =
    `Session start — a new zuzuu-managed session${where}. You're running inside zuzuu: it observes this session and proposes brain changes I review (every change is human-gated).`;

  const doctor = opts.readiness?.doctor?.trim();
  const digest = opts.readiness?.digest?.trim();
  if (doctor || digest) {
    const parts = [intro, "", "I've already run the readiness checks — here's where the project stands and its health:"];
    if (digest) parts.push("", "── zz digest ──", digest);
    if (doctor) parts.push("", "── zz doctor ──", doctor);
    parts.push("", "Skim the above, confirm you're oriented, and flag anything that looks off — then wait for my first task.");
    return parts.join("\n");
  }
  // fallback — no readiness (the `zz` CLI is absent): have the agent self-check.
  return (
    intro +
    " Before we begin, if the `zz` CLI is available, run `zz doctor` (and `zz status`) to confirm the Project, its modules, the guardrails, and the hooks are all in place." +
    " Reply with a one-line readiness summary — what's set up and anything that looks off — then wait for my first task."
  );
}
