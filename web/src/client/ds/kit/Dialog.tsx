// ds/kit/Dialog.tsx — a centered modal over a scrim (Notion-calm). The one governed
// dialog primitive: surfaces compose it instead of hand-rolling a scrim + panel. The
// scrim div stays (the dim); dismissal (Escape when topmost + an outside pointerdown)
// now comes from useDismiss (U1/U3, curried-plotting-coral.md) — Dialog no longer owns
// a private `window` keydown listener.
//
// Omit `onClose` to lock the dialog (e.g. a merge in flight): useDismiss is still
// called every render (hooks can't be conditional — same rule ds/kit/Popover.tsx
// follows) but with `enabled: false`, so a locked dialog registers NOTHING on the
// shared stack and never closes — the same "omit onClose ⇒ non-dismissable" contract
// as before.
//
// The panel owns title · body · footer actions (title/footer are both optional — a
// child that renders its own heading, or a modal whose action lives inline with its
// title instead of a bottom row, can omit either). `className` overrides the compact
// confirm-dialog shape (the default: centered, w-96, top-1/4, p-5 — EndSessionDialog's
// shape) with a caller's own position/size/padding while keeping the shared chrome
// (border/shadow/bg/rounded/animate) — GlobalSettings/NewProject/Diff's modal/the
// WorkbenchShell Settings dialog each need a different panel; this is dismissal
// unification, not a redesign.
import { useId, useRef, type ReactNode } from "react";
import { Text, Inline } from "../primitives/index.js";
import { useDismiss } from "./overlay/index.js";

const noop = () => {};

export function Dialog({
  open, title, onClose, children, footer, id, className = "inset-x-0 top-1/4 mx-auto w-96 p-5",
}: {
  open: boolean;
  /** omit entirely for a dialog whose child owns its own heading (e.g. the
   *  WorkbenchShell Settings dialog, whose `<Settings>` body renders its own
   *  "Settings" heading) — no title slot is rendered at all. */
  title?: ReactNode;
  /** scrim click + Esc dismiss (when topmost); omit (undefined) to make the dialog
   *  non-dismissable. */
  onClose?: () => void;
  children: ReactNode;
  /** omit entirely for a dialog with no bottom action row (e.g. Diff's modal, whose
   *  Done button lives inline with its title) — no footer slot is rendered at all. */
  footer?: ReactNode;
  /** a stable id, unique among currently-open overlays — see useDismiss's own doc.
   *  Defaults to a generated (`useId`) one; name it explicitly only if a coordinator
   *  elsewhere needs to reference this dialog's stack slot. */
  id?: string;
  /** panel position/size/padding, e.g. "inset-x-6 top-24 mx-auto w-full max-w-xl p-6"
   *  — defaults to the compact confirm-dialog shape (EndSessionDialog's). */
  className?: string;
}) {
  const generatedId = useId();
  const overlayId = id ?? generatedId;
  const ref = useRef<HTMLDivElement | null>(null);

  // Called UNCONDITIONALLY, above the `if (!open)` early return below — hooks can't
  // be conditional. `enabled` folds BOTH gates (open, and "is this dialog even
  // dismissable") into the one flag useDismiss expects: closed, or locked
  // (`onClose` omitted), both mean "register nothing."
  useDismiss({
    id: overlayId,
    onClose: onClose ?? noop,
    closeOnEscape: true,
    closeOnOutside: true,
    enabled: open && onClose !== undefined,
    ref,
  });

  if (!open) return null;
  return (
    <>
      <button type="button" aria-label="dismiss dialog" onClick={onClose} className="animate-fade fixed inset-0 z-40 bg-scrim" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={`animate-pop fixed z-50 flex flex-col gap-4 rounded-lg border border-border bg-elevated shadow-overlay ${className}`}
      >
        {title !== undefined && (typeof title === "string" ? <Text size="lg" weight="semibold">{title}</Text> : title)}
        {/* min-h-0: lets this flex item shrink below its content's natural height —
            a no-op for the common short-content dialog, but load-bearing for a
            wide/tall one (Diff's modal) whose own child scrolls internally
            (overflow-y-auto + min-h-0) instead of overflowing the panel. */}
        <div className="min-h-0">{children}</div>
        {footer !== undefined && <Inline gap="sm" justify="end">{footer}</Inline>}
      </div>
    </>
  );
}
