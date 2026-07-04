// shell/review/DiffPreview.tsx — the before/after preview of what a proposal lands
// (U3). THIN now: this file only resolves data (a react-query fetch of the current
// note, for an update's "before") and hands it to the promoted ds `Diff` — the model
// (field-level old→new + the LCS body diff, the inline/modal collapse discipline) now
// lives in ds/kit/Diff.tsx + ds/lib/diff.ts (see those files' headers for the split
// and why the LCS engine stays put in ./diff.ts rather than moving).
//
// Diff = the CURRENT note (the "before") vs the staged change (the "after") — NOT the
// generation store (a pending change isn't a generation). A create (nearly every
// mined proposal) has no before → after-only, all-added, no field rows. An update
// fetches the current note (fields + body) via the existing item route.
import { useQuery } from "@tanstack/react-query";
import type { StagedSummary } from "#shared/index.js";
import { api } from "../../lib/api.js";
import { isUpdate } from "./diff.js";
import { Diff, COLLAPSE_AT } from "../../ds/index.js";

export { COLLAPSE_AT };

export function DiffPreview({ item, open, onOpenChange }: {
  item: StagedSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = isUpdate(item);
  // The "before": for an update, the current note (fields + body) from disk (via the
  // item route); for a create, nothing to fetch — creates never hit the network.
  const before = useQuery({
    queryKey: ["zuzuu", "item-body", item.module, item.target],
    queryFn: () => api.zuzuu.item(item.module, item.target as string),
    enabled: update && typeof item.target === "string" && item.target.length > 0,
    staleTime: 30_000,
  });

  return (
    <Diff
      change={item.change}
      current={before.data as unknown as Record<string, unknown> | undefined}
      update={update}
      beforeBody={update ? (before.data?.body ?? "") : ""}
      title={item.title}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
