// shell/session/use-start-session.ts — the ONE place a start request is routed to a
// lane and landed in. Every entry point (onboarding host picker, "+ new session",
// Overview) bottoms out here, so the PTY-vs-ACP decision lives in laneFor and can't
// diverge between them (FEAS-1). store.open() only appends to the PTY session list;
// api.acp.create() spawns the ACP adapter lane. Either way we select the new node so
// the stage (useWorld.selected) redirects the user into it.
import { useCallback } from "react";
import type { SessionInfo } from "#shared/index.js";
import { useWorkbench } from "../../state/store.js";
import { useWorld } from "../world-state.js";
import { api } from "../../lib/api.js";

/** The lane a start request takes. ACP (the structured conversation) is the DEFAULT for
 *  Claude Code agent sessions; every other host and plain shells keep the PTY/terminal
 *  lane. Pure — the single routing decision read by all start entry points. */
export function laneFor(type?: "shell" | "agent", host?: string): "acp" | "terminal" {
  return type === "agent" && host === "claude" ? "acp" : "terminal";
}

export function useStartSession() {
  const open = useWorkbench((s) => s.open);
  const registerAcp = useWorkbench((s) => s.registerAcp);
  const select = useWorld((s) => s.select);
  return useCallback(
    async (type?: "shell" | "agent", host?: string, opts?: { cwd?: string }): Promise<SessionInfo | null> => {
      if (laneFor(type, host) === "acp") {
        // ACP lane: create the adapter session and land in the conversation. (The nav
        // registry that lets you switch back is U7; the failure UX is U8's onboarding
        // step — here a failed create just leaves the user where they are.)
        const created = await api.acp.create().catch(() => null);
        if (created) { registerAcp(created.id); select({ kind: "acp", id: created.id }); }
        return null; // an ACP session is not a PTY SessionInfo
      }
      const created = await open(type, host, opts);
      if (created) select({ kind: "session", id: created.id }); // redirect into the new session
      return created;
    },
    [open, registerAcp, select],
  );
}
