// shell-state.ts — the Stage+Wings shell's core selection logic (pure; tested).
// One model maps the selected nav node → the stage actor + the wing actor + the
// breadcrumb (the "selection → actor" morph, R3/R4), plus the concurrency rule
// (most-recently-active session owns the single stage, R6) and the ambient ribbon
// state (R5). No modes — sessions and modules are sibling node-types in one tree.
// Logic-in-.ts (the project's pattern); the <WorkbenchShell> .tsx renders this.

/** What the center stage shows. (ER is deferred — not a stage actor yet.)
 *  §D: `overview` and `settings` retired as stages — the needs-me HUD pill +
 *  the greeting absorbed the Overview; Settings is a footer-opened dialog.
 *  `flow` is the third projection (§I rung 5) — a workflow note's steps as a
 *  DAG, with its runs overlaid live; read-only (no canvas edits, no run control
 *  this pass — see docs/guide/Flow-View.md). */
export type StageActor = "world" | "terminal" | "grid" | "everything" | "record" | "search" | "acp" | "flow";
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
  | { kind: "acp"; id: string } // an ACP drive-lane agent session (structured conversation)
  // §I rung 5 — the Flow projection: `module`+`id` focus one workflow's DAG +
  // runs; both absent = Flow HOME (the workflow picker).
  | { kind: "flow"; module?: string; id?: string };

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
    // Flow: focused (module+id) shows that workflow's DAG; otherwise the picker.
    // No wing — the DAG/run overlay IS the reading surface (mirrors the map).
    case "flow": return { stage: "flow", wing: "none", crumb: node.module && node.id ? ["Flow", node.module, node.id] : ["Flow"] };
    // §D deep-link compat: the retired screens land on the map — the HUD pill
    // carries the Overview's signal; Settings opens as a dialog (its own store).
    case "settings": return { stage: "world", wing: "none", crumb: [] };
    case "overview": return { stage: "world", wing: "none", crumb: [] };
    default: return { stage: "world", wing: "none", crumb: [] };
  }
}

/** Selecting a workflow note anywhere (map or table) focuses Flow on it instead
 *  of the ordinary note/row selection (§I rung 5) — a workflow's DAG is a more
 *  useful reading than its flat frontmatter. `asNote` is which NavNode kind the
 *  caller would otherwise produce for a NON-workflow note (World's map click
 *  keeps the World as the stage and opens the record as the wing — `"note"`;
 *  Grid/Everything's row click opens the full Record stage — `"row"`). */
export function noteOrFlowNav(module: string, id: string, isWorkflow: boolean, asNote: "note" | "row"): NavNode {
  if (isWorkflow) return { kind: "flow", module, id };
  return asNote === "note" ? { kind: "note", id, module } : { kind: "row", id, module };
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
  /** true = the calm "all caught up" state (R5) — requires BOTH nothing
   *  pending AND setup being done. A false claim otherwise (bug: the ribbon
   *  used to say "all caught up" while the 3 setup rungs were still
   *  pending, just because the proposal queue happened to be empty). */
  allCaughtUp: boolean;
}

/** The ambient gate signal (R5): live-session count + total pending proposals,
 *  honest-gated by `setupIncomplete` (a setup rung — git-init/init/enable —
 *  still pending) so the calm state can never lie mid-onboarding. */
export function ribbonState(
  sessions: SessionLite[],
  pendingByModule: Record<string, number>,
  setupIncomplete = false,
): RibbonState {
  const liveness = sessions.filter((s) => s.live).length;
  const pending = Object.values(pendingByModule).reduce((n, v) => n + v, 0);
  return { liveness, pending, allCaughtUp: pending === 0 && !setupIncomplete };
}

/** U5 (curried-plotting-coral.md) — the shell's Escape handler no longer hardcodes
 *  a review→settings→world-selection priority cascade: every overlay now owns its
 *  own Escape via `useDismiss`, guarded by the shared overlay stack's topmost check
 *  (Settings' Dialog since U3; the Review overlay's own registration as of U5).
 *  This predicate is the ONE thing left for the shell's OWN Escape to decide —
 *  whether to clear the map/world selection — and it must say yes ONLY when
 *  nothing is shadowing it: an empty overlay stack means no overlay is open to
 *  consume the keypress first; a non-empty one means some overlay is topmost and
 *  its own `useDismiss` registration already owns this Escape, so the shell must
 *  stay out of its way entirely. */
export function shouldClearWorldSelectionOnEscape(overlayStackSize: number, hasSelection: boolean): boolean {
  return overlayStackSize === 0 && hasSelection;
}
