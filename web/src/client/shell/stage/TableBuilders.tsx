// shell/stage/TableBuilders.tsx — the [Filter][Group][Sort] anchored builder
// panels (§H.4.3): Airtable's grid language, adopted — small panels UNDER the
// toolbar buttons, never a modal, that write the SAME clause/state the typed
// input (§H.3.1) and attribute chips (§H.2) do: builders and typists share one
// grammar. Color-by (§H.4's item 8) is out of this pass — noted, not built.
//
// U4 (curried-plotting-coral.md): the 3 copy-pasted `Scrim`+`Panel` blocks are
// gone — Filter/Group/Sort now compose the shared `ds/kit/Popover` (U2), so
// outside-click + topmost-only Escape come from the overlay stack instead of a
// private full-screen scrim button. Group/Sort are single-select (`closeOnSelect`
// + `PopoverItem` rows — pick closes the popover); Filter stays a multi-add
// surface (no `closeOnSelect` — "+ add condition" must stay open across adds).
// `open`/`onOpenChange` are now CONTROLLED (lifted to Grid.tsx/Everything.tsx) so
// the toolbar-popover-model.ts coordinator can keep this trio mutually exclusive
// with the separate +Column FieldConfigPanel popover.
import { useState } from "react";
import type { Dispatch } from "react";
import { ListFilter, Layers, ArrowUpDown, X } from "lucide-react";
import type { GridColumn } from "./grid-columns.js";
import type { ListAction, ListState } from "../../data/list-state.js";
import { OPS, clauseParts } from "./table-model.js";
import { toggleToolbarPopover, type ToolbarPopoverKey } from "./toolbar-popover-model.js";
import type { TableFilterOps } from "./use-table-filter.js";
import { Icon, Text, Button, Popover, PopoverItem } from "../../ds/index.js";

const fieldsOf = (cols: readonly GridColumn[]) => cols.filter((c) => c.name !== "__identity" && c.name !== "__attrs");

