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
// Cells are READ-ONLY (doctrine): the row's actions live in the omnibar.
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ModuleItem } from "#shared/index.js";
import type { FieldDef } from "../../data/field-registry.js";
import { cellValue, type GridColumn } from "./grid-columns.js";
import type { SortState } from "../../data/list-state.js";
import { attrChips, visibleChips, chipClause, tableColumns, IDENTITY_COL, ATTRS_COL } from "./table-model.js";
import { groupRows } from "./group-model.js";
import { TypeGlyph } from "./TypeGlyph.js";
import { StatusPill } from "./StatusPill.js";
import { NoteDocument } from "../../note/NoteDocument.js";
import { Icon, Text } from "../../ds/index.js";

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

export function NotesTable({ cols, rows, sort, onSort, onRow, renderCell, fields = [], onChipClick, selection, groupBy }: {
  /** the CALLER's semantic columns — identity + Attributes are added here */
  cols: GridColumn[];
  rows: ModuleItem[];
  sort: SortState | null;
  onSort: (key: string) => void;
  onRow: (row: ModuleItem) => void;
  /** optional per-column cell override; return undefined to fall through */
  renderCell?: (row: ModuleItem, col: GridColumn) => ReactNode | undefined;
  /** the module's declared fields — the expansion's document groups read them */
  fields?: FieldDef[];
  /** an attribute chip was clicked → its clause joins the filter (§H.2) */
  onChipClick?: (clause: string) => void;
  /** multi-select (§H.3.4) — absent hides the checkboxes */
  selection?: NotesTableSelection;
  /** one column to group by (§H.3.3/§H.4.3) — collapsible sections with counts +
   *  per-group Σ on number columns; client-side over the loaded page. */
  groupBy?: string | null;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const allCols = tableColumns(cols);
  const toggleExpand = (addr: string) =>
    setExpanded((s) => { const n = new Set(s); if (n.has(addr)) n.delete(addr); else n.add(addr); return n; });
  const toggleGroup = (value: string) =>
    setCollapsedGroups((s) => { const n = new Set(s); if (n.has(value)) n.delete(value); else n.add(value); return n; });

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
          {allCols.map((c) => (
            <th key={c.name} className={`px-4 py-2 ${c.align === "right" ? "text-right" : "text-left"} ${c.name === "__identity" ? "sticky left-0 z-10 bg-app" : ""}`}>
              {c.name === "__attrs" ? (
                <span className="text-meta font-semibold text-subtle">{c.label}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onSort(c.name === "__identity" ? "id" : c.name)}
                  className="inline-flex items-center gap-1.5 text-meta font-semibold text-subtle transition-colors hover:text-ink-100"
                >
                  {c.name !== "__identity" && <TypeGlyph type={c.type} computed={Boolean(c.computed)} />}
                  {c.label}
                  {(sort?.key === c.name || (c.name === "__identity" && sort?.key === "id")) ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                </button>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {groupBy
          ? groupRows(rows, groupBy, allCols).flatMap((g) => {
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
          : rows.flatMap((row, idx) => renderRowPair(row, idx))}
      </tbody>
    </table>
  );

  function renderRowPair(row: ModuleItem, idx: number): ReactNode[] {
    const addr = addrOf(row);
    const isOpen = expanded.has(addr);
    const isSelected = selection?.selected.has(addr) ?? false;
    return [
      <tr
        key={addr}
        onClick={() => onRow(row)}
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
