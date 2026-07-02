// shell/stage/Grid.tsx — the module stage: a module's notes as a table (R13). Renders
// the grid-columns core over the ListContext pull-model; a filter input + sortable
// headers drive the list-state reducer; clicking a row selects it (→ the record stage).
// Thin: all derivation is in grid-columns.ts / list-state.ts. Static utilities only.
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { NotesListProvider, useList } from "../../data/ListContext.js";
import { useModuleFilter, filterOf } from "../../state/module-filter.js";
import { gridColumns } from "./grid-columns.js";
import { NotesTable } from "./NotesTable.js";
import { statusFacets } from "./everything-model.js";
import { fieldsFromSchema } from "./schema-fields.js";
import { parseInputClause } from "./table-model.js";
import { useTableFilter } from "./use-table-filter.js";
import { ClauseChips } from "./ClauseChips.js";
import { FacetChip } from "./FacetChip.js";
import { emptyCopy } from "../empty-copy.js";
import { api } from "../../lib/api.js";
import { useWorld } from "../world-state.js";
import { Table2 } from "lucide-react";
import { Text, EmptyState } from "../../ds/index.js";

function GridInner() {
  const { module, rows, total, loading, state, dispatch } = useList();
  const select = useWorld((s) => s.select);
  const filterOps = useTableFilter(module, state, dispatch);
  const schema = useQuery({ queryKey: ["zuzuu", "schema", module], queryFn: () => api.zuzuu.schema(module) });
  // schema-aware (P2.2): declared module.md `fields` drive typed columns + ordering;
  // a schemaless module (no fields) falls back to inferred columns from the rows.
  const cols = gridColumns(fieldsFromSchema(schema.data?.schema), rows);
  const statuses = statusFacets(rows, state.status);

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
        <Text size="meta" tone="muted">{total} {total === 1 ? "row" : "rows"}</Text>
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
        ) : !rows.length ? (
          <EmptyState icon={Table2} {...emptyCopy(state.text ? "grid-filter" : "grid-empty")} />
        ) : (
          <NotesTable
            cols={cols}
            rows={rows}
            sort={state.sort}
            onSort={(key) => dispatch({ type: "toggleSort", key })}
            onRow={(row) => select({ kind: "row", id: row.id, module })}
            onChipClick={filterOps.addWhere}
          />
        )}
      </div>
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
