// shell/stage/Grid.tsx — the module stage: a module's notes as a table (R13). Renders
// the grid-columns core over the ListContext pull-model; a filter input + sortable
// headers drive the list-state reducer; clicking a row selects it (→ the record stage).
// Thin: all derivation is in grid-columns.ts / list-state.ts. Static utilities only.
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { NotesListProvider, useList } from "../../data/ListContext.js";
import { useModuleFilter, filterOf } from "../../state/module-filter.js";
import { gridColumns, cellValue } from "./grid-columns.js";
import { fieldsFromSchema } from "./schema-fields.js";
import { emptyCopy } from "../empty-copy.js";
import { api } from "../../lib/api.js";
import { useWorld } from "../world-state.js";
import { Table2 } from "lucide-react";
import { Text, EmptyState } from "../../ds/index.js";

function GridInner() {
  const { module, rows, total, loading, state, dispatch } = useList();
  const select = useWorld((s) => s.select);
  const patchFilter = useModuleFilter((s) => s.patch);
  const schema = useQuery({ queryKey: ["zuzuu", "schema", module], queryFn: () => api.zuzuu.schema(module) });
  // schema-aware (P2.2): declared module.md `fields` drive typed columns + ordering;
  // a schemaless module (no fields) falls back to inferred columns from the rows.
  const cols = gridColumns(fieldsFromSchema(schema.data?.schema), rows);

  // the filter is the module's LENS, not a grid detail: every change mirrors to
  // the shared store so the Map projection spotlights the same subset (Table⇄Map
  // is one space); scroll position survives a projection round-trip the same way.
  const setText = (text: string) => {
    dispatch({ type: "setText", text });
    patchFilter(module, { text });
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
          onChange={(e) => setText(e.target.value)}
          placeholder={`filter ${module}…`}
          className="w-64 rounded-ui border border-border bg-app px-2 py-1 text-ui text-ink-100 outline-none placeholder:text-muted focus:border-accent-dim"
        />
        <Text size="meta" tone="muted">{total} {total === 1 ? "row" : "rows"}</Text>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="grid h-full place-items-center"><Text tone="muted">loading…</Text></div>
        ) : !rows.length ? (
          <EmptyState icon={Table2} {...emptyCopy(state.text ? "grid-filter" : "grid-empty")} />
        ) : (
          <table className="w-full border-collapse text-ui">
            <thead>
              <tr className="border-b border-border">
                {cols.map((c) => (
                  <th key={c.name} className={`px-6 py-3 ${c.align === "right" ? "text-right" : "text-left"}`}>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "toggleSort", key: c.name })}
                      className="text-meta font-semibold text-subtle transition-colors hover:text-ink-100"
                    >
                      {c.label}{state.sort?.key === c.name ? (state.sort.dir === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => select({ kind: "row", id: row.id, module })}
                  className="cursor-pointer border-b border-border transition-colors hover:bg-hover"
                >
                  {cols.map((c) => (
                    <td key={c.name} className={`max-w-xs truncate px-6 py-3 text-subtle ${c.align === "right" ? "text-right" : "text-left"}`}>
                      {cellValue(row, c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
