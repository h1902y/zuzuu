// shell/review/DiffPreview.tsx — the before/after preview of what a proposal lands (U3).
//
// Diff = the CURRENT note body (the "before") vs the staged change (the "after") —
// NOT the generation store (a pending change isn't a generation). A create (nearly
// every mined proposal) has no before → after-only, all-added. An update fetches the
// current note body via the existing item route.
//
// Collapse rule (KTD: keep keyboard triage fast): a short diff (≤ COLLAPSE_AT rows)
// renders inline; a long one shows a "show diff" control that opens a SEPARATE modal
// pane — never inline growth, which would push the next card out of reach. The `d`
// shortcut in ReviewQueue toggles the focused card's `open`.
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { StagedSummary } from "#shared/index.js";
import { api } from "../../lib/api.js";
import { lineDiff, changeText, isUpdate, type DiffRow } from "./diff.js";
import { Stack, Inline, Text, Button } from "../../ds/index.js";

export const COLLAPSE_AT = 8;

const TONE: Record<DiffRow["tag"], { sign: string; cls: string }> = {
  added: { sign: "+", cls: "text-success" },
  removed: { sign: "−", cls: "text-danger" },
  unchanged: { sign: " ", cls: "text-muted" },
};

function DiffRows({ rows }: { rows: DiffRow[] }) {
  return (
    <div className="overflow-x-auto rounded-ui border border-border bg-app p-2 font-mono-data text-meta leading-relaxed">
      {rows.map((r, i) => (
        <div key={i} className={`whitespace-pre ${TONE[r.tag].cls}`}>
          <span aria-hidden="true">{TONE[r.tag].sign} </span>{r.text || " "}
        </div>
      ))}
    </div>
  );
}

export function DiffPreview({ item, open, onOpenChange }: {
  item: StagedSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = isUpdate(item);
  // The "before": for an update, the current note body from disk (via the item
  // route); for a create, the empty side. Only fetched when this is an update with a
  // resolvable target — creates never hit the network.
  const before = useQuery({
    queryKey: ["zuzuu", "item-body", item.module, item.target],
    queryFn: () => api.zuzuu.item(item.module, item.target as string),
    enabled: update && typeof item.target === "string" && item.target.length > 0,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onOpenChange(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const after = changeText(item.change);
  if (!after) return null; // nothing meaningful to preview

  const beforeBody = update ? (before.data?.body ?? "") : "";
  const rows = lineDiff(beforeBody, after);
  if (rows.length === 0) return null;

  const long = rows.length > COLLAPSE_AT;

  // Short diff → render inline, no control needed.
  if (!long) {
    return (
      <Stack gap="xs">
        <Text size="meta" tone="subtle" weight="semibold">{update ? "CHANGES" : "WILL ADD"}</Text>
        <DiffRows rows={rows} />
      </Stack>
    );
  }

  // Long diff → a control + a separate modal pane (no inline growth).
  return (
    <>
      <Inline gap="sm">
        <Button variant="outline" size="sm" onClick={() => onOpenChange(!open)}>
          {open ? "Hide diff" : `Show diff (${rows.length} lines)`}
        </Button>
        <Text size="meta" tone="muted">press d</Text>
      </Inline>
      {open && (
        <div className="fixed inset-0 z-30 flex items-start justify-center bg-scrim p-6 pt-24">
          <button type="button" aria-label="close" onClick={() => onOpenChange(false)} className="fixed inset-0 cursor-default" />
          <div className="animate-pop relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-elevated p-6 shadow-overlay">
            <Stack gap="md">
              <Inline gap="sm" justify="between">
                <Text size="lg" font="display">{item.title}</Text>
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Done</Button>
              </Inline>
              <Text size="meta" tone="subtle" weight="semibold">{update ? "CHANGES" : "WILL ADD"}</Text>
              <div className="min-h-0 overflow-y-auto">
                <DiffRows rows={rows} />
              </div>
            </Stack>
          </div>
        </div>
      )}
    </>
  );
}
