// U1 — Shared section-collapse primitive for the module detail page.
//
// A section shell: a header row (title + optional count badge + optional action
// slot + a chevron) that toggles the body via the shadcn Collapsible (Radix).
// Open-state is read/written through the module-sections store keyed by
// `(moduleId, sectionId)` — state persists across module switches.
//
// The CALLER decides the default-open policy via `defaultOpen` (U2 will pass:
// pending>0 → open, Items → open, Versions/Schema/README → closed).
import type { ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../components/ui-shadcn/collapsible";
import { useModuleSections } from "../../state/module-sections";
import { cx } from "../../components/ui/primitives";

export function CollapsibleSection({
  moduleId,
  id,
  title,
  count,
  action,
  defaultOpen = false,
  children,
}: {
  /** The parent module's id — namespaces the collapse key. */
  moduleId: string;
  /** The section id — unique within a module (e.g. "pending", "items"). */
  id: string;
  /** The section title — displayed as an uppercase eyebrow label. */
  title: string;
  /** Optional count badge (shown when > 0). */
  count?: number;
  /** Optional trailing action slot (e.g. an "Add" button). */
  action?: ReactNode;
  /** Whether the section should start open when never user-toggled. */
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const isOpen = useModuleSections((s) => s.isOpen(moduleId, id, defaultOpen));
  const toggle = useModuleSections((s) => s.toggle);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={() => toggle(moduleId, id)}
    >
      {/* ── Section header ──────────────────────────────────────────── */}
      <CollapsibleTrigger asChild>
        <button
          aria-expanded={isOpen}
          className={cx(
            "group flex w-full items-center gap-1.5 py-2 transition-colors",
            "hover:text-ink-100",
          )}
        >
          {/* Title: eyebrow style */}
          <span className="wc-eyebrow">{title}</span>

          {/* Count badge: only when > 0 */}
          {count !== undefined && count > 0 && (
            <span className="wc-mono text-meta text-muted leading-none rounded bg-elevated px-1.5 py-0.5 text-ink-300">
              {count}
            </span>
          )}

          {/* Action slot: pushed to the right, stops collapse propagation */}
          {action && (
            /* eslint-disable-next-line jsx-a11y/click-events-have-key-events */
            <span
              role="presentation"
              className="ml-auto flex shrink-0 items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              {action}
            </span>
          )}

          {/* Chevron — rotates when open */}
          <span
            aria-hidden
            className={cx(
              "shrink-0 text-ink-500 transition-transform duration-150",
              action ? "ml-1" : "ml-auto", // when action present, chevron stays right after it
              isOpen && "rotate-180",
            )}
          >
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      </CollapsibleTrigger>

      {/* ── Section body ────────────────────────────────────────────── */}
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}
