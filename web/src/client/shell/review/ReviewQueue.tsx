// shell/review/ReviewQueue.tsx — the unified cross-session proposal queue, composed
// (U7) as ONE deliberate review CANVAS rather than a queue that happens to have
// controls bolted on: a toolbar strip (pending count · keyboard legend · the
// module/session grouping toggle · the global batch affordance) sits above the
// grouped list; each group header now names its count AND its safe-tail
// batchability (`groupHeader` below) so scanning the surface tells you where the
// easy approvals are before you open a single card. Pending proposals grouped by
// module OR by session/run (U6's toggle — "review everything from last night's
// run"); each a ProposalCard (U7's own coherence pass). Rendered in the session wing
// AND the global review overlay. The overlay (and, since U5, the wing when the
// overlay isn't open — see WorkbenchShell.tsx's `keyboard={!reviewOpen}`) passes
// `keyboard` for the focused decision flow (P2.4 + U5's quick gestures): j/k (↓/↑)
// move the cursor, a/Enter approves the focused proposal, d toggles its diff, r opens
// its reject taxonomy (keyboard-navigable), e opens its edit-before-approve form, x
// toggles it into the batch-selection set, Shift+A batch-approves (the selection, or
// the safe tail when nothing's selected — never a needsScrutiny sweep, KTD4). Only
// ONE ReviewQueue instance is ever keyboard-hot at a time (the caller's job — see
// WorkbenchShell.tsx) so two cursors never fight over the same keystroke. Selection +
// edit are mouse-usable in EVERY instance (not gated on `keyboard`); the reject
// taxonomy's click-to-open/mouse-pick path is unaffected either way. Calm "all caught
// up" empty state, preserved verbatim. Static utilities only.
//
// U6 — `axis` is LOCAL component state (module | session), not a query param: it's
// passed straight into `useReviewQueue(axis)`, which only re-partitions the SAME
// already-fetched, already-scored queue (see use-review-queue.ts) — flipping the
// toggle never refetches. Each rendered group (either axis) also gets its OWN
// batch-approve affordance, scoped to that group's items via the SAME `batchTargets`
// model U5 introduced (still KTD4-guarded: an empty in-group selection only offers
// that group's safe tail, never a needsScrutiny sweep) — this is what makes a
// session/run group a first-class "approve this run's safe tail" target.
import { useEffect, useState } from "react";
import { useReviewQueue } from "./use-review-queue.js";
import {
  clampFocus, moveFocus, focusedId,
  openRejectMode, moveRejectReason, reasonIndexFromKey, REJECT_MODE_CLOSED,
  toggleSelection, batchTargets, editIntent, runBatchApprove, selectionAfterBatch,
} from "./review-flow.js";
import { REJECT_REASONS, NO_SESSION_BUCKET } from "./review-model.js";
import type { GroupAxis, ScoredStaged } from "./review-model.js";
import { shortSession } from "./provenance.js";
import { toast } from "../../state/toast.js";
import { Check } from "lucide-react";
import { ProposalCard } from "./ProposalCard.js";
import { emptyCopy } from "../empty-copy.js";
import { Stack, Inline, Text, Button, Box, EmptyState } from "../../ds/index.js";

/** The group header label for either axis — "module" keys render verbatim; "session"
 *  keys are shortened for readability (provenance.ts's display convention), and the
 *  no-provenance bucket gets an honest, non-cryptic label rather than its raw key. */
function groupLabel(axis: GroupAxis, key: string): string {
  if (axis === "module") return key;
  return key === NO_SESSION_BUCKET ? "no session" : shortSession(key);
}

/** A group header's full display model (U7 — "canvas" not "queue"): the label, the
 *  group's TOTAL item count, and its batch-approve state — how many are batchable
 *  right now (`batch`, selection-aware via the SAME `batchTargets` anti-fatigue model
 *  U5 shipped) and whether that count reflects an explicit selection or the safe-tail
 *  default. One source of truth for both the render and hitl-canvas.test.ts, so the
 *  group header's "count + safe-tail batchability" is a tested contract, not just
 *  markup. Pure — computes a value, touches nothing. */
export interface GroupHeaderModel {
  label: string;
  count: number;
  batch: ScoredStaged[];
  batchIsSelection: boolean;
}

export function groupHeader(
  axis: GroupAxis,
  key: string,
  items: readonly ScoredStaged[],
  selected: ReadonlySet<string>,
): GroupHeaderModel {
  return {
    label: groupLabel(axis, key),
    count: items.length,
    batch: batchTargets(items, selected),
    batchIsSelection: items.some((it) => selected.has(it.id)),
  };
}

