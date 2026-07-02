// shell/stage/Everything.tsx — the UNIFIED table: one grid over every module.
// Module is a COLUMN (an island color dot + name), not a sidebar silo; the module
// facet narrows the same list the per-module grid serves (the provider routes the
// '' scope to /api/zuzuu/items). The filter lives in the shared module-filter
// store under the '' scope, so T flips this table into the full World with the
// same lens spotlighted across all islands — one space, two projections.
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table2 } from "lucide-react";
import { NotesListProvider, useList } from "../../data/ListContext.js";
import { useModuleFilter, filterOf } from "../../state/module-filter.js";
import { modulePalette } from "../../world/model.js";
import { EVERYTHING_COLUMNS, moduleFacets, typeFacets, toggleFacet } from "./everything-model.js";
import { NotesTable } from "./NotesTable.js";
import { emptyCopy } from "../empty-copy.js";
import { api } from "../../lib/api.js";
import { useWorld } from "../world-state.js";
import { Text, EmptyState } from "../../ds/index.js";

// the island's identity dot — SVG fill ATTRIBUTE (the same mechanism the world
// engine paints module identity with; inline styling is banned in shell/, and a
// data-driven hue is identity, not a style choice)
function ModuleDot({ color }: { color?: string }) {
  return (
    <svg aria-hidden width="8" height="8" className="shrink-0">
      <circle cx="4" cy="4" r="4" fill={color ?? "currentColor"} />
    </svg>
  );
}

function FacetChip({ label, active, dot, onClick }: { label: string; active: boolean; dot?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-ui border px-2 py-0.5 text-meta transition-colors ${active ? "border-accent-dim bg-selected text-ink-100" : "border-border bg-app text-subtle hover:bg-hover hover:text-ink-100"}`}
    >
      {dot && <ModuleDot color={dot} />}
      {label}
    </button>
  );
}

function EverythingInner({ moduleFacet, onModuleFacet }: { moduleFacet: string; onModuleFacet: (m: string) => void }) {
  const { rows, total, loading, state, dispatch } = useList();
  const select = useWorld((s) => s.select);
  const patchFilter = useModuleFilter((s) => s.patch);
  const overview = useQuery({ queryKey: ["zuzuu", "overview"], queryFn: api.zuzuu.overview });
  const modules = overview.data?.modules ?? [];
  const palette = modulePalette(modules.map((m) => m.id));

  // every lens change mirrors to the SHARED '' scope so the Map projection
  // spotlights the same subset (Table⇄Map is one space)
  const setText = (text: string) => {
    dispatch({ type: "setText", text });
    patchFilter("", { text });
  };
  const setKind = (kind: string) => {
    dispatch({ type: "setKind", kind });
    patchFilter("", { kind });
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-3">
        <input
          value={state.text}
          onChange={(e) => setText(e.target.value)}
          placeholder="filter everything…"
          className="w-64 rounded-ui border border-border bg-app px-2 py-1 text-ui text-ink-100 outline-none placeholder:text-muted focus:border-accent-dim"
        />
        <Text size="meta" tone="muted">{total} {total === 1 ? "row" : "rows"}</Text>
      </div>
      {(modules.length > 1 || rows.length > 0) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface px-6 py-2">
          {moduleFacets(modules, moduleFacet).map((f) => (
            <FacetChip key={`m:${f.value}`} label={f.value} active={f.active} dot={palette[f.value]} onClick={() => onModuleFacet(toggleFacet(moduleFacet, f.value))} />
          ))}
          {typeFacets(rows, state.kind).length > 0 && <span aria-hidden className="mx-1 h-4 w-px bg-border" />}
          {typeFacets(rows, state.kind).map((f) => (
            <FacetChip key={`t:${f.value}`} label={f.value} active={f.active} onClick={() => setKind(toggleFacet(state.kind, f.value))} />
          ))}
        </div>
      )}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="grid h-full place-items-center"><Text tone="muted">loading…</Text></div>
        ) : !rows.length ? (
          <EmptyState icon={Table2} {...emptyCopy(state.text ? "grid-filter" : "grid-empty")} />
        ) : (
          <NotesTable
            cols={EVERYTHING_COLUMNS}
            rows={rows}
            sort={state.sort}
            onSort={(key) => dispatch({ type: "toggleSort", key })}
            onRow={(row) => select({ kind: "row", id: row.id, module: row.module })}
            renderCell={renderCell}
          />
        )}
      </div>
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
