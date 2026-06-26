// ds/kit/ListCard.tsx — the standardised list card. A consistent card shell (resting
// hairline → hover lift) whose LEADING slot sits BESIDE the open-button (not inside
// it) — so an interactive leading (e.g. an emoji picker) works without nesting a
// button in a button. The title (+ badge), subtitle, and trailing meta make up the
// click target that opens the row. Every list row shares this; callers fill the slots.
import type { ReactNode } from "react";
import { Text } from "../primitives/index.js";

export function ListCard({ leading, title, badge, subtitle, trailing, onClick }: {
  /** an element left of the title — may be interactive (it's its own sibling, not nested). */
  leading?: ReactNode;
  /** the primary label — standardised as Text base/medium, truncating. */
  title: string;
  /** a small chip beside the title (e.g. an "open" marker). */
  badge?: ReactNode;
  /** a muted second line (e.g. a path). */
  subtitle?: string;
  /** the right-aligned meta cluster (counts, time). */
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div className="group flex w-full items-center gap-3 rounded-ui border border-border bg-surface px-5 py-4 transition-colors hover:border-ink-600 hover:bg-hover">
      {leading}
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus rounded-ui"
      >
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <Text size="base" weight="medium" truncate>{title}</Text>
            {badge}
          </div>
          {subtitle && <Text size="meta" tone="muted" truncate>{subtitle}</Text>}
        </div>
        {trailing && <div className="flex shrink-0 items-center gap-4">{trailing}</div>}
      </button>
    </div>
  );
}
