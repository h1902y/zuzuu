// ds/kit/Dialog.tsx — a centered modal over a scrim (Notion-calm). The one governed
// dialog primitive: surfaces compose it instead of hand-rolling a scrim + panel. The
// scrim and Esc dismiss (via onClose — omit it to lock the dialog while a task runs,
// e.g. a merge in flight); the panel owns title · body · footer actions. Token-bound,
// reusing the same overlay tokens as the review wing.
import { useEffect, type ReactNode } from "react";
import { Text, Inline } from "../primitives/index.js";

export function Dialog({ open, title, onClose, children, footer }: {
  open: boolean;
  title: string;
  /** scrim click + Esc dismiss; omit (undefined) to make the dialog non-dismissable. */
  onClose?: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <button type="button" aria-label="dismiss dialog" onClick={onClose} className="animate-fade fixed inset-0 z-40 bg-scrim" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-pop fixed inset-x-0 top-1/4 z-50 mx-auto flex w-96 flex-col gap-4 rounded-lg border border-border bg-elevated p-5 shadow-overlay"
      >
        <Text size="lg" weight="semibold">{title}</Text>
        <div>{children}</div>
        <Inline gap="sm" justify="end">{footer}</Inline>
      </div>
    </>
  );
}
