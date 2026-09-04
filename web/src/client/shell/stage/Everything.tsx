// shell/stage/Everything.tsx — the UNIFIED table: one grid over every module.
// Module is a COLUMN (an island color dot + name), not a sidebar silo; the module
// facet narrows the same list the per-module grid serves (the provider routes the
// '' scope to /api/zuzuu/items). The filter lives in the shared module-filter
// store under the '' scope, so T flips this table into the full World with the
// same lens spotlighted across all islands — one space, two projections.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table2 } from "lucide-react";
import { NotesListProvider, useList } from "../../data/ListContext.js";
import { useModuleFilter, filterOf } from "../../state/module-filter.js";
import { useTableSelection, selectionFor, EVERYTHING_SELECTION_SCOPE, useClearSelectionOnQueryChange } from "../../state/table-selection.js";
import { modulePalette } from "../../world/model.js";
import { EVERYTHING_COLUMNS, moduleFacets, typeFacets, statusFacets, toggleFacet } from "./everything-model.js";
import { parseInputClause, mergeTableRows } from "./table-model.js";
import { type ToolbarPopoverKey } from "./toolbar-popover-model.js";
import { useTableFilter } from "./use-table-filter.js";
import { ClauseChips } from "./ClauseChips.js";
import { ModuleDot, FacetChip } from "./FacetChip.js";
import { TableBuilders } from "./TableBuilders.js";
import { TableFooter } from "./TableFooter.js";
import { NotesTable } from "./NotesTable.js";
import { emptyCopy } from "../empty-copy.js";
import { api } from "../../lib/api.js";
import { useWorld } from "../world-state.js";
import { noteOrFlowNav } from "../shell-state.js";
import { Text, EmptyState } from "../../ds/index.js";

