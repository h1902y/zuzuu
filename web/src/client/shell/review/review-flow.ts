// shell/review/review-flow.ts — the focused decision flow over the flat review queue
// (P2.4), extended for U5's quick gestures: a reject-taxonomy keyboard mode (`r` + a
// digit/arrow/Enter/Esc submodel), a batch selection set (`x`) whose batch-approve
// target respects the scorer's needs-scrutiny classification (KTD4 — never sweep a
// destructive/low-confidence item into a blind "approve all"), and the edit-before-
// approve intent (`e`) — see editIntent's header for the FLAGGED GAP it composes
// around. Pure → tested; the .tsx wires the keys/state onto these models.
//
// The BATCH MODEL (runBatchApprove + selectionAfterBatch, below) — bug fix: a batch
// approve used to fire every item and forget it (`for (…) approve(…)`), so a partial
// daemon failure inside the batch silently no-opped (no toast, no changed count, a
// failed item still sitting in `selected` looking indistinguishable from a landed
// one). `runBatchApprove` awaits every item (never lets one failure block the rest —
// Promise.all, and it swallows a THROWN rejection too, not just a resolved `false`,
// since a mocked/real approve could surface failure either way) and partitions the
// outcome; the .tsx toasts a summary when `failed` is non-empty (reusing the existing
// toast/why(e) pattern, see use-review-queue.ts) instead of staying silent.
// `selectionAfterBatch` is the companion pure step: only the SUCCEEDED ids drop out
// of the selection — a failed item stays selected (still actionable, not silently
// dropped from view).
//
// Bug fix (multi-scenario test, live in 3 of 4 test projects) — the batch used to
// dispatch in the queue's DISPLAY order (score.ts's sortByScore: blast-radius-
// sorted, high-blast deletes/updates first). In a from-scratch build where a
// note's CREATE and an UPDATE/DELETE/DEPRECATE targeting it are BOTH pending in
// the same batch, the mutation dispatched before its target's create had landed —
// the data layer correctly refuses to update/delete a note that doesn't exist yet,
// so the approve failed ("Approved 29 of 31 — 2 failed to land"). `orderForApply`
// (below) fixes the APPLY order only: a stable phase reorder (create=0, update=1,
// delete/deprecate=2) run inside `runBatchApprove` right before dispatch. Display
// order (sortByScore) and single-item approve are unchanged.
import type { StagedSummary } from "#shared/index.js";
import type { RejectReason } from "./review-model.js";
import { isUpdate } from "./diff.js";
import { SAFE_TAIL_THRESHOLD } from "./score.js";

/** Clamp a focus index into [0, len-1]; -1 when the queue is empty. */
export function clampFocus(len: number, index: number): number {
  if (len <= 0) return -1;
  return Math.max(0, Math.min(index, len - 1));
}

/** Move focus by delta with wrap-around (j/k, ↓/↑). Empty queue → -1; an unset
 *  (-1) cursor starts at the first item. Reused verbatim by the reject-taxonomy's
 *  reason highlight (moveRejectReason below) — same wrap-over-N model. */
export function moveFocus(len: number, index: number, delta: number): number {
  if (len <= 0) return -1;
  const base = index < 0 ? 0 : index;
  return (((base + delta) % len) + len) % len;
}

/** The id at a focus index in the flat queue (null when out of range). */
export function focusedId(queue: StagedSummary[], index: number): string | null {
  return index >= 0 && index < queue.length ? (queue[index]?.id ?? null) : null;
}

// ── U5.1 — the reject-taxonomy keyboard mode (`r`) ──────────────────────────────
//
// Reject was mouse-only: ProposalCard's own Reject button opened 6 outline reason
// buttons, clicked one at a time. `r` now opens the SAME taxonomy for the FOCUSED
// card, keyboard-navigable: a digit 1..N selects+submits a reason directly (the
// fast path — reasonIndexFromKey); j/k/arrows move a highlight (moveRejectReason,
// reusing moveFocus's wrap-over-N model) and Enter submits the highlighted one (the
// deliberate path); Esc cancels back to REJECT_MODE_CLOSED.

export interface RejectMode { open: boolean; reasonIndex: number }
export const REJECT_MODE_CLOSED: RejectMode = { open: false, reasonIndex: 0 };

/** `r` on the focused card — opens the taxonomy at the first reason. */
export function openRejectMode(): RejectMode {
  return { open: true, reasonIndex: 0 };
}