function FilterPanel({ cols, where, onAdd, onRemove, onClose }: {
  cols: readonly GridColumn[];
  where: readonly string[];
  onAdd: (clause: string) => void;
  onRemove: (clause: string) => void;
  onClose: () => void;
}) {
  const fields = fieldsOf(cols);
  const [field, setField] = useState(fields[0]?.name ?? "");
  const [op, setOp] = useState<(typeof OPS)[number]>("=");
  const [value, setValue] = useState("");
  const add = () => {
    if (!field || !value.trim()) return;
    onAdd(`${field}${op}${value.trim()}`);
    setValue("");
  };
  return (
    <Popover open onClose={onClose}>
      <Text size="meta" tone="muted">Where</Text>
      <div className="mt-1 flex items-center gap-1">
        <select
          value={field}
          onChange={(e) => setField(e.target.value)}
          className="min-w-0 flex-1 rounded-ui border border-border bg-app px-1.5 py-1 text-meta text-ink-100 outline-none"
        >
          {fields.map((f) => <option key={f.name} value={f.name}>{f.label}</option>)}
        </select>
        <select
          value={op}
          onChange={(e) => setOp(e.target.value as (typeof OPS)[number])}
          className="rounded-ui border border-border bg-app px-1 py-1 text-meta text-ink-100 outline-none"
        >
          {OPS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") add(); }}
        placeholder="value"
        className="mt-1 w-full rounded-ui border border-border bg-app px-2 py-1 text-meta text-ink-100 outline-none placeholder:text-muted focus:border-accent-dim"
      />
      <div className="mt-1.5">
        <Button variant="outline" size="sm" onClick={add} disabled={!field || !value.trim()}>
          + add condition
        </Button>
      </div>
      {where.length > 0 && (
        <div className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
          {where.map((w) => {
            const p = clauseParts(w);
            return (
              <div key={w} className="flex items-center justify-between gap-2 text-meta text-subtle">
                <span className="min-w-0 truncate">{p.op ? `${p.key} ${p.op} ${p.value}` : w}</span>
                <button type="button" onClick={() => onRemove(w)} aria-label={`remove ${w}`} className="shrink-0 text-muted transition-colors hover:text-ink-100">
                  <Icon icon={X} size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Popover>
  );
}

function GroupPanel({ cols, groupBy, onPick, onClose }: {
  cols: readonly GridColumn[];
  groupBy: string | null;
  onPick: (key: string | null) => void;
  onClose: () => void;
}) {
  return (
    <Popover open onClose={onClose} closeOnSelect>
      <Text size="meta" tone="muted">Group by</Text>
      <div className="mt-1 flex flex-col gap-0.5">
        <PopoverItem
          onSelect={() => onPick(null)}
          className={`rounded-ui px-2 py-1 text-left text-meta transition-colors hover:bg-hover ${groupBy === null ? "bg-selected text-ink-100" : "text-subtle"}`}
        >
          None
        </PopoverItem>
        {fieldsOf(cols).map((f) => (
          <PopoverItem
            key={f.name}
            onSelect={() => onPick(f.name)}
            className={`rounded-ui px-2 py-1 text-left text-meta transition-colors hover:bg-hover ${groupBy === f.name ? "bg-selected text-ink-100" : "text-subtle"}`}
          >
            {f.label}
          </PopoverItem>
        ))}
      </div>
    </Popover>
  );
}

function SortPanel({ cols, sort, onPick, onClose }: {
  cols: readonly GridColumn[];
  sort: ListState["sort"];
  onPick: (key: string, dir: "asc" | "desc") => void;
  onClose: () => void;
}) {
  return (
    <Popover open onClose={onClose} closeOnSelect>
      <Text size="meta" tone="muted">Sort by</Text>
      <div className="mt-1 flex flex-col gap-1">
        {fieldsOf(cols).map((f) => (
          <div key={f.name} className="flex items-center justify-between gap-1">
            <Text size="meta" tone={sort?.key === f.name ? "default" : "subtle"}>{f.label}</Text>
            <div className="flex items-center gap-1">
              <PopoverItem
                onSelect={() => onPick(f.name, "asc")}
                className={`rounded-ui px-1.5 py-0.5 text-meta transition-colors hover:bg-hover ${sort?.key === f.name && sort.dir === "asc" ? "bg-selected text-ink-100" : "text-muted"}`}
              >
                asc
              </PopoverItem>
              <PopoverItem
                onSelect={() => onPick(f.name, "desc")}
                className={`rounded-ui px-1.5 py-0.5 text-meta transition-colors hover:bg-hover ${sort?.key === f.name && sort.dir === "desc" ? "bg-selected text-ink-100" : "text-muted"}`}
              >
                desc
              </PopoverItem>
            </div>
          </div>
        ))}
      </div>
    </Popover>
  );
}

export function TableBuilders({ cols, state, filterOps, dispatch, open, onOpenChange }: {
  cols: readonly GridColumn[];
  state: ListState;
  filterOps: Pick<TableFilterOps, "addWhere" | "removeWhere">;
  dispatch: Dispatch<ListAction>;
  /** which toolbar popover is open right now — lifted to the parent
   *  (Grid.tsx/Everything.tsx) so Filter/Group/Sort stay mutually exclusive with
   *  the SEPARATE +Column FieldConfigPanel popover (U4's coordinator,
   *  toolbar-popover-model.ts). */
  open: ToolbarPopoverKey | null;
  onOpenChange: (next: ToolbarPopoverKey | null) => void;
}) {
  const close = () => onOpenChange(null);
  const toggle = (v: "filter" | "group" | "sort") => onOpenChange(toggleToolbarPopover(open, v));

  return (
    <div className="flex shrink-0 items-center gap-1">
      <div className="relative">
        <Button variant={state.where.length ? "outline" : "ghost"} size="sm" onClick={() => toggle("filter")}>
          <Icon icon={ListFilter} size={13} /> Filter{state.where.length > 0 ? ` (${state.where.length})` : ""}
        </Button>
        {open === "filter" && (
          <FilterPanel cols={cols} where={state.where} onAdd={filterOps.addWhere} onRemove={filterOps.removeWhere} onClose={close} />
        )}
      </div>
      <div className="relative">
        <Button variant={state.groupBy ? "outline" : "ghost"} size="sm" onClick={() => toggle("group")}>
          <Icon icon={Layers} size={13} /> Group{state.groupBy ? ` · ${state.groupBy}` : ""}
        </Button>
        {open === "group" && (
          <GroupPanel cols={cols} groupBy={state.groupBy} onPick={(groupBy) => dispatch({ type: "setGroupBy", groupBy })} onClose={close} />
        )}
      </div>
      <div className="relative">
        <Button variant={state.sort ? "outline" : "ghost"} size="sm" onClick={() => toggle("sort")}>
          <Icon icon={ArrowUpDown} size={13} /> Sort{state.sort ? ` · ${state.sort.key}` : ""}
        </Button>
        {open === "sort" && (
          <SortPanel cols={cols} sort={state.sort} onPick={(key, dir) => dispatch({ type: "setSort", key, dir })} onClose={close} />
        )}
      </div>
    </div>
  );
}
