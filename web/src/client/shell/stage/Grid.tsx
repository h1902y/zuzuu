// shell/stage/Grid.tsx — the module stage: a module's notes as a table (R13). Renders
// the grid-columns core over the ListContext pull-model; a filter input + sortable
// headers drive the list-state reducer; clicking a row selects it (→ the record stage).
// Thin: all derivation is in grid-columns.ts / list-state.ts. Static utilities only.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NotesListProvider, useList } from "../../data/ListContext.js";
import { useModuleFilter, filterOf } from "../../state/module-filter.js";
import { useTableSelection, selectionFor, useClearSelectionOnQueryChange } from "../../state/table-selection.js";
import { gridColumns } from "./grid-columns.js";
import { NotesTable } from "./NotesTable.js";
import { statusFacets } from "./everything-model.js";
import { fieldsFromSchema } from "./schema-fields.js";
import { parseInputClause, mergeTableRows } from "./table-model.js";
import { useTableFilter } from "./use-table-filter.js";
import { ClauseChips } from "./ClauseChips.js";
import { FacetChip } from "./FacetChip.js";
import { TableBuilders } from "./TableBuilders.js";
import { TableFooter } from "./TableFooter.js";
import { FieldConfigPanel } from "./FieldConfigPanel.js";
import { toggleToolbarPopover, type ToolbarPopoverKey } from "./toolbar-popover-model.js";
import { emptyCopy } from "../empty-copy.js";
import { api } from "../../lib/api.js";
import { useWorld } from "../world-state.js";
import { noteOrFlowNav } from "../shell-state.js";
import { Table2, Plus } from "lucide-react";
import { Text, EmptyState, Button, Icon } from "../../ds/index.js";

function GridInner() {
  const { module, rows, total, loading, state, dispatch, staged } = useList();
  const select = useWorld((s) => s.select);
  const filterOps = useTableFilter(module, state, dispatch);
  const schema = useQuery({ queryKey: ["zuzuu", "schema", module], queryFn: () => api.zuzuu.schema(module) });
  // schema-aware (P2.2): declared module.md `fields` drive typed columns + ordering;
  // a schemaless module (no fields) falls back to inferred columns from the rows.
  const fields = fieldsFromSchema(schema.data?.schema);
  const cols = gridColumns(fields, rows);
  const statuses = statusFacets(rows, state.status);
  // U2 — the table's proposal register: `staged` is the SAME staged summaries the
  // review queue reads (this list's own `zz.module()` fetch — no new request);
  // merge them in as pending rows so a staged create/update is visible IN PLACE.
  const tableRows = mergeTableRows(rows, staged);
  // U4's toolbar-popover coordinator: ONE lifted slot for "which toolbar popover
  // is open" — Filter/Group/Sort (TableBuilders' own trio) vs. the separate
  // "+ column" FieldConfigPanel are siblings in this same toolbar row, so opening
  // one must close whichever other was open (toggleToolbarPopover, pure).
  const [openPopover, setOpenPopover] = useState<ToolbarPopoverKey | null>(null);

  // §H.3.4: selection lives OUTSIDE the table (the omnibar's context, not chrome);
  // toggle carries the row so the omnibar's export verb has the data without a
  // second fetch.
  const selected = useTableSelection((s) => selectionFor(s, module));
  const toggleSelection = useTableSelection((s) => s.toggle);
  const onSelectionToggle = (addr: string) => {
    const [, id] = addr.split(":");
    toggleSelection(module, addr, id ? rows.find((r) => r.id === id) : undefined);
  };
  // S2: a selection made under one filter/page/sort — or in a different module —
  // must not survive into a different one (the omnibar's verbs would silently act
  // on rows no longer in view).
  useClearSelectionOnQueryChange(module, state.text, state.kind, state.status, state.where, state.sort?.key, state.sort?.dir, state.page);

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
    if (el) el.scrollTop = filterOf(useModuleFilter.getState().byModule, module).scrollTop;
    return () => { if (el) useModuleFilter.getState().patch(module, { scrollTop: el.scrollTop }); };
  }, [module]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-3">
        <input
          value={state.text}
          onChange={(e) => filterOps.setText(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder={`filter ${module}… (or key=value, #tag)`}
          className="w-72 rounded-ui border border-border bg-app px-2 py-1 text-ui text-ink-100 outline-none placeholder:text-muted focus:border-accent-dim"
        />
        <TableBuilders cols={cols} state={state} filterOps={filterOps} dispatch={dispatch} open={openPopover} onOpenChange={setOpenPopover} />
        {/* §H.5: "+ column" — single-module scope only (a schema column has no
            single home in the unified Everything view). Add mode, anchored. */}
        <div className="relative ml-auto">
          <Button variant="ghost" size="sm" onClick={() => setOpenPopover((cur) => toggleToolbarPopover(cur, "column"))}>
            <Icon icon={Plus} size={13} /> Column
          </Button>
          {openPopover === "column" && (
            <FieldConfigPanel
              module={module}
              field={null}
              existingNames={fields.map((f) => f.name)}
              onClose={() => setOpenPopover(null)}
              align="right"
            />
          )}
        </div>
      </div>
      {statuses.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface px-6 py-2">
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
            cols={cols}
            rows={tableRows}
            sort={state.sort}
            onSort={(key) => dispatch({ type: "toggleSort", key })}
            // §I rung 5: a workflow-typed row focuses Flow instead of the Record stage
            onRow={(row) => select(noteOrFlowNav(module, row.id, row.kind === "workflow", "row"))}
            onChipClick={filterOps.addWhere}
            groupBy={state.groupBy}
            selection={{ selected, toggle: onSelectionToggle }}
            fields={fields}
            module={module}
          />
        )}
      </div>
      <TableFooter total={total} rows={rows} cols={cols} />
    </div>
  );
}

export function Grid({ module }: { module: string }) {
  // seed the list from the shared module filter — a Table⇄Map round trip (or a
  // stage remount) keeps the lens the user set
  const filter = useModuleFilter((s) => filterOf(s.byModule, module));
  return (
    <NotesListProvider module={module} initial={{ text: filter.text, kind: filter.kind }}>
      <GridInner />
    </NotesListProvider>
  );
}
