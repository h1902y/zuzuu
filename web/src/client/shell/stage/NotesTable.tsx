// shell/stage/NotesTable.tsx — the ONE notes-table renderer (§H), shared by the
// module Grid and the unified Everything view. The zuzuu-native grid:
//   · identity is the ID (frozen first column; title is secondary text) — never
//     a blank first cell
//   · a row-number rail (hover → the selection checkbox, §H.4.5)
//   · field-type glyphs in headers; status as lifecycle pills; select values as
//     pills; number/date right-aligned by the column's type
//   · ONE elastic Attributes cell — the rest of the row's frontmatter as chips
//     (clickable → that clause joins the filter; §H.2/§H.3 loop)
//   · row expansion (chevron/Enter) → the shared NoteDocument inline (§H.6) —
//     surveying → inspecting never changes surface
// Cells are READ-ONLY (doctrine): the row's actions live in the omnibar. The
// pending-row register (U2) is the one exception (U8): a staged create/update
// gets an in-place accept/reject, routed through the SAME gate the review queue
// uses (`use-review-queue.ts`'s approve/reject, KTD5) — not a new landing path.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ChevronsUpDown } from "lucide-react";
import type { ModuleItem } from "#shared/index.js";
import type { FieldDef } from "../../data/field-registry.js";
import { cellValue, type GridColumn } from "./grid-columns.js";
import type { SortState } from "../../data/list-state.js";
import { attrChips, visibleChips, chipClause, tableColumns, isPendingRow, pendingRowIntent, solidifyPendingRow, type TableRow, type PendingRow, IDENTITY_COL, ATTRS_COL } from "./table-model.js";
import { groupRows } from "./group-model.js";
import { TypeGlyph } from "./TypeGlyph.js";
import { StatusPill } from "./StatusPill.js";
import { FieldConfigPanel } from "./FieldConfigPanel.js";
import { NoteDocument } from "../../note/NoteDocument.js";
import { useReviewQueue } from "../review/use-review-queue.js";
import { REJECT_REASONS } from "../review/review-model.js";
import { Icon, Text, Button, ProposalBadge } from "../../ds/index.js";

export interface NotesTableSelection {
  selected: ReadonlySet<string>;
  toggle: (addr: string) => void;
}

const addrOf = (row: ModuleItem): string => `${row.module}:${row.id}`;

function IdentityCell({ row }: { row: ModuleItem }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate font-mono text-ui text-ink-100">{row.id}</span>
      {row.title && row.title !== row.id && (
        <span className="truncate text-meta text-muted">{row.title}</span>
      )}
    </span>
  );
}

function SelectPill({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-elevated px-2 py-0.5 text-meta text-subtle">
      {value}
    </span>
  );
}

