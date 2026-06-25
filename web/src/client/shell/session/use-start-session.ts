// shell/session/use-start-session.ts — start a session AND land in it. This is the
// missing bridge: store.open() creates the session and sets `activeId` (which the
// Stage+Wings shell never reads), but the stage is driven by useWorld.selected. So
// after open() resolves we select the new session, so the user is redirected into it.
import { useCallback } from "react";
import type { SessionInfo } from "#shared/index.js";
import { useWorkbench } from "../../state/store.js";
import { useWorld } from "../world-state.js";

export function useStartSession() {
  const open = useWorkbench((s) => s.open);
  const select = useWorld((s) => s.select);
  return useCallback(
    async (type?: "shell" | "agent", host?: string): Promise<SessionInfo | null> => {
      const created = await open(type, host);
      if (created) select({ kind: "session", id: created.id }); // redirect into the new session
      return created;
    },
    [open, select],
  );
}
