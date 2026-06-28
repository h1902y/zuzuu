// shell/stage/stage-header.ts — the pure model behind the governed stage-header (P2.1).
// A consistent header above every stage: the breadcrumb, an optional tab strip (the
// extension point P2.7's Table·Graph + P2.8's Terminal·Changes hang off), and the
// stage's primary action. Derived from the selection; pure → tested, the .tsx renders.
import type { NavNode } from "../shell-state.js";

/** One tab in the stage's tab strip (filled by the per-stage surfaces). */
export interface StageTab {
  key: string;
  label: string;
}

/** The stage's primary action — `key` is interpreted by the shell (e.g. "new-note").
 *  null = no primary for this stage. */
export interface StagePrimary {
  key: string;
  label: string;
}

export interface StageHeaderModel {
  /** false for the Overview (its own surface carries identity) — the header retracts. */
  show: boolean;
  primary: StagePrimary | null;
}

/** The selection → header morph. Overview shows no governed header (it's the home
 *  base); a module offers "New note" (a create → a PENDING proposal); a session
 *  offers "End session" (the canonical end affordance — where you work); a row shows
 *  the header (breadcrumb + tabs) but no primary — the Form wing is its editor. */
export function stageHeaderModel(node: NavNode | null): StageHeaderModel {
  switch (node?.kind) {
    case "module":
      return { show: true, primary: { key: "new-note", label: "New note" } };
    case "session":
      return { show: true, primary: { key: "end-session", label: "End session" } };
    case "row":
      return { show: true, primary: null };
    default:
      return { show: false, primary: null };
  }
}

/** Clamp a requested tab key to the available set; falls back to the first tab (or
 *  undefined when there are no tabs). Keeps a stale/absent tab from rendering blank. */
export function resolveTab(tabs: StageTab[], requested: string | undefined): string | undefined {
  if (!tabs.length) return undefined;
  return tabs.some((t) => t.key === requested) ? requested : tabs[0]!.key;
}

/** A fresh, filesystem-safe note id for "New note" (a create → a PENDING proposal).
 *  `seed` is injected (timestamp/counter) so the function stays pure + testable. */
export function newNoteId(seed: number): string {
  return `note-${seed.toString(36)}`;
}
