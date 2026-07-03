// shell/projection-switch.ts — the always-there PROJECTION SWITCHER model.
//
// The footer's twin of the stage-header's Table⇄Map control (which is in-context,
// on the module/Everything stages only). This one is visible on EVERY stage, so
// flipping projections is never keyboard-only — `T` and `>map`/`>table` stay as
// the power-user paths. Pure: the Ribbon renders it, WorkbenchShell applies it.
import type { NavNode } from "./shell-state.js";

/** A projection target — which scope shows in which view. scope null = the World
 *  home (the whole project's map); "" = Everything (the unified table / full world
 *  lens); "<id>" = that module's island/table. */
export interface ProjTarget { scope: string | null; view: "graph" | "table" }

export interface ProjectionSwitch {
  /** which segment reads active (null = neither — a record/session/search stage). */
  active: "map" | "table" | null;
  /** what clicking Map does · what clicking Table does. */
  map: ProjTarget;
  table: ProjTarget;
}

/**
 * Derive the switcher from the current selection + the resolved view of the
 * relevant scope (`viewOf(scope)` → 'graph'|'table' for a module or the '' scope).
 * Module context is preserved where it exists: from a module (table or map) both
 * targets stay that module; from a record, Map opens that island and Table its
 * table; on the World home, Map is active and Table opens Everything.
 */
export function projectionSwitch(
  selected: NavNode | null,
  viewOf: (scope: string) => "graph" | "table",
): ProjectionSwitch {
  switch (selected?.kind) {
    case "module": {
      const v = viewOf(selected.id);
      return { active: v === "graph" ? "map" : "table", map: { scope: selected.id, view: "graph" }, table: { scope: selected.id, view: "table" } };
    }
    case "everything": {
      const v = viewOf("");
      return { active: v === "graph" ? "map" : "table", map: { scope: "", view: "graph" }, table: { scope: "", view: "table" } };
    }
    case "row":
    case "note":
    case "draft":
      // a record within a module: Map → that island, Table → that module's table
      return { active: null, map: { scope: selected.module, view: "graph" }, table: { scope: selected.module, view: "table" } };
    case "session":
    case "search":
    case "acp":
      // no module context — Map is the World home, Table is Everything
      return { active: null, map: { scope: null, view: "graph" }, table: { scope: "", view: "table" } };
    default:
      // the World home (null selection): Map is where you are; Table opens Everything
      return { active: "map", map: { scope: null, view: "graph" }, table: { scope: "", view: "table" } };
  }
}
