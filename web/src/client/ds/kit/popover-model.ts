// ds/kit/popover-model.ts — the pure bits behind Popover.tsx (U2, curried-plotting
// -coral.md). No DOM, no React — the same split TableBuilders.tsx's own model file
// (table-model.ts) and the overlay/ dir (dismiss-model.ts) use: logic here, JSX in
// the sibling component, so the behavior is testable without mounting anything.

/** Where the panel sits relative to its anchor. Default ("below-left") is exactly
 *  TableBuilders.tsx's existing `top-full left-0` (below the trigger, left-aligned) —
 *  U2 generalizes that shape, it doesn't redesign it. */
export type PopoverPlacement = "below-left" | "below-right" | "above-left" | "above-right";

const PLACEMENT_CLASSES: Record<PopoverPlacement, string> = {
  "below-left": "top-full left-0",
  "below-right": "top-full right-0",
  "above-left": "bottom-full left-0",
  "above-right": "bottom-full right-0",
};

/** The position classes for a placement — token-bound (no arbitrary values), a
 *  straight lookup so every placement is exhaustively accounted for. */
export function placementClasses(placement: PopoverPlacement): string {
  return PLACEMENT_CLASSES[placement];
}

/** An explicit id wins (the U4 sibling-popover coordinator names a popover so it
 *  can steer/inspect the stack); otherwise fall back to the caller's `useId()`
 *  value, so every Popover instance still gets a stable stack slot even when the
 *  caller doesn't care to name it. */
export function resolveOverlayId(explicitId: string | undefined, generatedId: string): string {
  return explicitId ?? generatedId;
}

/** Wraps a single-select pick so it can ALSO close the popover — the contract
 *  `PopoverItem` composes. `onSelect` always fires (the pick itself must never be
 *  skipped); `onClose` fires afterward, and only when `closeOnSelect` is true.
 *  This is the one piece of "does picking an option close the menu" logic, kept
 *  separate from JSX so U4's Group/Sort-close-on-pick vs Filter-stays-open split
 *  is a single boolean, not a per-surface reimplementation. */
export function makeSelectHandler(onSelect: () => void, onClose: () => void, closeOnSelect: boolean): () => void {
  return () => {
    onSelect();
    if (closeOnSelect) onClose();
  };
}
