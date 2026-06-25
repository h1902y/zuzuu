// shell/session/session-tabs.ts — the session stage's Terminal · Changes tabs (P2.8,
// via the P2.1 stage-header tab slot). Terminal is the work (the live transcript);
// Changes is what that work is proposing to the brain — the pending review queue,
// badged with the count. Pure → tested; WorkbenchShell renders the active tab.
import type { StageTab } from "../stage/stage-header.js";

/** The session tabs, with the Changes tab badged by the pending-proposal count. */
export function sessionTabs(pending: number): StageTab[] {
  return [
    { key: "terminal", label: "Terminal" },
    { key: "changes", label: pending > 0 ? `Changes · ${pending}` : "Changes" },
  ];
}
