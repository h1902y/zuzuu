// Launch paths for the terminal pane.
//
// All sessions spawn a CLI DIRECTLY on the PTY (POST /api/sessions
// {type:'agent', command, args} — argv, no shell, no stdin injection), so the
// daemon can run the session-git auto-merge when a host exits. There is no
// plain-terminal path: the workbench surfaces host sessions and zuzuu utility
// runs only.
import { useSessions } from "../state/sessions";
import { useOpenTabs } from "../state/open-tabs";
import { termRegistry } from "../term/registry";
import type { AgentSpawnSpec } from "../modules/host-launch";

export interface StartAgentOptions {
  /** A first task to inject as the new session's terminal input (for hosts that
   *  don't take a positional prompt arg — see resolveStart's argv-first hybrid).
   *  Argv-capable hosts carry the task in `spec.args` instead, so this is unset.
   *  Blank/whitespace → no injection (host opens idle). */
  injectPrompt?: string;
}

/**
 * Start an agent session: direct-spawn the host, tab it, select it. Wave B
 * (concurrency): each agent gets its OWN daemon-side git worktree, so starting
 * one while another is alive spawns a SECOND concurrent agent (its own tab)
 * rather than focusing the existing one — the single-active-agent rule is gone.
 *
 * Start-with-a-task is decided upstream by resolveStart() (host-launch): argv-
 * capable hosts (Claude Code, Codex) carry the task in `spec.args` and boot
 * already working; the rest pass `injectPrompt`, queued as the new session's
 * first terminal input (the TermView injects it once the PTY is ready — see
 * termRegistry.setPendingInput + TermView's readiness gate).
 */
export async function startAgentSession(
  spec: AgentSpawnSpec,
  opts: StartAgentOptions = {},
): Promise<void> {
  const s = useSessions.getState();
  const inject = opts.injectPrompt?.trim();
  const session = await s.create({
    type: "agent",
    command: spec.command,
    args: spec.args,
    host: spec.host,
  });
  // Open + focus the new session as a tab — this is what makes "a new session
  // started" actually switch the center (its id IS the canonical PTY tab id).
  useOpenTabs.getState().open(session.id);
  // Queue before TermView mounts so its readiness-gated drain finds it. \r submits.
  if (inject) termRegistry.setPendingInput(session.id, inject + "\r");
}

/**
 * Run the zuzuu CLI itself as a short-lived utility session (onboarding:
 * `zuzuu init` / `zuzuu enable`). host:'zuzuu' marks the tab so it gets the
 * plain "Session finished" end card instead of the merge story.
 */
export async function startUtilityRun(args: string[]): Promise<void> {
  await useSessions.getState().create({ type: "agent", command: "zuzuu", args, host: "zuzuu" });
}
