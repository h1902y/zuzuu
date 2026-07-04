// shell/review/review-flow.ts — the focused decision flow over the flat review queue
// (P2.4), extended for U5's quick gestures: a reject-taxonomy keyboard mode (`r` + a
// digit/arrow/Enter/Esc submodel), a batch selection set (`x`) whose batch-approve
// target respects the scorer's needs-scrutiny classification (KTD4 — never sweep a
// destructive/low-confidence item into a blind "approve all"), and the edit-before-
// approve intent (`e`) — see editIntent's header for the FLAGGED GAP it composes
// around. Pure → tested; the .tsx wires the keys/state onto these models.
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
