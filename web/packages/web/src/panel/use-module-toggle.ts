// F3 — the ONE enabled-toggle path, shared by BOTH toggle surfaces (the
// master-list row Switch and the ModuleView hero Switch). Before this, each
// surface owned its own useMutation against the SAME module + the SAME
// ["zuzuu","overview"] cache, gated only by its own isPending — concurrent
// toggles raced and an error could restore the OTHER mutation's optimistic
// value. Here a shared per-id in-flight guard (togglingIds in the right-panel
// store) disables both surfaces while a toggle runs, so the two serialize.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ModuleOverviewResponse } from "@zuzuu-web/protocol";
import { zuzuuApi } from "../lib/zuzuu-api";
import { useRightPanel } from "../state/right-panel";
import { toggleEnabledInOverview } from "./modules-list";

const OVERVIEW_KEY = ["zuzuu", "overview"] as const;

/**
 * Toggle one module's `enabled`, optimistic against the shared overview cache,
 * serialized across both Switches via the store's per-id in-flight guard.
 * Returns `{ toggle(next), isToggling }` — `isToggling` is true while ANY
 * surface has a toggle in flight for this id (so both disable together).
 */
export function useModuleToggle(id: string): { toggle: (next: boolean) => void; isToggling: boolean } {
  const queryClient = useQueryClient();
  const beginToggle = useRightPanel((s) => s.beginToggle);
  const endToggle = useRightPanel((s) => s.endToggle);
  // subscribe to the set so the consuming component re-renders on begin/end
  const isToggling = useRightPanel((s) => s.togglingIds.has(id));

  const mutation = useMutation({
    mutationKey: ["zuzuu", "toggle", id],
    mutationFn: (next: boolean) => zuzuuApi.setModuleEnabled(id, next),
    onMutate: async (next: boolean) => {
      await queryClient.cancelQueries({ queryKey: OVERVIEW_KEY });
      const prev = queryClient.getQueryData(OVERVIEW_KEY);
      queryClient.setQueryData(OVERVIEW_KEY, (old: ModuleOverviewResponse | undefined) =>
        toggleEnabledInOverview(old, id, next),
      );
      return { prev };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(OVERVIEW_KEY, ctx.prev);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
      endToggle(id);
    },
  });

  const toggle = (next: boolean) => {
    if (isToggling) return; // guard: a toggle for this id is already in flight
    beginToggle(id);
    mutation.mutate(next);
  };

  return { toggle, isToggling };
}
