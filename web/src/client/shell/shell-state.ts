// shell-state.ts — the Stage+Wings shell's core selection logic (pure; tested).
// One model maps the selected nav node → the stage actor + the wing actor + the
// breadcrumb (the "selection → actor" morph, R3/R4), plus the concurrency rule
// (most-recently-active session owns the single stage, R6) and the ambient ribbon
// state (R5). No modes — sessions and modules are sibling node-types in one tree.
// Logic-in-.ts (the project's pattern); the <WorkbenchShell> .tsx renders this.

/** What the center stage shows. (ER is deferred — not a stage actor yet.) */
export type StageActor = "terminal" | "grid" | "record" | "overview" | "search" | "settings" | "acp";
/** What the right wing shows; "none" = the wing retracts (R4). */
export type WingActor = "review" | "form" | "schema" | "none";

/** A nav-tree node. Sessions and modules are siblings; a row is a note in a module;
 *  search/settings are the whole-Project surfaces. (Search is reached via ⌘K, not the
 *  rail — U4; the top-level graph was demoted to the per-module Table·Graph tab — U2.) */
export type NavNode =
  | { kind: "session"; id: string }
  | { kind: "module"; id: string }
  | { kind: "row"; id: string; module: string }
  | { kind: "overview" }
  | { kind: "search"; query?: string }
  | { kind: "settings" }
  | { kind: "acp"; id: string }; // an ACP drive-lane agent session (structured conversation)

export interface Selection {
  stage: StageActor;
  wing: WingActor;
  /** breadcrumb segments ("your one location"); empty = home (the database). */
  crumb: string[];
}

/** The selection → actor morph. A null/unknown selection is home = the database (R3). */
export function selectActors(node: NavNode | null): Selection {
  switch (node?.kind) {
    case "session": return { stage: "terminal", wing: "review", crumb: ["session", node.id] };
    case "module": return { stage: "grid", wing: "schema", crumb: [node.id] };
    case "row": return { stage: "record", wing: "form", crumb: [node.module, node.id] };
    case "search": return { stage: "search", wing: "none", crumb: ["Search"] };
    case "settings": return { stage: "settings", wing: "none", crumb: ["Settings"] };
    case "acp": return { stage: "acp", wing: "none", crumb: ["Agent", node.id.slice(0, 6)] };
    case "overview":
    default: return { stage: "overview", wing: "none", crumb: [] };
  }
}

export interface SessionLite { id: string; live?: boolean; lastActiveAt?: number }

/** Which live session owns the single stage (R6): the most-recently-active. Others
 *  render as dots in the nav. Null when nothing is live. */
export function mostRecentlyActive(sessions: SessionLite[]): string | null {
  const live = sessions.filter((s) => s.live);
  if (!live.length) return null;
  return live.reduce((a, b) => ((b.lastActiveAt ?? 0) > (a.lastActiveAt ?? 0) ? b : a)).id;
}

export interface RibbonState {
  liveness: number;
  pending: number;
  /** true = the calm "all caught up" state (R5). */
  allCaughtUp: boolean;
}

/** The ambient gate signal (R5): live-session count + total pending proposals. */
export function ribbonState(sessions: SessionLite[], pendingByModule: Record<string, number>): RibbonState {
  const liveness = sessions.filter((s) => s.live).length;
  const pending = Object.values(pendingByModule).reduce((n, v) => n + v, 0);
  return { liveness, pending, allCaughtUp: pending === 0 };
}
