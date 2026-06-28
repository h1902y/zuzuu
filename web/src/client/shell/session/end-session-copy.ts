// shell/session/end-session-copy.ts — the honest end-session confirm copy. Ending an
// AGENT session is consequential: it squash-merges the session's branch back into the
// project and mines what it learned into proposals. A SHELL just closes — nothing is
// merged. The confirm dialog states which, so the ✕ never hides a merge behind a
// throwaway tap. Pure → tested; EndSessionDialog renders it.
import type { SessionType } from "#shared/index.js";

export interface EndSessionCopy {
  title: string;
  body: string;
  confirm: string;
  /** the in-flight button label while the daemon merges (agent) / closes (shell). */
  progress: string;
}

export function endSessionCopy(type: SessionType): EndSessionCopy {
  if (type === "agent") {
    return {
      title: "End this session?",
      body: "Your work on this session's branch will be squash-merged back into your project, and zuzuu will mine what it learned into proposals you can review.",
      confirm: "End session",
      progress: "Ending… merging your work",
    };
  }
  return {
    title: "End this shell session?",
    body: "This closes the shell. Nothing is merged — shell sessions don't grow the brain.",
    confirm: "End session",
    progress: "Ending…",
  };
}
