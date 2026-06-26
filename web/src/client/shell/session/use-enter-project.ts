// shell/session/use-enter-project.ts — open a project: in-place switchTo, then land
// in its shell on the Overview. Reuses the existing daemon switchTo (re-roots,
// tears down the old project's sessions), refetches the new root's data (NO page
// reload — preserves app state), resets the in-project selection to the Overview,
// and flips the top-level surface to "project". Shared by the Projects Home + the switcher.
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api.js";
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
        select(null); // land on the Overview (home base)
        await refresh(); // the new root's sessions
        await qc.invalidateQueries(); // refetch the new root's brain
        open(path); // record the active project's path (drives browser-history sync)
      } catch { toast(`Couldn’t open ${path}`, "error"); }
    },
    [qc, refresh, select, open],
  );
}
