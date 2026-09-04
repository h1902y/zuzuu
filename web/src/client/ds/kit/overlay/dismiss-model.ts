// ds/kit/overlay/dismiss-model.ts — the dismiss DECISION predicates useDismiss
// acts on (U1, curried-plotting-coral.md). Pure: no DOM, no React — tests mock
// refs/targets with plain `{ contains: () => boolean }` objects. Two questions,
// one shape: "should THIS overlay close for this input, given who's topmost."
import { isTopmost, type OverlayId, type OverlayStack } from "./overlay-stack.js";

/** Escape closes the TOPMOST overlay only — every other open overlay's handler
 *  must no-op so a single keypress never drains a lower layer. This is the
 *  direct fix for "Escape closed the background review queue instead of the
 *  foreground agent view": every overlay asks this same question, and only the
 *  frontmost one answers yes. */
export function shouldCloseOnEscape(stack: OverlayStack, id: OverlayId, key: string): boolean {
  return key === "Escape" && isTopmost(stack, id);
}

/** Anything that can answer "is this node inside me" — a real HTMLElement
 *  satisfies it via `Node.contains`; tests substitute a plain object
 *  (`{ contains: () => false }`), no DOM required. */
export interface Containable {
  contains(node: Node | null): boolean;
}

/** An outside pointerdown closes an overlay only when BOTH hold: it's the
 *  topmost overlay (a background overlay never eats a click meant for the
 *  foreground one stacked on top of it), AND the event target is truly outside
 *  its container. `container: null` (ref not yet attached — e.g. the very first
 *  paint) fails SAFE: never closes, rather than closing on every click. */
export function shouldCloseOnOutside(
  stack: OverlayStack,
  id: OverlayId,
  container: Containable | null,
  target: Node | null,
): boolean {
  if (!isTopmost(stack, id)) return false;
  if (!container) return false;
  return !container.contains(target);
}