/** j/k/arrows while open — moves the highlight; a no-op (returns `mode` unchanged)
 *  when the taxonomy isn't open (guards a stray call from a closed state). */
export function moveRejectReason(mode: RejectMode, count: number, delta: number): RejectMode {
  if (!mode.open) return mode;
  return { open: true, reasonIndex: moveFocus(count, mode.reasonIndex, delta) };
}

/** A digit key ("1".."9") → its 0-based reason index, iff it names a reason that
 *  exists in a taxonomy of `count` entries (1-indexed on screen, matching the
 *  numbered buttons: "1" → index 0). Non-digit keys, "0", or out-of-range → null —
 *  the caller's fast "digit selects+submits" path only fires on a real match. */
export function reasonIndexFromKey(key: string, count: number): number | null {
  if (!/^[1-9]$/.test(key)) return null;
  const n = Number(key);
  return n <= count ? n - 1 : null;
}

// ── U5.3 — the batch selection set (`x`) + the anti-fatigue batch target ───────

/** Toggle membership — pure, returns a NEW Set (never mutates `selected`), so
 *  `setSelected(s => toggleSelection(s, id))` diffs correctly as React state. */
export function toggleSelection(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

/** The batch-approve TARGET set — where KTD4's anti-fatigue guard lives. An
 *  explicit selection (the user deliberately toggled these ids with `x` — a
 *  needsScrutiny one included is a legitimate INDIVIDUAL override, not a sweep)
 *  always wins outright. An EMPTY selection is the convenience "approve the safe
 *  tail" default, and here is the guard: it filters to `score < SAFE_TAIL_THRESHOLD`
 *  ONLY (score.ts's isSafeTail line), so a blind batch-approve — nothing hand-
 *  picked — can never sweep a destructive/low-confidence (needsScrutiny) item in.
 *  Pure — returns what to approve; the .tsx loops the EXISTING dataProvider.approve
 *  over this result (KTD5 — no new landing mechanism, see use-review-queue.ts). */
export function batchTargets<T extends { id: string; score: number }>(
  items: readonly T[],
  selected: ReadonlySet<string>,
): T[] {
  if (selected.size > 0) return items.filter((it) => selected.has(it.id));
  return items.filter((it) => it.score < SAFE_TAIL_THRESHOLD);
}

/** A batch approve's outcome — which target ids landed, which didn't. Display-only
 *  (the .tsx toasts + reconciles `selected` off this); never a parallel landing
 *  mechanism — every id still resolves through the SAME injected `approveOne` (KTD5,
 *  in practice the one true `dataProvider.approve`-backed function use-review-queue.ts
 *  exposes). */
export interface BatchApproveResult {
  succeeded: string[];
  failed: string[];
}

/** op → its apply-phase: 0 (create) dispatches first, 2 (delete/deprecate)
 *  dispatches last, everything else (update, relate/unrelate, an unrecognized
 *  future op) sits in between at 1 — a safe middle default, not a claim that
 *  those ops are order-safe among themselves (out of scope; see the file header's
 *  "not a topological sort" note). An absent op defaults to "create" (mirrors
 *  diff.ts's/score.ts's own "nearly all mined proposals are creates" convention),
 *  so an untagged item never accidentally sorts AFTER a real create. */
function applyPhase(op: string | undefined): number {
  const o = op ?? "create";
  if (o === "create") return 0;
  if (o === "delete" || o === "deprecate") return 2;
  return 1;
}

/** Reorder a batch's targets for APPLY ONLY (never for display — sortByScore's
 *  blast-radius order is untouched; this runs strictly at dispatch time, inside
 *  `runBatchApprove`): create-before-update-before-delete/deprecate, by
 *  `applyPhase`. Stable within a phase — `Array.sort` is a stable sort per spec
 *  (mirrors sortByScore's own stability note), so this only REGROUPS by phase, it
 *  doesn't otherwise reshuffle. This is the fix for the observed from-scratch
 *  failure: a create's target always dispatches before any same-batch
 *  update/delete/deprecate that could depend on it existing. A full topological
 *  sort on target refs is out of scope — phase ordering is enough to fix what was
 *  actually observed. Pure — testable with no mocked approve at all. */
export function orderForApply<T extends { op?: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => applyPhase(a.op) - applyPhase(b.op));
}

