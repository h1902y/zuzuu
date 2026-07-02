// shell/stage/flow-switch.ts — the Flow toggle's pure targeting logic. The header's
// [Table · Map · Flow] toggle (and the `>flow` palette command) need to answer two
// questions without touching the DOM: is Flow available at all (does the project
// HAVE workflow notes), and where should clicking it land — the workflow already
// in context (selecting a workflow note anywhere focuses Flow on it), or Flow HOME
// (the picker) otherwise. Mirrors projection-switch.ts's discipline: pure, tested;
// WorkbenchShell/ProjectionToggle just render this.
import type { NavNode } from "../shell-state.js";

export interface FlowTarget { module: string; id: string }

/** Where the Flow toggle/palette should navigate FROM the current selection:
 *  - already viewing a workflow's Flow → stay there (keeps the toggle "active"
 *    reading truthful rather than bouncing back to the picker on every click).
 *  - a note/row selection IS a known workflow (its addr rides `workflowAddrs`,
 *    from GET /api/zuzuu/flow) → focus Flow on it directly (map/table selection
 *    of a workflow note focuses Flow — the brief's own wording).
 *  - anything else → null = Flow HOME (the picker lists every workflow). */
export function flowTarget(selected: NavNode | null, workflowAddrs: ReadonlySet<string>): FlowTarget | null {
  if (selected?.kind === "flow" && selected.module && selected.id) return { module: selected.module, id: selected.id };
  if ((selected?.kind === "note" || selected?.kind === "row") && workflowAddrs.has(`${selected.module}:${selected.id}`)) {
    return { module: selected.module, id: selected.id };
  }
  return null;
}

/** Is the currently-selected note ITSELF a known workflow? (World/Table click
 *  routing: "selecting a workflow note anywhere → Flow view focuses it".) */
export function isWorkflowAddr(module: string, id: string, workflowAddrs: ReadonlySet<string>): boolean {
  return workflowAddrs.has(`${module}:${id}`);
}