export function ReviewQueue({ keyboard }: { keyboard?: boolean } = {}) {
  const [axis, setAxis] = useState<GroupAxis>("module");
  const { queue, grouped, total, loading, approve, reject, restage } = useReviewQueue(axis);
  const [focus, setFocus] = useState(0);
  const [decided, setDecided] = useState(0);
  const [diffOpenId, setDiffOpenId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectMode, setRejectMode] = useState(REJECT_MODE_CLOSED);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const focusIdx = clampFocus(total, focus);
  const focusId = keyboard ? focusedId(queue, focusIdx) : null;

  // Bug fix: `reject` now resolves to `false` on a refused/failed mutation
  // (use-review-queue.ts) instead of silently "succeeding" — only count it as
  // decided once it actually landed; the outcome still rides back to the caller
  // (ProposalCard's onReject contract) so a failure clears its "landing…" state
  // instead of hanging.
  const rejectAndCount = async (id: string, module: string, reason: string): Promise<boolean> => {
    const ok = await reject(id, module, reason);
    if (ok) setDecided((n) => n + 1);
    return ok;
  };
  const openRejectFor = (id: string) => { setRejectingId(id); setRejectMode(openRejectMode()); };
  const closeReject = () => { setRejectingId(null); setRejectMode(REJECT_MODE_CLOSED); };
  // Bug fix: a batch approve used to fire every item and forget it (no await, no
  // failure signal) — a partial daemon failure silently no-opped. runBatchApprove
  // (review-flow.ts's batch model) awaits every target and partitions the outcome;
  // only the ids that actually landed drop out of `selected` (selectionAfterBatch) —
  // a failed one stays selected, and a summary toast says so instead of nothing
  // happening.
  const batchApprove = (targets: { id: string; module: string }[]) => {
    if (!targets.length) return;
    void runBatchApprove(targets, approve).then(({ succeeded, failed }) => {
      if (succeeded.length) setDecided((n) => n + succeeded.length);
      if (failed.length) toast(`Approved ${succeeded.length} of ${targets.length} — ${failed.length} failed to land`, "error");
      setSelected((s) => selectionAfterBatch(s, succeeded));
    });
  };

  // the focused decision flow (P2.4) + U5's quick gestures. Ignores keystrokes while
  // typing (an edit-form input included). While the reject taxonomy is open for a
  // card it OWNS the keyboard — j/k/arrows move the reason highlight instead of the
  // main cursor, a digit selects+submits directly, Enter submits the highlight, Esc
  // cancels — you're mid-decision on one card, not moving around the queue.
  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (rejectMode.open && rejectingId) {
        if (e.key === "Escape") { e.preventDefault(); closeReject(); return; }
        const digit = reasonIndexFromKey(e.key, REJECT_REASONS.length);
        if (digit !== null) { e.preventDefault(); rejectAndCount(rejectingId, queue.find((q) => q.id === rejectingId)?.module ?? "", REJECT_REASONS[digit]!); closeReject(); return; }
        if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); setRejectMode((m) => moveRejectReason(m, REJECT_REASONS.length, 1)); return; }
        if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); setRejectMode((m) => moveRejectReason(m, REJECT_REASONS.length, -1)); return; }
        if (e.key === "Enter") { e.preventDefault(); rejectAndCount(rejectingId, queue.find((q) => q.id === rejectingId)?.module ?? "", REJECT_REASONS[rejectMode.reasonIndex]!); closeReject(); return; }
        return; // swallow anything else — mid-decision on this one card
      }

      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); setFocus((f) => moveFocus(total, clampFocus(total, f), 1)); }
      else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); setFocus((f) => moveFocus(total, clampFocus(total, f), -1)); }
      else if (e.key === "a" || e.key === "Enter") {
        const target = queue.find((q) => q.id === focusedId(queue, clampFocus(total, focus)));
        // only count it as decided once it actually lands (approve resolves `false`
        // on a refused/failed mutation — see use-review-queue.ts).
        if (target) { e.preventDefault(); void approve(target.id, target.module).then((ok) => { if (ok) setDecided((n) => n + 1); }); }
      }
      else if (e.key === "A") { e.preventDefault(); batchApprove(batchTargets(queue, selected)); }
      else if (e.key === "d") {
        const id = focusedId(queue, clampFocus(total, focus));
        if (id) { e.preventDefault(); setDiffOpenId((cur) => (cur === id ? null : id)); }
      }
      else if (e.key === "r") {
        const id = focusedId(queue, clampFocus(total, focus));
        if (id) { e.preventDefault(); openRejectFor(id); }
      }
      else if (e.key === "e") {
        const id = focusedId(queue, clampFocus(total, focus));
        if (id) { e.preventDefault(); setEditingId((cur) => (cur === id ? null : id)); }
      }
      else if (e.key === "x") {
        const id = focusedId(queue, clampFocus(total, focus));
        if (id) { e.preventDefault(); setSelected((s) => toggleSelection(s, id)); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyboard, total, focus, queue, approve, reject, rejectingId, rejectMode, selected]);

  if (loading) return <div className="grid h-full place-items-center"><Text tone="muted">loading…</Text></div>;
  if (!total) {
    const copy = emptyCopy("review");
    return <EmptyState icon={Check} title={copy.title} hint={decided ? `${decided} reviewed this round. ${copy.hint}` : copy.hint} />;
  }

  // U5.3 — the batch target (selection wins; an empty selection defaults to the
  // safe tail — KTD4's anti-fatigue guard lives in batchTargets itself).
  const batchQueue = batchTargets(queue, selected);

  return (
    <div className="h-full overflow-y-auto p-6">
      <Stack gap="md">
        {/* the canvas toolbar (U7) — count + keyboard legend, the grouping toggle,
            and the global batch affordance, read together as one control strip
            rather than three unrelated rows. */}
        <Box pad="sm" border="hairline" radius="ui" bg="surface">
          <Stack gap="sm">
            <Inline gap="sm" justify="between">
              <Text size="meta" tone="subtle" weight="semibold">REVIEW · {total} pending</Text>
              {keyboard && <Text size="meta" tone="muted">j/k move · a approve · r reject · e edit · d diff · x select · ⇧A batch</Text>}
            </Inline>
            <Inline gap="sm" align="center">
              <Text size="meta" tone="muted">group by</Text>
              <Button variant={axis === "module" ? "outline" : "ghost"} size="sm" onClick={() => setAxis("module")}>module</Button>
              <Button variant={axis === "session" ? "outline" : "ghost"} size="sm" onClick={() => setAxis("session")}>session/run</Button>
            </Inline>
            {batchQueue.length > 0 && (
              <Inline gap="sm" align="center">
                <Text size="meta" tone="muted">{selected.size > 0 ? `${selected.size} selected` : `${batchQueue.length} safe-tail`}</Text>
                <Button variant="outline" size="sm" onClick={() => batchApprove(batchQueue)}>
                  Approve {batchQueue.length} {selected.size > 0 ? "selected" : "safe tail"}
                </Button>
                {selected.size > 0 && <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>clear</Button>}
              </Inline>
            )}
          </Stack>
        </Box>
        {Object.entries(grouped).map(([groupKey, items]) => {
          // U6/U7 — a group (module OR session/run) is its own batch-approve scope:
          // the SAME anti-fatigue `batchTargets` model U5 shipped, surfaced through
          // `groupHeader` alongside the group's total count. An explicit selection
          // intersecting this group wins outright; an empty one falls back to THIS
          // group's safe tail only — a needsScrutiny item in this group is still
          // never blind-swept.
          const header = groupHeader(axis, groupKey, items, selected);
          return (
            <Stack key={groupKey} gap="sm">
              <Inline gap="sm" align="center" justify="between">
                <Inline gap="xs" align="baseline">
                  <Text size="meta" tone="muted">{header.label}</Text>
                  <Text size="meta" tone="subtle">· {header.count}</Text>
                </Inline>
                {header.batch.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => batchApprove(header.batch)}>
                    Approve {header.batch.length} {header.batchIsSelection ? "selected" : "safe tail"} from this {axis === "session" ? "run" : "module"}
                  </Button>
                )}
              </Inline>
              {items.map((it) => (
                <ProposalCard
                  key={it.id}
                  item={it}
                  focused={it.id === focusId}
                  {...(keyboard ? {
                    diffOpen: it.id === diffOpenId,
                    onDiffOpenChange: (o: boolean) => setDiffOpenId(o ? it.id : null),
                    rejectOpen: it.id === rejectingId,
                    reasonIndex: rejectMode.reasonIndex,
                    onRejectOpenChange: (o: boolean) => (o ? openRejectFor(it.id) : closeReject()),
                    editOpen: it.id === editingId,
                    onEditOpenChange: (o: boolean) => setEditingId(o ? it.id : null),
                  } : {})}
                  selected={selected.has(it.id)}
                  onToggleSelect={(id) => setSelected((s) => toggleSelection(s, id))}
                  onApprove={approve}
                  onReject={rejectAndCount}
                  onEdit={(item, edited, targetId) => void restage(editIntent(item, edited, targetId))}
                />
              ))}
            </Stack>
          );
        })}
      </Stack>
    </div>
  );
}
