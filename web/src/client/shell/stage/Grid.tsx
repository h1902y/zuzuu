// shell/stage/Grid.tsx — the module stage: a module's notes as a table (R13). Renders
// the grid-columns core over the ListContext pull-model; a filter input + sortable
// headers drive the list-state reducer; clicking a row selects it (→ the record stage).
// Thin: all derivation is in grid-columns.ts / list-state.ts. Static utilities only.
import { NotesListProvider, useList } from "../../data/ListContext.js";
import { gridColumns, cellValue } from "./grid-columns.js";
import { useWorld } from "../world-state.js";
import { Text } from "../../ds/index.js";

function GridInner() {
  const { module, rows, total, loading, state, dispatch } = useList();
  const select = useWorld((s) => s.select);
  const cols = gridColumns([], rows); // schemaless inference for v1 (declared fields → T2.5)

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-3">
        <input
          value={state.text}
          onChange={(e) => dispatch({ type: "setText", text: e.target.value })}
          placeholder={`filter ${module}…`}
          className="w-64 rounded-ui border border-border bg-app px-2 py-1 text-ui text-ink-100 outline-none placeholder:text-muted focus:border-accent-dim"
        />
        <Text size="meta" tone="muted">{total} {total === 1 ? "row" : "rows"}</Text>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="grid h-full place-items-center"><Text tone="muted">loading…</Text></div>
        ) : !rows.length ? (
          <div className="grid h-full place-items-center"><Text tone="muted">{state.text ? "no matching rows" : "no rows yet"}</Text></div>
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
  return (
    <NotesListProvider module={module}>
      <GridInner />
    </NotesListProvider>
  );
}
