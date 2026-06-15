// Launch paths for the terminal pane.
//
// All sessions spawn a CLI DIRECTLY on the PTY (POST /api/sessions
// {type:'agent', command, args} — argv, no shell, no stdin injection), so the
// daemon can run the session-git auto-merge when a host exits. There is no
// plain-terminal path: the workbench surfaces host sessions and zuzuu utility
// runs only.
import { useSessions } from "../state/sessions";
import { termRegistry } from "../term/registry";
import type { AgentSpawnSpec } from "../modules/host-launch";

export interface StartAgentOptions {
  /** A first task to hand the host: typed into its terminal once it opens, so
   *  the session launches already working on it. Blank/whitespace → no task
   *  (the host opens idle, as before). */
  prompt?: string;
}

/**
 * Start an agent session: direct-spawn the host, tab it, select it. Single-
 * active-agent v1 rule: if an agent session is already alive, focus it
 * instead of spawning a second one.
 *
 * Start-with-a-task: a non-blank `prompt` is queued as the new session's first
 * terminal input (see termRegistry.setPendingInput) — the TermView injects it
 * once the PTY is open. This is host-agnostic (every interactive host reads
 * stdin), needs no per-host argv flags, and can't be misparsed as CLI flags.
 * Focusing an already-alive session never injects (you'd be typing into work
 * already in progress).
 */
export async function startAgentSession(
  spec: AgentSpawnSpec,
  opts: StartAgentOptions = {},
): Promise<void> {
  const s = useSessions.getState();
  const alive = s.tabs.find((t) => t.type === "agent" && t.alive);
  if (alive) {
    s.setActive(alive.id);
    return;
  }
  const prompt = opts.prompt?.trim();
  const session = await s.create({
    type: "agent",
    command: spec.command,
    args: spec.args,
    host: spec.host,
  });
  // Queue before TermView mounts so its connect-time drain finds it. \r submits.
  if (prompt) termRegistry.setPendingInput(session.id, prompt + "\r");
}

/**
 * Run the zuzuu CLI itself as a short-lived utility session (onboarding:
 * `zuzuu init` / `zuzuu enable`). Bypasses startAgentSession's focus-existing
 * rule on purpose — a utility run must always spawn, even while a host
 * session is alive. host:'zuzuu' marks the tab so it gets the plain
 * "Session finished" end card instead of the merge story.
 */
export async function startUtilityRun(args: string[]): Promise<void> {
  await useSessions.getState().create({ type: "agent", command: "zuzuu", args, host: "zuzuu" });
}
