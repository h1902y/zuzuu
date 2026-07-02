// shell/stage/NotesTable.tsx — the ONE notes-table renderer (shared by the module
// Grid and the unified Everything view). Header sort buttons + row click; cell
// content comes from cellValue, with an optional per-column override (Everything's
// module column renders an island color dot). Pure presentation — list state,
// filters, and columns are the caller's.
import type { ReactNode } from "react";
import type { ModuleItem } from "#shared/index.js";
import { cellValue, type GridColumn } from "./grid-columns.js";
import type { SortState } from "../../data/list-state.js";

export function NotesTable({ cols, rows, sort, onSort, onRow, renderCell }: {
  cols: GridColumn[];
  rows: ModuleItem[];
  sort: SortState | null;
  onSort: (key: string) => void;
  onRow: (row: ModuleItem) => void;
  /** optional per-column cell override; return undefined to fall through to cellValue */
  renderCell?: (row: ModuleItem, col: GridColumn) => ReactNode | undefined;
}) {
  return (
    <table className="w-full border-collapse text-ui">
      <thead>
        <tr className="border-b border-border">
          {cols.map((c) => (
            <th key={c.name} className={`px-6 py-3 ${c.align === "right" ? "text-right" : "text-left"}`}>
              <button
                type="button"
                onClick={() => onSort(c.name)}
                className="text-meta font-semibold text-subtle transition-colors hover:text-ink-100"
              >
                {c.label}{sort?.key === c.name ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={`${row.module}:${row.id}`}
            onClick={() => onRow(row)}
            className="cursor-pointer border-b border-border transition-colors hover:bg-hover"
          >
            {cols.map((c) => (
              <td key={c.name} className={`max-w-xs truncate px-6 py-3 text-subtle ${c.align === "right" ? "text-right" : "text-left"}`}>
                {renderCell?.(row, c) ?? cellValue(row, c)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
