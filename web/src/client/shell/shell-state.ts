// shell-state.ts — the Stage+Wings shell's core selection logic (pure; tested).
// One model maps the selected nav node → the stage actor + the wing actor + the
// breadcrumb (the "selection → actor" morph, R3/R4), plus the concurrency rule
// (most-recently-active session owns the single stage, R6) and the ambient ribbon
// state (R5). No modes — sessions and modules are sibling node-types in one tree.
// Logic-in-.ts (the project's pattern); the <WorkbenchShell> .tsx renders this.

/** What the center stage shows. (ER is deferred — not a stage actor yet.)
 *  §D: `overview` and `settings` retired as stages — the needs-me HUD pill +
 *  the greeting absorbed the Overview; Settings is a footer-opened dialog. */
export type StageActor = "world" | "terminal" | "grid" | "everything" | "record" | "search" | "acp";
/** What the right wing shows; "none" = the wing retracts (R4). */
export type WingActor = "review" | "form" | "schema" | "none";

/** A nav-tree node. Sessions and modules are siblings; a row is a note in a module;
 *  search/settings are the whole-Project surfaces. (Search is reached via ⌘K, not the
 *  rail — U4; the top-level graph was demoted to the per-module Table·Graph tab — U2.)
 *  `note` is the MAP-first note selection (the World stays the stage, the record opens
 *  as the wing — reading never leaves the map); `row` remains the full Record stage. */
export type NavNode =
  | { kind: "session"; id: string }
  | { kind: "module"; id: string }
  | { kind: "everything" } // the UNIFIED table: one grid over every module (module = a column)
  | { kind: "row"; id: string; module: string }
  | { kind: "note"; id: string; module: string }
  | { kind: "draft"; module: string; seed?: string } // the New-note draft (form-first — audit item 3); seed = the adapter's pre-filled title (§E.3)
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

/** The selection → actor morph. A null/unknown selection is home = THE MAP (the
 *  World is the primary view of the Project — map-first, C1). The Overview stays
 *  one click away as an explicit node; onboarding still lands on it (the shell
 *  composes the checklist in — the map never takes over a first-run). */
export function selectActors(node: NavNode | null): Selection {
  switch (node?.kind) {
    case "session": return { stage: "terminal", wing: "review", crumb: ["session", node.id] };
    case "module": return { stage: "grid", wing: "schema", crumb: [node.id] };
    // one table over everything — module is a COLUMN here, not a silo
    case "everything": return { stage: "everything", wing: "none", crumb: ["Everything"] };
    case "row": return { stage: "record", wing: "form", crumb: [node.module, node.id] };
    // map-first reading: the World keeps the stage, the record opens as the wing
    case "note": return { stage: "world", wing: "form", crumb: [node.module, node.id] };
    // the New-note draft: the module's table stays the stage; the draft form is the wing
    case "draft": return { stage: "grid", wing: "form", crumb: [node.module, "new note"] };
    case "search": return { stage: "search", wing: "none", crumb: ["Search"] };
    case "acp": return { stage: "acp", wing: "none", crumb: ["Agent", node.id.slice(0, 6)] };
    // §D deep-link compat: the retired screens land on the map — the HUD pill
    // carries the Overview's signal; Settings opens as a dialog (its own store).
    case "settings": return { stage: "world", wing: "none", crumb: [] };
    case "overview": return { stage: "world", wing: "none", crumb: [] };
    default: return { stage: "world", wing: "none", crumb: [] };
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
