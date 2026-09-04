// ds/kit/overlay/use-dismiss.ts — the ONE dismissal contract every overlay
// composes (U1, curried-plotting-coral.md). Registers with the shared stack for
// the overlay's open lifetime; Escape closes ONLY the topmost overlay; an
// outside pointerdown closes it too, guarded the same way. Replaces ~20
// independent `window` Escape listeners (Dialog, Diff, GlobalSettings,
// NewProject, ReviewQueue, Switcher, …) and 7 copy-pasted outside-click scrims
// (TableBuilders x3, FieldConfigPanel, SaveViewForm, EmojiPicker, NewSessionMenu,
// HostPill, Switcher).
//
// MECHANISM (why "topmost-only" actually holds): every currently-open overlay's
// keydown/pointerdown listener sits on the SAME target (`window`/`document`), so
// on a given keypress ALL of them fire — `stopPropagation` does not stop sibling
// listeners registered on one target (only `stopImmediatePropagation` does, and
// even that can't order per-overlay listeners correctly since they're
// independent `addEventListener` calls). So correctness comes from the GUARD, not
// from propagation: each listener asks `shouldCloseOnEscape`/`shouldCloseOnOutside`
// first, which checks `isTopmost`, and no-ops otherwise. `e.stopPropagation()` is
// still called on a genuine close (belt-and-suspenders for any element-level
// listener sitting between the event target and window in the bubble path) but
// nothing here depends on it — the guard is load-bearing.
import { useEffect, useRef, type RefObject } from "react";
import { useOverlayStack } from "./overlay-stack-context.js";
import { shouldCloseOnEscape, shouldCloseOnOutside } from "./dismiss-model.js";
import type { OverlayId } from "./overlay-stack.js";

export interface UseDismissOptions {
  /** A stable id, unique among CURRENTLY OPEN overlays. A semantic string is fine
   *  for a singleton surface ("settings-dialog", "review-queue"); an overlay that
   *  can have several live instances at once (a per-column popover) should use
   *  React's `useId()` so each mounted instance gets its own stack slot. */
  id: OverlayId;
  onClose: () => void;
  /** Escape closes this overlay when it's topmost. Default true. */
  closeOnEscape?: boolean;
  /** An outside pointerdown closes this overlay when it's topmost. Default true. */
  closeOnOutside?: boolean;
  /** The overlay's own root DOM node — "outside" is outside THIS. */
  ref: RefObject<HTMLElement | null>;
  /** Master gate, default true. `false` makes this call a total no-op: no stack
   *  registration, no Escape listener, no outside-click listener. Exists for a
   *  caller that must call this hook UNCONDITIONALLY (hooks can't be conditional —
   *  see the doc below) but sometimes isn't really open/dismissable — e.g.
   *  ds/kit/Dialog.tsx's locked case (`onClose` omitted): it still calls
   *  `useDismiss` every render, with `enabled: false`, so the locked dialog
   *  registers NOTHING on the shared stack (never blocks or dismisses). */
  enabled?: boolean;
}

/**
 * Call for exactly as long as the overlay is open/mounted — it registers on
 * mount and unregisters on unmount (the LIFO position is simply "when did this
 * overlay open," so nested opens stack in the natural order and out-of-order
 * closes remove only themselves — see overlay-stack.ts's popOverlay).
 *
 * Hooks can't be called conditionally, so a caller that renders `null` while
 * closed (`if (!open) return null`, as ds/kit/Dialog.tsx already does) must call
 * this ABOVE that early return — the same rule as any other hook.
 */
export function useDismiss({ id, onClose, closeOnEscape = true, closeOnOutside = true, enabled = true, ref }: UseDismissOptions): void {
  const { stack, register, unregister } = useOverlayStack();

  // register for the mount's lifetime — but only while `enabled` (see the option's
  // doc: a locked Dialog calls this hook every render with `enabled: false` and
  // must not occupy a stack slot).
  useEffect(() => {
    if (!enabled) return;
    register(id);
    return () => unregister(id);
  }, [enabled, id, register, unregister]);

  // read through a ref so the listener effects below don't need to re-subscribe
  // just because the caller passed a fresh `onClose` closure this render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // re-subscribes whenever the STACK changes (any overlay opening/closing can
  // flip who's topmost) — cheap (a handful of open overlays at most) and far
  // simpler to reason about than shadowing the stack in a ref.
  useEffect(() => {
    if (!enabled || !closeOnEscape) return;
    function onKeyDown(e: KeyboardEvent) {
      if (!shouldCloseOnEscape(stack, id, e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      onCloseRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, closeOnEscape, stack, id]);

  useEffect(() => {
    if (!enabled || !closeOnOutside) return;
    function onPointerDown(e: PointerEvent) {
      if (!shouldCloseOnOutside(stack, id, ref.current, e.target as Node | null)) return;
      onCloseRef.current();
    }
    // capture phase: an inside click that itself calls stopPropagation (common
    // for a row/button inside the overlay) must not defeat outside-detection for
    // OTHER overlays — capture sees the event before any bubble-phase
    // stopPropagation can intervene. Listening on `document` (not `window`)
    // matches where the overlay's own DOM actually lives for `contains` checks.
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [enabled, closeOnOutside, stack, id, ref]);
}
