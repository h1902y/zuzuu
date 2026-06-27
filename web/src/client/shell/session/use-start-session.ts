// shell/session/use-start-session.ts — start a session AND land in it. store.open()
// only appends to the session list; the stage is driven by useWorld.selected. So
// after open() resolves we select the new session, redirecting the user into it.
import { useCallback } from "react";
import type { SessionInfo } from "#shared/index.js";
import { useWorkbench } from "../../state/store.js";
import { useWorld } from "../world-state.js";

export function useStartSession() {
  const open = useWorkbench((s) => s.open);
  const select = useWorld((s) => s.select);
  return useCallback(
    async (type?: "shell" | "agent", host?: string, opts?: { cwd?: string }): Promise<SessionInfo | null> => {
      const created = await open(type, host, opts);
      if (created) select({ kind: "session", id: created.id }); // redirect into the new session
      return created;
    },
    [open, select],
  );
}