function EverythingInner({ moduleFacet, onModuleFacet }: { moduleFacet: string; onModuleFacet: (m: string) => void }) {
  const { rows, total, loading, state, dispatch, staged } = useList();
  const select = useWorld((s) => s.select);
  const filterOps = useTableFilter("", state, dispatch);
  const overview = useQuery({ queryKey: ["zuzuu", "overview"], queryFn: api.zuzuu.overview });
  const modules = overview.data?.modules ?? [];
  const palette = modulePalette(modules.map((m) => m.id));
  // U2 — the proposal register, wired the same way Grid.tsx does (mergeTableRows
  // over ListContext's own `staged`). FLAGGED GAP: unlike the per-module route,
  // the daemon's `/api/zuzuu/items` (the unified fetch this scope uses) hardcodes
  // `staged: []` today (zuzuu-read.ts) — a server-side omission outside this
  // pass's web/src/client/ scope. `staged` is wired through anyway so Everything
  // gets pending rows for free the moment that route is fixed; until then this
  // view shows none (Grid.tsx's per-module table already does).
  const tableRows = mergeTableRows(rows, staged);
  // U4's toolbar-popover coordinator slot (toolbar-popover-model.ts) — Everything
  // has no separate "+ column" popover today (a schema column has no single home
  // in the unified view), but TableBuilders is now a controlled component, so
  // this view holds the same lifted state Grid.tsx does for its Filter/Group/Sort
  // trio (which is already self-exclusive within TableBuilders).
  const [openPopover, setOpenPopover] = useState<ToolbarPopoverKey | null>(null);

  // the typed input speaks the CLI's own grammar (§H.3.1): free text live-filters
  // via FTS as you type; Enter on a `key<op>value`/`#tag` shape commits it as a
  // dismissible where clause instead (parseInputClause tells the two apart).
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const parsed = parseInputClause(state.text);
    if (parsed?.kind === "where") { filterOps.addWhere(parsed.clause); filterOps.setText(""); }
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = filterOf(useModuleFilter.getState().byModule, "").scrollTop;
    return () => { if (el) useModuleFilter.getState().patch("", { scrollTop: el.scrollTop }); };
  }, []);

  // the module cell: the island's color dot + the name — the world's identity
  // system, carried into the table (same module, same hue, everywhere)
  const renderCell = (row: { module: string }, col: { name: string }) =>
    col.name === "module" ? (
      <span className="inline-flex items-center gap-1.5">
        <ModuleDot color={palette[row.module]} />
        {row.module}
      </span>
    ) : undefined;

  const statuses = statusFacets(rows, state.status);

  // §H.3.4: selection lives OUTSIDE the table; a row's addr is `module:id` here
  // since Everything spans modules, so the lookup keys on the addr, not just id.
  const selected = useTableSelection((s) => selectionFor(s, EVERYTHING_SELECTION_SCOPE));
  const toggleSelection = useTableSelection((s) => s.toggle);
  const onSelectionToggle = (addr: string) =>
    toggleSelection(EVERYTHING_SELECTION_SCOPE, addr, rows.find((r) => `${r.module}:${r.id}` === addr));
  // S2: same guard as the per-module Grid — a selection made under one filter/page/
  // sort (or module facet) must not survive into a different one.
  useClearSelectionOnQueryChange(EVERYTHING_SELECTION_SCOPE, state.text, state.kind, state.status, state.where, state.sort?.key, state.sort?.dir, state.page);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-3">
        <input
          value={state.text}
          onChange={(e) => filterOps.setText(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder="filter everything… (or key=value, #tag)"
          className="w-72 rounded-ui border border-border bg-app px-2 py-1 text-ui text-ink-100 outline-none placeholder:text-muted focus:border-accent-dim"
        />
        <TableBuilders cols={EVERYTHING_COLUMNS} state={state} filterOps={filterOps} dispatch={dispatch} open={openPopover} onOpenChange={setOpenPopover} />
      </div>
      {(modules.length > 1 || rows.length > 0) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface px-6 py-2">
          {moduleFacets(modules, moduleFacet).map((f) => (
            <FacetChip key={`m:${f.value}`} label={f.value} active={f.active} dot={palette[f.value]} onClick={() => onModuleFacet(toggleFacet(moduleFacet, f.value))} />
          ))}
          {typeFacets(rows, state.kind).length > 0 && <span aria-hidden className="mx-1 h-4 w-px bg-border" />}
          {typeFacets(rows, state.kind).map((f) => (
            <FacetChip key={`t:${f.value}`} label={f.value} active={f.active} onClick={() => filterOps.setKind(toggleFacet(state.kind, f.value))} />
          ))}
          {statuses.length > 0 && <span aria-hidden className="mx-1 h-4 w-px bg-border" />}
          {statuses.map((f) => (
            <FacetChip key={`s:${f.value}`} label={f.value} active={f.active} onClick={() => filterOps.setStatus(f.active ? "" : f.value)} />
          ))}
        </div>
      )}
      <ClauseChips text={state.text} where={state.where} onClearText={() => filterOps.setText("")} onRemoveWhere={filterOps.removeWhere} />
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="grid h-full place-items-center"><Text tone="muted">loading…</Text></div>
        ) : !tableRows.length ? (
          <EmptyState icon={Table2} {...emptyCopy(state.text ? "grid-filter" : "grid-empty")} />
        ) : (
          <NotesTable
            cols={EVERYTHING_COLUMNS}
            rows={tableRows}
            sort={state.sort}
            onSort={(key) => dispatch({ type: "toggleSort", key })}
            // §I rung 5: a workflow-typed row focuses Flow instead of the Record stage
            onRow={(row) => select(noteOrFlowNav(row.module, row.id, row.kind === "workflow", "row"))}
            renderCell={renderCell}
            onChipClick={filterOps.addWhere}
            groupBy={state.groupBy}
            selection={{ selected, toggle: onSelectionToggle }}
          />
        )}
      </div>
      <TableFooter total={total} rows={rows} cols={EVERYTHING_COLUMNS} />
    </div>
  );
}

export function Everything() {
  // the '' scope is the unified lens; its `module` field is the FACET — facet set
  // ⇒ the provider serves that module's route (same contract), facet clear ⇒ /items
  const filter = useModuleFilter((s) => filterOf(s.byModule, ""));
  const patch = useModuleFilter((s) => s.patch);
  return (
    <NotesListProvider
      key={filter.module || "__all__"}
      module={filter.module}
      initial={{ text: filter.text, kind: filter.kind }}
    >
      <EverythingInner moduleFacet={filter.module} onModuleFacet={(m) => patch("", { module: m })} />
    </NotesListProvider>
  );
}
