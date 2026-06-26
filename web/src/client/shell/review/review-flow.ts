// shell/review/review-flow.ts — the focused decision flow over the flat review queue
// (P2.4). Keyboard triage: a single focus cursor moves with j/k (↑/↓), and the focused
// proposal is the target of the Approve key. Pure → tested; the .tsx wires the keys.
import type { StagedSummary } from "#shared/index.js";

/** Clamp a focus index into [0, len-1]; -1 when the queue is empty. */
export function clampFocus(len: number, index: number): number {
  if (len <= 0) return -1;
  return Math.max(0, Math.min(index, len - 1));
}

/** Move focus by delta with wrap-around (j/k, ↓/↑). Empty queue → -1; an unset
 *  (-1) cursor starts at the first item. */
export function moveFocus(len: number, index: number, delta: number): number {
  if (len <= 0) return -1;
  const base = index < 0 ? 0 : index;
  return (((base + delta) % len) + len) % len;
}

/** The id at a focus index in the flat queue (null when out of range). */
export function focusedId(queue: StagedSummary[], index: number): string | null {
  return index >= 0 && index < queue.length ? (queue[index]?.id ?? null) : null;
}
