// shell/session/use-enter-project.ts — open a project: in-place switchTo, then land
// in its shell on the Overview. Reuses the existing daemon switchTo (re-roots,
// tears down the old project's sessions), refetches the new root's data (NO page
// reload — preserves app state), resets the in-project selection to the Overview,
// and flips the top-level surface to "project". Shared by the Projects Home + the switcher.
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
import { brainEvents } from "../../lib/brain-events.js";
import { useWorkbench } from "../../state/store.js";
import { useWorld } from "../world-state.js";
import { useAppSurface } from "../../state/app-surface.js";
import { toast } from "../../state/toast.js";

export function useEnterProject() {
  const qc = useQueryClient();
  const refresh = useWorkbench((s) => s.refresh);
  const select = useWorld((s) => s.select);
  const open = useAppSurface((s) => s.open);
  return useCallback(
    async (path: string) => {
      try {
        await api.switchWorkspace(path);
        // re-bind the brain push to the NEW root (audit item 5): the daemon resolves
        // the watched root at socket-upgrade time — without this, live updates keep
        // watching the previous project and silently die after a switch.
        brainEvents.restart();
        select(null); // land on the map (home base)
        // CRITICAL — discard the PREVIOUS project's cached brain + identity before the
        // new project renders. The brain query keys (["zuzuu", …], ["workspace"]) are NOT
        // root-scoped — same key, new root — so invalidate alone would flash the old
        // project's notes/instructions on an inactive view (it only refetches ACTIVE
        // queries; the rest keep their stale cache). removeQueries drops the data outright,
        // so the new project starts clean (loading → fresh), never polluted. (Global
        // ["projects", …] recents/list are left intact — they're machine-wide, not per-project.)
        qc.removeQueries({ queryKey: ["zuzuu"] });
        qc.removeQueries({ queryKey: ["workspace"] });
        await refresh(); // the new root's sessions
        await qc.invalidateQueries(); // refetch the new root's data
        open(path); // record the active project's path (drives browser-history sync)
      } catch { toast(`Couldn’t open ${path}`, "error"); }
    },
    [qc, refresh, select, open],
  );
}
