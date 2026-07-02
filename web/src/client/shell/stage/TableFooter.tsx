// shell/stage/TableFooter.tsx — the table's footer bar (§H.4.6): record count
// ALWAYS; per-number-column Σ across the loaded page beside it (Airtable's "Sum
// 830" under a numeric column, adopted). A true cross-page total needs a daemon
// aggregate route (§H.3.3's noted follow-up — `module items` has no --group-by/
// --agg today, only the CLI's own `zz query` does) — this sums what's actually
// on screen, the same honesty group-model's group headers keep.
import type { ModuleItem } from "#shared/index.js";
import type { GridColumn } from "./grid-columns.js";
import { totalSums } from "./group-model.js";
import { Text } from "../../ds/index.js";

export function TableFooter({ total, rows, cols }: { total: number; rows: readonly ModuleItem[]; cols: readonly GridColumn[] }) {
  const sums = totalSums(rows, cols);
  const entries = Object.entries(sums);
  return (
    <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border bg-surface px-6 py-1.5">
      <Text size="meta" tone="muted">{total} {total === 1 ? "row" : "rows"}</Text>
      {entries.length > 0 && (
        <span className="flex items-center gap-3">
          {entries.map(([k, v]) => <Text key={k} size="meta" tone="muted">{`Σ ${k} ${v}`}</Text>)}
        </span>
      )}
    </div>
  );
}
