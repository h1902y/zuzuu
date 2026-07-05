// ds/kit/Popover.tsx — the shared anchored popover primitive (U2, curried-plotting
// -coral.md). Generalizes the `Panel` + `Scrim` shape TableBuilders.tsx hand-rolls
// three times (Filter/Group/Sort) — same tokens, same look, no redesign — so U4 can
// convert it and the other ~6 copy-pasted anchored popovers (SaveViewForm,
// FieldConfigPanel, EmojiPicker, NewSessionMenu, HostPill, Switcher) onto ONE
// primitive instead of each re-inventing outside-click + Escape.
//
// Composes useDismiss (U1): outside-pointerdown and topmost-only Escape come from
// the shared overlay stack — there is no more hand-rolled "invisible full-screen
// Scrim button" here, `useDismiss`'s capture-phase `document` pointerdown listener
// replaces it.
//
// Not a modal — no scrim dims the page. The caller owns the anchor: render the
// trigger button and `<Popover>` together inside a shared `position: relative`
// wrapper (exactly as TableBuilders.tsx's `<div className="relative">` does today)
// so the panel's `absolute` positioning resolves against it.
import { createContext, useContext, useId, useRef, type ReactNode } from "react";
import { useDismiss } from "./overlay/index.js";
import { makeSelectHandler, placementClasses, resolveOverlayId, type PopoverPlacement } from "./popover-model.js";

export type { PopoverPlacement } from "./popover-model.js";

interface PopoverContextValue {
  onClose: () => void;
  /** Do PopoverItem picks inside this popover also close it? Set on the Popover
   *  itself (not per-item) so a whole panel is either "single-select, closes on
   *  pick" (Group/Sort) or "multi-add, stays open" (Filter) — never a mix. */
  closeOnSelect: boolean;
}

const PopoverCtx = createContext<PopoverContextValue | null>(null);

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** A stable id, unique among currently-open overlays — see useDismiss's own
   *  doc. Omit it for a `useId()`-generated one (the common case: a per-column
   *  popover that can have several live instances at once); pass an explicit
   *  string when a coordinator (U4's Grid.tsx sibling-popover mutual exclusion)
   *  needs to name this popover to steer or inspect the stack directly. */
  id?: string;
  /** Where the panel sits relative to its anchor. Default matches
   *  TableBuilders.tsx's existing `top-full left-0` (below, left-aligned). */
  placement?: PopoverPlacement;
  /** When true, any `PopoverItem`'s pick also closes this popover (Group/Sort:
   *  single-select). Leave false (default) for a multi-add surface like Filter's
   *  "+ add condition", which must stay open across picks. */
  closeOnSelect?: boolean;
  children: ReactNode;
}

/**
 * An anchored panel that dismisses via the shared overlay stack instead of a
 * private scrim: an outside pointerdown, or Escape when it's the topmost
 * overlay, calls `onClose`. Same visual shape as `TableBuilders.tsx`'s `Panel`
 * (`animate-pop absolute z-20 mt-1 w-72 rounded-ui border bg-elevated p-2
 * shadow-overlay`) — this is a shared primitive, not a redesign.
 */
export function Popover({ open, onClose, id, placement = "below-left", closeOnSelect = false, children }: PopoverProps) {
  const generatedId = useId();
  const overlayId = resolveOverlayId(id, generatedId);
  const ref = useRef<HTMLDivElement | null>(null);

  // Called UNCONDITIONALLY, above the `if (!open)` early return below — hooks
  // can't be conditional, and use-dismiss.ts documents this exact rule for any
  // overlay (like ds/kit/Dialog.tsx) that renders null while closed.
  useDismiss({ id: overlayId, onClose, closeOnEscape: true, closeOnOutside: true, ref });

  if (!open) return null;

  return (
    <div
      ref={ref}
      className={`animate-pop absolute z-20 mt-1 w-72 rounded-ui border border-border bg-elevated p-2 shadow-overlay ${placementClasses(placement)}`}
    >
      <PopoverCtx.Provider value={{ onClose, closeOnSelect }}>{children}</PopoverCtx.Provider>
    </div>
  );
}

export interface PopoverItemProps {
  /** Fires on pick — always. If the enclosing Popover has `closeOnSelect`, the
   *  popover also closes right after (see popover-model.ts's makeSelectHandler). */
  onSelect: () => void;
  disabled?: boolean;
  /** Token-bound state classes only (e.g. the selected/hover treatment Group/Sort
   *  rows already use in TableBuilders.tsx) — no arbitrary values. */
  className?: string;
  children: ReactNode;
}

/**
 * A single-select row for use inside a `Popover`. Reads `onClose`/`closeOnSelect`
 * from context so a pick can close its parent popover without every caller
 * re-wiring that by hand — this is the "clean way for single-select menus to
 * close on pick" U4's Group/Sort panels adopt; a multi-add surface (Filter) just
 * renders its own buttons instead of `PopoverItem` and stays open regardless.
 */
export function PopoverItem({ onSelect, disabled, className, children }: PopoverItemProps) {
  const ctx = useContext(PopoverCtx);
  const handleClick = makeSelectHandler(onSelect, ctx?.onClose ?? (() => {}), ctx?.closeOnSelect ?? false);
  return (
    <button type="button" onClick={handleClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}