/** Run a batch of approves, one per target, awaiting EVERY one (a slow/failed item
 *  never blocks or drops the rest — Promise.all) and partitioning by outcome. Pure
 *  orchestration over an INJECTED `approveOne` — never touches dataProvider/api
 *  itself, so it's testable with a mocked resolve/reject, no DOM, no react-query (see
 *  hitl-canvas.test.ts's convention). Tolerates `approveOne` either resolving `false`
 *  OR throwing/rejecting on failure — both count as a miss; only a resolved `true`
 *  counts as landed. This is the fix for the batch button's old silent no-op: a
 *  partial failure is now REPORTED, not swallowed.
 *
 *  `targets` is reordered via `orderForApply` before dispatch (the create-before-
 *  mutate fix, see the file header) — a same-batch create always dispatches before
 *  an update/delete/deprecate that targets it. */
export async function runBatchApprove(
  targets: readonly { id: string; module: string; op?: string }[],
  approveOne: (id: string, module: string) => Promise<boolean>,
): Promise<BatchApproveResult> {
  const ordered = orderForApply(targets);
  const succeeded: string[] = [];
  const failed: string[] = [];
  await Promise.all(ordered.map(async (t) => {
    let ok = false;
    try { ok = await approveOne(t.id, t.module); }
    catch { ok = false; }
    (ok ? succeeded : failed).push(t.id);
  }));
  return { succeeded, failed };
}

/** After a batch lands, drop only the ids that actually SUCCEEDED from the selection
 *  set (pure — returns a NEW Set, mirrors toggleSelection's never-mutate contract). A
 *  failed id stays selected: it's still pending and still actionable, not silently
 *  dropped from view alongside the ones that really landed. */
export function selectionAfterBatch(selected: ReadonlySet<string>, succeeded: readonly string[]): Set<string> {
  const next = new Set(selected);
  for (const id of succeeded) next.delete(id);
  return next;
}

// ── U5.2 — edit-before-approve (`e`) ────────────────────────────────────────────

/** The two-op intent editIntent resolves to — both ops already exist at the gate
 *  (reject, create/update); see editIntent's header for why this is the honest
 *  shape rather than a fabricated one-shot "land the edited version". */
export interface EditIntent {
  reject: { id: string; module: string; reason: RejectReason };
  restage: { module: string; op: "create" | "update"; target: string | null; change: Record<string, unknown> };
}

/**
 * Edit-before-approve, composed as DATA (pure — never calls dataProvider itself;
 * use-review-queue.ts's `restage` dispatches the two ops in sequence).
 *
 * FLAGGED GAP (mirrors Everything.tsx's `/items` staged note from U2): the
 * daemon's approve route (`POST /api/zuzuu/staged/:id/approve`, see lib/api.ts)
 * takes only `{module}` — no field override. There is no daemon op today that
 * lands an EDITED version of a staged change in one shot; a true edit-in-place
 * needs a server change (an approve-with-override, or a PATCH-the-staged-change
 * route) outside this pass's web/src/client/ scope. The honest client-composable
 * fallback (KTD5 — reuse the existing gate, don't invent a new landing path):
 * reject the stale proposal, then re-stage the edited fields as a FRESH proposal
 * via the existing create/update ops. Two real ops, not a fabricated one-shot
 * land — the re-staged proposal re-enters the queue PENDING like any other
 * proposal (never auto-approved — KTD4 holds).
 *
 * A second, smaller gap this composes around: a StagedSummary carries no
 * reliable target id for a CREATE (`target` is null/absent by convention for
 * creates — see StagedSummary's doc comment in #shared/zuzuu.ts). Rather than
 * silently guess one, `targetId` lets the caller (the edit form) surface an
 * editable id field for a create and pass the user's CONFIRMED value; omitted,
 * this falls back to `item.target ?? item.id` as a best-effort default. An
 * UPDATE always uses the known `item.target` — `targetId` is ignored for it.
 */
export function editIntent(item: StagedSummary, edited: Record<string, unknown>, targetId?: string): EditIntent {
  const op: "create" | "update" = isUpdate(item) ? "update" : "create";
  const target = op === "update" ? (item.target ?? null) : (targetId ?? item.target ?? item.id);
  return {
    reject: { id: item.id, module: item.module, reason: "reword" },
    restage: { module: item.module, op, target, change: { ...(item.change ?? {}), ...edited } },
  };
}
