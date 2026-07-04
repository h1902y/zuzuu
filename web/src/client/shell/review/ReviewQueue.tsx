// shell/review/ReviewQueue.tsx — the unified cross-session proposal queue (the gate).
// Pending proposals grouped by module; each a ProposalCard. Rendered in the session
// wing AND the global review overlay. The overlay (and, since U5, the wing when the
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
// up" empty state. Static utilities only.
import { useEffect, useState } from "react";
import { useReviewQueue } from "./use-review-queue.js";
import {
  clampFocus, moveFocus, focusedId,
  openRejectMode, moveRejectReason, reasonIndexFromKey, REJECT_MODE_CLOSED,
  toggleSelection, batchTargets, editIntent,
} from "./review-flow.js";
import { REJECT_REASONS } from "./review-model.js";
import { Check } from "lucide-react";
import { ProposalCard } from "./ProposalCard.js";
import { emptyCopy } from "../empty-copy.js";
import { Stack, Inline, Text, Button, EmptyState } from "../../ds/index.js";

export function ReviewQueue({ keyboard }: { keyboard?: boolean } = {}) {
  const { queue, grouped, total, loading, approve, reject, restage } = useReviewQueue();
  const [focus, setFocus] = useState(0);
  const [decided, setDecided] = useState(0);
  const [diffOpenId, setDiffOpenId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectMode, setRejectMode] = useState(REJECT_MODE_CLOSED);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const focusIdx = clampFocus(total, focus);
  const focusId = keyboard ? focusedId(queue, focusIdx) : null;

  const rejectAndCount = (id: string, module: string, reason: string) => { setDecided((n) => n + 1); reject(id, module, reason); };
  const openRejectFor = (id: string) => { setRejectingId(id); setRejectMode(openRejectMode()); };
  const closeReject = () => { setRejectingId(null); setRejectMode(REJECT_MODE_CLOSED); };
  const batchApprove = (targets: { id: string; module: string }[]) => {
    if (!targets.length) return;
    for (const t of targets) approve(t.id, t.module);
    setDecided((n) => n + targets.length);
    setSelected(new Set());
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
        if (target) { e.preventDefault(); setDecided((n) => n + 1); approve(target.id, target.module); }
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
        <Inline gap="sm" justify="between">
          <Text size="meta" tone="subtle" weight="semibold">REVIEW · {total} pending</Text>
          {keyboard && <Text size="meta" tone="muted">j/k move · a approve · r reject · e edit · d diff · x select · ⇧A batch</Text>}
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
        {Object.entries(grouped).map(([module, items]) => (
          <Stack key={module} gap="sm">
            <Text size="meta" tone="muted">{module}</Text>
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
        ))}
      </Stack>
    </div>
  );
}
