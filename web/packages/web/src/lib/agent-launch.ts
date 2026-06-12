// Launch paths for the terminal pane.
//
// Agent sessions spawn the host CLI DIRECTLY on the PTY (POST /api/sessions
// {type:'agent', command, args} — argv, no shell, no stdin injection), so the
// daemon can run the session-git auto-merge when the host exits. The old
// text-injection path survives ONLY for the plain-shell onboarding CTAs
// ("zuzuu init" / "zuzuu enable" in FacultiesView).
import { useSessions } from "../state/sessions";
import { useView } from "../state/view";
import { termRegistry } from "../term/registry";
import type { AgentSpawnSpec } from "../faculties/host-launch";

/**
 * Start an agent session: direct-spawn the host, tab it, select it, switch to
 * the IDE view. Single-active-agent v1 rule: if an agent session is already
 * alive, focus it instead of spawning a second one.
 */
export async function startAgentSession(spec: AgentSpawnSpec): Promise<void> {
  const s = useSessions.getState();
  const alive = s.tabs.find((t) => t.type === "agent" && t.alive);
  if (alive) {
    s.setActive(alive.id);
    useView.getState().setMode("ide");
    return;
  }
  await s.create({ type: "agent", command: spec.command, args: spec.args, host: spec.host });
  useView.getState().setMode("ide");
}

/**
 * Legacy path: create a SHELL session and type a command into it (\x15
 * kill-line, the command, ⏎). Onboarding-only — never for agent sessions.
 */
export async function launchInTerminal(command: string): Promise<void> {
  await useSessions.getState().create(); // appends a tab and makes it active
  const id = useSessions.getState().activeId;
  if (!id) return;
  // TermView instances only mount in the IDE view — switch first so the new
  // session's connection gets created, then wait for its socket to open.
  useView.getState().setMode("ide");
  const conn = await termRegistry.whenReady(id);
  conn.sendInput(`\x15${command}\r`);
}
