// Shared session-git action helpers — used by the footer SessionIndicator and
// the Phase ④ session cards (recovery + end-of-session), so both surfaces
// handle the empty-squash refusal and cache refreshes identically.
import type { QueryClient } from "@tanstack/react-query";
import { zuzuuApi } from "./zuzuu-api";
import { mergeRefusalReason } from "../modules/session-git";
import { confirm } from "../components/ui";

/** merge/continue/discard all move branches around — refresh everything git-shaped. */
export function refreshSessionGit(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ["zuzuu", "session"] });
  void queryClient.invalidateQueries({ queryKey: ["git", "status"] });
  void queryClient.invalidateQueries({ queryKey: ["dir"] });
  void queryClient.invalidateQueries({ queryKey: ["files"] });
}

/**
 * Squash-merge the session branch to main. On the exploration-only refusal
 * (checkpoints exist but the tree equals main, so the squash would be empty)
 * offer to discard instead — the confirm dialog is the human gate; the daemon
 * rides --yes server-side. Other failures rethrow for the caller to surface.
 */
export async function mergeSessionWithFallback(): Promise<void> {
  try {
    await zuzuuApi.sessionMerge();
  } catch (err) {
    if (mergeRefusalReason(err) === "empty-squash-with-checkpoints") {
      const ok = await confirm({
        title: "Nothing to merge",
        message:
          "This session only explored — its checkpoints left the tree identical to main. Discard the exploration checkpoints?",
        okLabel: "Discard exploration checkpoints",
        danger: true,
      });
      if (ok) await zuzuuApi.sessionDiscard();
      return;
    }
    throw err;
  }
}
