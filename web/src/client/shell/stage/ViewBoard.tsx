// shell/stage/ViewBoard.tsx — U2 (live-views plan, docs/plans/2026-07-04-002):
// the live, READ-ONLY board stage. `{module, id}` name the `type:view` NOTE
// itself (wherever it lives); its `query` frontmatter names the module the
// board actually runs over (or falls back to the view note's own module, R1).
//
// Reuses the EXACT wiring Everything.tsx/Grid.tsx use — <NotesListProvider> +
// useList() over the SAME dataProvider.getList path, so the board is LIVE (R4)
// for free (react-query cache invalidation the rest of the shell already gets,
// no bespoke refetch wiring). <NotesTable> renders the grouped sections; R3's
// read-only contract holds by OMISSION, not a flag: `selection` and `module`
// are simply never passed (no checkboxes, no "Edit column" caret), and there is
// no `onChipClick` (an attribute chip renders inert — no filter-mutation
// affordance on a saved view). The one interaction left live is a column-header
// sort click — a display reorder via the list's own reducer, not a note write;
// it does not touch the moat.
//
// Thin by the project's own rule (web/CLAUDE.md, logic-in-.ts): every decision
// (fetch scope, the header's human query-summary, the R5 empty/error call) is
// view-board-model.ts; this file only fetches + renders.
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid } from "lucide-react";
import type { ModuleItem } from "#shared/index.js";
import { api } from "../../lib/api.js";
import { NotesListProvider, useList } from "../../data/ListContext.js";
import { fieldsFromSchema } from "./schema-fields.js";
import { gridColumns } from "./grid-columns.js";
import { NotesTable } from "./NotesTable.js";
import { viewFetchState, viewQuerySummary, classifyViewBoard, viewBoardCopy } from "./view-board-model.js";
import { useWorld } from "../world-state.js";
import { noteOrFlowNav } from "../shell-state.js";
import { Icon, Text, Inline, Loading, EmptyState } from "../../ds/index.js";

/** The bit of a `type:view` note this stage reads beyond the base envelope —
 *  its stored query (view-board-model.ts's `ViewNoteLike`, satisfied structurally). */
interface ViewNoteItem extends ModuleItem { query?: unknown }

/** The board's own header — icon · title · "board over <module>" · the human
 *  query-summary line (U2's required header shape). */
function ViewBoardHeader({ title, resolvedModule, summary }: { title: string; resolvedModule: string; summary: string }) {
  return (
    <div className="flex shrink-0 flex-col gap-0.5 border-b border-border px-6 py-3">
      <Inline gap="sm" align="center">
        <Icon icon={LayoutGrid} size={16} />
        <Text size="ui" weight="medium">{title}</Text>
      </Inline>
      <Text size="meta" tone="muted">board over {resolvedModule}</Text>
      <Text size="meta" tone="subtle">{summary}</Text>
    </div>
  );
}

/** Inside the provider: the query has already resolved a module scope, so this
 *  is where rows actually land (or don't) — the ONLY place classifyViewBoard
 *  runs, since it needs the fetched rows to tell "empty" from "ok". */
function ViewBoardTable({ note, title, resolvedModule, summary }: {
  note: ViewNoteItem | null;
  title: string;
  resolvedModule: string;
  summary: string;
}) {
  const { rows, loading, state, dispatch } = useList();
  const select = useWorld((s) => s.select);
  const schema = useQuery({ queryKey: ["zuzuu", "schema", resolvedModule], queryFn: () => api.zuzuu.schema(resolvedModule) });
  const fields = fieldsFromSchema(schema.data?.schema);
  const cols = gridColumns(fields, rows);

  if (loading) return <Loading label="loading board…" />;

  const status = classifyViewBoard({ note, rows });
  if (status !== "ok") {
    const copy = viewBoardCopy(status, resolvedModule);
    return (
      <div className="flex h-full flex-col">
        <ViewBoardHeader title={title} resolvedModule={resolvedModule} summary={summary} />
        <div className="min-h-0 flex-1"><EmptyState icon={LayoutGrid} title={copy.title} hint={copy.hint} /></div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ViewBoardHeader title={title} resolvedModule={resolvedModule} summary={summary} />
      <div className="min-h-0 flex-1 overflow-auto">
        <NotesTable
          cols={cols}
          rows={rows}
          sort={state.sort}
          onSort={(key) => dispatch({ type: "toggleSort", key })}
          // §I rung 5 precedent (Grid/Everything): a workflow-typed row still
          // focuses Flow, and (U3) a view-typed row still focuses another
          // ViewBoard — reading a row never changes surface behavior here.
          onRow={(row) => select(noteOrFlowNav(row.module, row.id, row.kind === "workflow", "row", row.kind === "view"))}
          groupBy={state.groupBy}
          // selection / module / onChipClick OMITTED — R3, read-only by construction:
          // no checkboxes, no "Edit column" caret, no chip→filter mutation.
        />
      </div>
    </div>
  );
}

/** The ViewBoard stage: `module`/`id` address the `type:view` note. Not yet
 *  mounted anywhere (U3 wires `type:view` routing to this component next) —
 *  exported clean so that wiring is a one-line stage-dispatch addition. */
export function ViewBoard({ module, id }: { module: string; id: string }) {
  const noteQuery = useQuery({ queryKey: ["zuzuu", "view-item", module, id], queryFn: () => api.zuzuu.item(module, id) });

  if (noteQuery.isLoading) return <Loading label="loading view…" />;

  const note = (noteQuery.data as ViewNoteItem | undefined) ?? null;
  const resolved = viewFetchState(note, module);
  const { module: resolvedModule, ...listState } = resolved;
  const summary = viewQuerySummary(listState);
  const title = note?.title || id;

  return (
    <NotesListProvider key={resolvedModule} module={resolvedModule} initial={listState}>
      <ViewBoardTable note={note} title={title} resolvedModule={resolvedModule} summary={summary} />
    </NotesListProvider>
  );
}
