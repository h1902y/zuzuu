// shell/stage/TableFooter.tsx — the table's footer bar (§H.4.6): record count
// ALWAYS; per-number-column Σ across the loaded page beside it (Airtable's "Sum
// 830" under a numeric column, adopted). A true cross-page total needs a daemon
// aggregate route (§H.3.3's noted follow-up — `module items` has no --group-by/
// --agg today, only the CLI's own `zz query` does) — this sums what's actually
// on screen, the same honesty group-model's group headers keep.
//
// S3: `total` is the true server pre-paginate count; the Σ is only ever over the
// loaded page. With pageSize < total those are DIFFERENT numbers in the same
// visual register (both `meta`/`muted`) — a reader takes the Σ for a sum over all
// `total` rows. Whenever they diverge, the Σ is labelled "page Σ" and set apart in
// a dashed chip (the same "not the whole/settled picture" affordance the omnibar's
// proposal badge already uses) — never just a color difference, so it doesn't rely
// on a reader noticing a subtle muted-vs-muted shade.
import type { ModuleItem } from "#shared/index.js";
import type { GridColumn } from "./grid-columns.js";
import { totalSums, isPartialSum } from "./group-model.js";
import { Text } from "../../ds/index.js";

export function TableFooter({ total, rows, cols }: { total: number; rows: readonly ModuleItem[]; cols: readonly GridColumn[] }) {
  const sums = totalSums(rows, cols);
  const entries = Object.entries(sums);
  const partial = isPartialSum(total, rows.length);
  return (
    <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border bg-surface px-6 py-1.5">
      <Text size="meta" tone="muted">{total} {total === 1 ? "row" : "rows"}</Text>
      {entries.length > 0 && (
        <span className="flex items-center gap-3">
          {entries.map(([k, v]) => (
            <span
              key={k}
              className={partial ? "rounded-sm border border-dashed border-border px-1" : undefined}
              title={partial ? `sum of the ${rows.length} loaded rows only — ${total} rows match in total` : undefined}
            >
              <Text size="meta" tone="muted">{`${partial ? "page " : ""}Σ ${k} ${v}`}</Text>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