export function NotesTable({ cols, rows, sort, onSort, onRow, renderCell, fields = [], onChipClick, selection, groupBy, module }: {
  /** the CALLER's semantic columns — identity + Attributes are added here */
  cols: GridColumn[];
  /** landed notes + (U2) pending create/update proposals, merged via
   *  table-model's `mergeTableRows` — a `PendingRow` renders in its own
   *  register (below), never through the real-row path. */
  rows: TableRow[];
  sort: SortState | null;
  onSort: (key: string) => void;
  onRow: (row: ModuleItem) => void;
  /** optional per-column cell override; return undefined to fall through */
  renderCell?: (row: ModuleItem, col: GridColumn) => ReactNode | undefined;
  /** the module's declared fields — the expansion's document groups read them
   *  (and, in single-module scope, the header caret's edit panel). */
  fields?: FieldDef[];
  /** an attribute chip was clicked → its clause joins the filter (§H.2) */
  onChipClick?: (clause: string) => void;
  /** multi-select (§H.3.4) — absent hides the checkboxes */
  selection?: NotesTableSelection;
  /** one column to group by (§H.3.3/§H.4.3) — collapsible sections with counts +
   *  per-group Σ on number columns; client-side over the loaded page. */
  groupBy?: string | null;
  /** SINGLE-MODULE scope only (Grid, never Everything — a schema column has no
   *  single home to alter there): a declared column's header gets an "Edit
   *  column" caret opening the field-config panel (§H.5). Absent hides it. */
  module?: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [editingCol, setEditingCol] = useState<string | null>(null);
  const allCols = tableColumns(cols);
  // U2 — the proposal register: pending rows always float to the top, OUTSIDE
  // groupBy/pagination (grouping by lifecycle status etc. has no meaning for a
  // not-yet-real row); the real-row path below is untouched.
  const pendingRows = rows.filter(isPendingRow);
  const realRows = rows.filter((r): r is ModuleItem => !isPendingRow(r));
  // U8 — the pending row's click-accept/reject: the SAME approve/reject the review
  // queue calls (KTD5), reached through the identical hook (use-review-queue.ts) —
  // not a bespoke call. `solidifyingIds`/`rejectingId` are purely local render state
  // (the shared solidify motion + the reject taxonomy's open/closed toggle); once
  // the gate confirms and the invalidated query refetches, the staged entry is gone
  // and this row simply stops existing (mergeTableRows no longer produces it).
  const { approve: approvePending, reject: rejectPending } = useReviewQueue();
  const [solidifyingIds, setSolidifyingIds] = useState<Set<string>>(new Set());
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const acceptPendingRow = (row: PendingRow) => {
    setSolidifyingIds((s) => new Set(s).add(row.stagedId));
    const { id, module } = pendingRowIntent(row);
    void approvePending(id, module);
  };
  const rejectPendingRow = (row: PendingRow, reason: string) => {
    const { id, module } = pendingRowIntent(row);
    setRejectingId(null);
    void rejectPending(id, module, reason);
  };
  const toggleExpand = (addr: string) =>
    setExpanded((s) => { const n = new Set(s); if (n.has(addr)) n.delete(addr); else n.add(addr); return n; });
  const toggleGroup = (value: string) =>
    setCollapsedGroups((s) => { const n = new Set(s); if (n.has(value)) n.delete(value); else n.add(value); return n; });

  // §H.3.4: "rail checkboxes + x key." The x key toggles whichever row the mouse
  // is over — a hovered-row ref (not React state) so keydown reads it without a
  // rerender on every mouseenter, and skips when focus is inside a text input
  // (typing an 'x' in the filter box must never select a row).
  const hoverAddr = useRef<string | null>(null);
  useEffect(() => {
    if (!selection) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "x" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) return;
      if (!hoverAddr.current) return;
      e.preventDefault();
      selection.toggle(hoverAddr.current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selection]);

  const cell = (row: ModuleItem, c: GridColumn): ReactNode => {
    const over = renderCell?.(row, c);
    if (over !== undefined) return over;
    if (c.name === "__identity") return <IdentityCell row={row} />;
    if (c.name === "__attrs") {
      const { shown, more } = visibleChips(attrChips(row, allCols));
      if (!shown.length) return <span className="text-meta text-muted">—</span>;
      return (
        <span className="flex flex-wrap items-center gap-1">
          {shown.map((ch) => {
            const clause = chipClause(row, ch.key);
            return (
              <button
                key={ch.key}
                type="button"
                disabled={!clause || !onChipClick}
                onClick={(e) => { e.stopPropagation(); if (clause) onChipClick?.(clause); }}
                title={clause ? `filter: ${clause}` : undefined}
                className="inline-flex max-w-48 items-center gap-1 truncate rounded-ui border border-border bg-app px-1.5 py-0.5 text-meta text-muted transition-colors enabled:hover:border-accent-dim enabled:hover:text-ink-100"
              >
                <span className="text-subtle">{ch.key}:</span> {ch.value}
              </button>
            );
          })}
          {more > 0 && <span className="text-meta text-muted">+{more}</span>}
        </span>
      );
    }
    if (c.name === "status") {
      const v = cellValue(row, c);
      return v ? <StatusPill status={v} /> : <span className="text-meta text-muted">—</span>;
    }
    if (c.type === "select") {
      const v = cellValue(row, c);
      return v ? <SelectPill value={v} /> : "";
    }
    return cellValue(row, c);
  };

  return (
    <table className="w-full border-collapse text-ui">
      <thead>
        <tr className="border-b border-border">
          <th className="w-12 px-2 py-2" aria-label="row" />
          {allCols.map((c, colIdx) => {
            const editable = module && c.name !== "__identity" && c.name !== "__attrs";
            const editField = editable ? (fields.find((f) => f.name === c.name) ?? null) : null;
            // the edit panel is ~320px wide; a LEFT-anchored popover on a column
            // past the table's midpoint runs off (or under the wing sidebar, when
            // one is open) — anchor from the column's own edge nearest the table
            // border instead of always "left" (c.align is TEXT alignment, a
            // different axis, but doubles as a cheap position signal here: a
            // right-aligned cell is a date/number column, which skews later in
            // typical schemas) OR simple position: past the halfway column.
            const nearRight = c.align === "right" || colIdx >= Math.max(1, Math.ceil(allCols.length / 2));
            return (
              <th key={c.name} className={`group relative px-4 py-2 ${c.align === "right" ? "text-right" : "text-left"} ${c.name === "__identity" ? "sticky left-0 z-10 bg-app" : ""}`}>
                {c.name === "__attrs" ? (
                  <span className="text-meta font-semibold text-subtle">{c.label}</span>
                ) : (
                  <span className="inline-flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onSort(c.name === "__identity" ? "id" : c.name)}
                      title={editField?.description}
                      className="inline-flex items-center gap-1.5 text-meta font-semibold text-subtle transition-colors hover:text-ink-100"
                    >
                      {c.name !== "__identity" && <TypeGlyph type={c.type} computed={Boolean(c.computed)} />}
                      {c.label}
                      {(sort?.key === c.name || (c.name === "__identity" && sort?.key === "id")) ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                    {editable && (
                      <button
                        type="button"
                        aria-label={`edit column ${c.name}`}
                        title="Edit column"
                        onClick={() => setEditingCol(editingCol === c.name ? null : c.name)}
                        className="rounded-ui p-0.5 text-muted opacity-0 transition-opacity hover:bg-hover hover:text-ink-100 group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Icon icon={ChevronsUpDown} size={11} />
                      </button>
                    )}
                  </span>
                )}
                {editable && editingCol === c.name && module && (
                  <FieldConfigPanel
                    module={module}
                    field={editField}
                    name={c.name}
                    existingNames={fields.map((f) => f.name)}
                    onClose={() => setEditingCol(null)}
                    align={nearRight ? "right" : "left"}
                  />
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {pendingRows.map((row, idx) => renderPendingRow(row, idx))}
        {groupBy
          ? groupRows(realRows, groupBy, allCols).flatMap((g) => {
              const collapsed = collapsedGroups.has(g.value);
              const sumEntries = Object.entries(g.sums);
              return [
                <tr key={`§${g.value}`} className="border-b border-border bg-surface">
                  <td colSpan={allCols.length + 1} className="px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => toggleGroup(g.value)}
                      className="flex w-full items-center gap-2 text-left text-meta font-semibold text-subtle transition-colors hover:text-ink-100"
                    >
                      <Icon icon={collapsed ? ChevronRight : ChevronDown} size={12} />
                      {g.value} <Text tone="muted">{g.rows.length}</Text>
                      {sumEntries.length > 0 && (
                        <span className="ml-auto flex items-center gap-3 pr-4 font-normal">
                          {sumEntries.map(([k, v]) => <Text key={k} size="meta" tone="muted">{`Σ ${k} ${v}`}</Text>)}
                        </span>
                      )}
                    </button>
                  </td>
                </tr>,
                ...(collapsed ? [] : g.rows.flatMap((row, idx) => renderRowPair(row, idx))),
              ];
            })
          : realRows.flatMap((row, idx) => renderRowPair(row, idx))}
      </tbody>
    </table>
  );

  /** U2 — the table's proposal register: a staged create/update, styled with the
   *  shared proposal vocabulary (violet/dashed/pulsing — the SAME tokens
   *  ProposalBadge/proposalRecipe use, ds/recipes/proposal.ts), not a hand-rolled
   *  look. U8 — no longer read-only: an accept/reject lands the staged change via
   *  the existing gate (KTD5); accepting swaps the pending look for the shared
   *  "approving" state + the `animate-proposal-solidify` motion (applied to the
   *  inner flex span, not the <tr> — CSS transforms don't apply to table-row
   *  boxes, only to their content). Still no expand/selection checkbox — there's
   *  no landed note here yet to open or select. */
  function renderPendingRow(row: PendingRow, idx: number): ReactNode {
    const display = solidifyingIds.has(row.stagedId) ? solidifyPendingRow(row) : row;
    const isRejectingRow = rejectingId === row.stagedId;
    return (
      <tr
        key={`§pending:${row.stagedId}`}
        className={`h-8 border-b bg-proposal/10 ${display.solidifying ? "border-solid border-accent" : "border-dashed border-proposal"}`}
      >
        <td className="w-12 px-2 py-1.5">
          <span className="text-meta text-muted">{idx + 1}</span>
        </td>
        <td className="px-4 py-1.5" colSpan={allCols.length}>
          <span className={`flex items-center gap-2 ${display.solidifying ? "animate-proposal-solidify" : "animate-proposal-pulse"}`}>
            <ProposalBadge state={display.solidifying ? "approving" : "pending"} label={row.op} />
            <span className="min-w-0 flex-1 truncate text-ui text-ink-100">{row.title}</span>
            <span className="shrink-0 text-meta text-muted">{row.module}</span>
            {!display.solidifying && (
              isRejectingRow ? (
                <span className="flex shrink-0 items-center gap-1">
                  {REJECT_REASONS.map((r) => (
                    <Button key={r} variant="outline" size="sm" onClick={() => rejectPendingRow(row, r)}>{r}</Button>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => setRejectingId(null)}>cancel</Button>
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-1">
                  <Button variant="primary" size="sm" onClick={() => acceptPendingRow(row)}>accept</Button>
                  <Button variant="danger" size="sm" onClick={() => setRejectingId(row.stagedId)}>reject</Button>
                </span>
              )
            )}
          </span>
        </td>
      </tr>
    );
  }

  function renderRowPair(row: ModuleItem, idx: number): ReactNode[] {
    const addr = addrOf(row);
    const isOpen = expanded.has(addr);
    const isSelected = selection?.selected.has(addr) ?? false;
    return [
      <tr
        key={addr}
        onClick={() => onRow(row)}
        onMouseEnter={() => { hoverAddr.current = addr; }}
        onMouseLeave={() => { if (hoverAddr.current === addr) hoverAddr.current = null; }}
        className={`group h-8 cursor-pointer border-b border-border transition-colors hover:bg-hover ${isSelected ? "bg-selected" : ""}`}
      >
        {/* the rail: row number → (hover/selected) checkbox + expansion chevron */}
        <td className="w-12 px-2 py-1.5">
          <span className="flex items-center gap-1">
            {selection ? (
              <>
                <span className={`text-meta text-muted ${isSelected ? "hidden" : "group-hover:hidden"}`}>{idx + 1}</span>
                <input
                  type="checkbox"
                  aria-label={`select ${addr}`}
                  checked={isSelected}
                  onChange={() => selection.toggle(addr)}
                  onClick={(e) => e.stopPropagation()}
                  className={`${isSelected ? "" : "hidden group-hover:block"} accent-accent`}
                />
              </>
            ) : (
              <span className="text-meta text-muted">{idx + 1}</span>
            )}
            <button
              type="button"
              aria-label={isOpen ? "collapse" : "expand"}
              onClick={(e) => { e.stopPropagation(); toggleExpand(addr); }}
              className="rounded-ui p-0.5 text-muted opacity-0 transition-opacity hover:bg-hover hover:text-ink-100 group-hover:opacity-100"
            >
              <Icon icon={isOpen ? ChevronDown : ChevronRight} size={12} />
            </button>
          </span>
        </td>
        {allCols.map((c) => (
          <td
            key={c.name}
            className={`max-w-xs px-4 py-1.5 text-subtle ${c.align === "right" ? "text-right" : "text-left"} ${c.name === "__identity" ? "sticky left-0 z-10 bg-app group-hover:bg-hover" : "truncate"}`}
          >
            {cell(row, c)}
          </td>
        ))}
      </tr>,
      isOpen ? (
        <tr key={`${addr}#doc`} className="border-b border-border">
          <td className="px-2 py-1.5" />
          <td colSpan={allCols.length} className="px-4 py-3">
            <NoteDocument item={row} fields={fields} width="row" />
          </td>
        </tr>
      ) : null,
    ];
  }
}
