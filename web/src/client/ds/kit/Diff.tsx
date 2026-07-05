// ds/kit/Diff.tsx — the promoted, shared before/after Diff (U3): field-level old→new
// (an update's staged fields vs the current note's) ABOVE the LCS body diff. Lifted
// from shell/review/DiffPreview.tsx, which is now a thin data-fetching consumer of
// this component (see that file's header). Presentational + prop-driven like every
// other ds/kit component — the CALLER resolves `current`/`change`/`beforeBody`
// (react-query, the daemon, …); this component only renders the diff MODEL
// (ds/lib/diff.ts's combinedDiff) and owns the inline/modal collapse discipline. The
// modal mode composes ds/kit/Dialog (U3, curried-plotting-coral.md) — Escape (when
// topmost) + outside-click dismiss come from Dialog's useDismiss wiring, not a private
// keydown listener. Reuses U1's ProposalBadge for the modal header, and tints both row
// boxes with the proposal token (border-proposal/30) — this content IS a not-yet-real
// proposal preview, the same vocabulary ProposalBadge/proposal.ts established.
import { Stack, Inline, Text } from "../primitives/index.js";
import { Button } from "./Button.js";
import { Dialog } from "./Dialog.js";
import { ProposalBadge } from "./ProposalBadge.js";
import { combinedDiff, type DiffRow, type FieldDiffRow } from "../lib/diff.js";

export { COLLAPSE_AT } from "../lib/diff.js";

const TONE: Record<DiffRow["tag"], { sign: string; cls: string }> = {
  added: { sign: "+", cls: "text-success" },
  removed: { sign: "−", cls: "text-danger" },
  unchanged: { sign: " ", cls: "text-muted" },
};

function FieldRows({ rows }: { rows: FieldDiffRow[] }) {
  return (
    <div className="overflow-x-auto rounded-ui border border-proposal/30 bg-app p-2 font-mono-data text-meta leading-relaxed">
      {rows.map((r) => (
        <div key={r.field} className="flex flex-wrap items-baseline gap-2">
          <span className="text-subtle font-medium">{r.field}</span>
          <span className="text-danger line-through">{r.before || "—"}</span>
          <span aria-hidden="true" className="text-muted">→</span>
          <span className="text-success">{r.after || "—"}</span>
        </div>
      ))}
    </div>
  );
}

function BodyRows({ rows }: { rows: DiffRow[] }) {
  return (
    <div className="overflow-x-auto rounded-ui border border-proposal/30 bg-app p-2 font-mono-data text-meta leading-relaxed">
      {rows.map((r, i) => (
        <div key={i} className={`whitespace-pre ${TONE[r.tag].cls}`}>
          <span aria-hidden="true">{TONE[r.tag].sign} </span>{r.text || " "}
        </div>
      ))}
    </div>
  );
}

export interface DiffProps {
  /** the staged change (the note that lands on approve) — drives the body's "after"
   *  text AND the field diff's proposed values. */
  change?: Record<string, unknown>;
  /** the current note's fields — an update's "before"; omit for a create. */
  current?: Record<string, unknown>;
  /** true for an update (has a before + a field delta); false for a create
   *  (after-only, all-added, no field rows). */
  update: boolean;
  /** the current note's BODY text — the update's "before"; "" for a create. The
   *  caller resolves this (e.g. DiffPreview's react-query fetch of the item route) —
   *  ds stays data-fetching-free. */
  beforeBody?: string;
  /** the modal pane's header title. */
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The shared before/after Diff (U3): field-level old→new (update only) + the LCS
 *  body diff, combined under ONE ≤COLLAPSE_AT-row inline / collapse-to-modal rule. */
export function Diff({ change, current, update, beforeBody = "", title, open, onOpenChange }: DiffProps) {
  const { fieldRows, bodyRows, total, collapsed } = combinedDiff({ update, current, change, beforeBody });
  if (total === 0) return null; // nothing meaningful to preview

  const bodyLabel = update ? "CHANGES" : "WILL ADD";

  const body = (
    <Stack gap="xs">
      {fieldRows.length > 0 && (
        <Stack gap="xs">
          <Text size="meta" tone="subtle" weight="semibold">FIELDS</Text>
          <FieldRows rows={fieldRows} />
        </Stack>
      )}
      {bodyRows.length > 0 && (
        <Stack gap="xs">
          <Text size="meta" tone="subtle" weight="semibold">{bodyLabel}</Text>
          <BodyRows rows={bodyRows} />
        </Stack>
      )}
    </Stack>
  );

  // Short combined diff → render inline, no control needed.
  if (!collapsed) return body;

  // Long combined diff → a control + a separate modal pane (no inline growth, which
  // would push the next card out of reach).
  return (
    <>
      <Inline gap="sm">
        <Button variant="outline" size="sm" onClick={() => onOpenChange(!open)}>
          {open ? "Hide diff" : `Show diff (${total} rows)`}
        </Button>
        <Text size="meta" tone="muted">press d</Text>
      </Inline>
      {/* no explicit `id` — DiffPreview mounts one of these PER proposal card in the
          review queue list, so each instance needs Dialog's own generated (useId)
          stack slot, not a shared literal string (see Popover's identical note). */}
      <Dialog
        open={open}
        title={
          <Inline gap="sm" justify="between">
            <Inline gap="xs" align="center">
              <Text size="lg" font="display">{title}</Text>
              <ProposalBadge state="pending" label={update ? "update" : "create"} />
            </Inline>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Done</Button>
          </Inline>
        }
        onClose={() => onOpenChange(false)}
        className="inset-x-6 top-24 bottom-6 mx-auto w-full max-w-2xl overflow-hidden p-6"
      >
        <div className="min-h-0 overflow-y-auto">{body}</div>
      </Dialog>
    </>
  );
}
