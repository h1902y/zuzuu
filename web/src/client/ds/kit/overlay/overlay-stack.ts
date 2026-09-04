// ds/kit/overlay/overlay-stack.ts — the shared overlay-dismissal FOUNDATION (U1,
// curried-plotting-coral.md). Today, ~20 overlays each own a private open/close
// boolean with no notion of z-order, so a single Escape keypress fires every
// listener and the wrong layer closes (the review overlay eats it before the
// foreground agent view ever sees it). This file replaces "20 booleans" with ONE
// LIFO stack of open overlay ids — the single source of truth for "what's on top"
// that Escape/outside-click decisions (dismiss-model.ts) are built on.
//
// Pure — no DOM, no React. The thin binding (register on mount, unregister on
// unmount) lives in overlay-stack-context.tsx; the decision predicates that
// consume `isTopmost` live in dismiss-model.ts.
export type OverlayId = string;

/** Open overlays, oldest first — the LAST entry is the frontmost (LIFO: the most
 *  recently opened overlay is topmost, same as a stack of windows). */
export type OverlayStack = readonly OverlayId[];

export const EMPTY_OVERLAY_STACK: OverlayStack = [];

/** Register an overlay as open. Idempotent: re-pushing an id already in the stack
 *  is a no-op, NOT a reorder — React (StrictMode, or a caller re-registering on a
 *  prop change) can call this more than once for the same open overlay, and that
 *  must never bump it above overlays that opened after it. */
export function pushOverlay(stack: OverlayStack, id: OverlayId): OverlayStack {
  return stack.includes(id) ? stack : [...stack, id];
}

/** Unregister an overlay, wherever it sits — this is NOT "pop the last entry."
 *  Overlays close out of order (a background Dialog can be dismissed
 *  programmatically while a foreground Popover is still open), so removal is
 *  always by id. A pop for an id that isn't present is a safe no-op. */
export function popOverlay(stack: OverlayStack, id: OverlayId): OverlayStack {
  return stack.includes(id) ? stack.filter((x) => x !== id) : stack;
}

/** The frontmost open overlay, or null when nothing is open. */
export function topOf(stack: OverlayStack): OverlayId | null {
  return stack.length ? (stack[stack.length - 1] ?? null) : null;
}

/** Is `id` the frontmost overlay right now? The one predicate Escape and
 *  outside-click decisions (dismiss-model.ts) are both built on. */
export function isTopmost(stack: OverlayStack, id: OverlayId): boolean {
  return topOf(stack) === id;
}

/** The reducer form — a useReducer-friendly wrapper over push/pop so the React
 *  binding (overlay-stack-context.tsx) can hold a stable `dispatch` instead of
 *  closures that would otherwise need to be rebuilt on every stack change. */
export type OverlayStackAction = { type: "push"; id: OverlayId } | { type: "pop"; id: OverlayId };

export function overlayStackReducer(stack: OverlayStack, action: OverlayStackAction): OverlayStack {
  switch (action.type) {
    case "push": return pushOverlay(stack, action.id);
    case "pop": return popOverlay(stack, action.id);
  }
}
