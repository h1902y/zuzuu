// shell/stage/use-table-filter.ts — the toolbar's ONE write surface (§H.3.1). Every
// clause mutation — the typed input's Enter, a clicked attribute chip (§H.2), and the
// [Filter]/[Group]/[Sort] builder panels (§H.4.3) — goes through these calls, so the
// three entry points provably share one grammar/one state. `where`/text/kind mirror
// into the shared module-filter store (Table⇄Map stays one space, §C); status is a
// table-local facet axis the map spotlight doesn't consume.
import type { Dispatch } from "react";
import type { ListAction, ListState } from "../../data/list-state.js";
import { useModuleFilter } from "../../state/module-filter.js";

export interface TableFilterOps {
  setText: (text: string) => void;
  setKind: (kind: string) => void;
  setStatus: (status: string) => void;
  addWhere: (clause: string) => void;
  removeWhere: (clause: string) => void;
}

/** `scope` keys the shared module-filter store — a real module id for the per-module
 *  Grid, `""` for the unified Everything table (its facet-cleared scope). */
export function useTableFilter(scope: string, state: ListState, dispatch: Dispatch<ListAction>): TableFilterOps {
  const patch = useModuleFilter((s) => s.patch);
  return {
    setText: (text) => { dispatch({ type: "setText", text }); patch(scope, { text }); },
    setKind: (kind) => { dispatch({ type: "setKind", kind }); patch(scope, { kind }); },
    setStatus: (status) => dispatch({ type: "setStatus", status }),
    addWhere: (clause) => {
      if (state.where.includes(clause)) return;
      dispatch({ type: "addWhere", clause });
      patch(scope, { where: [...state.where, clause] });
    },
    removeWhere: (clause) => {
      dispatch({ type: "removeWhere", clause });
      patch(scope, { where: state.where.filter((w) => w !== clause) });
    },
  };
}
