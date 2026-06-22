// src/client/panel/kit.tsx — the few shared panel primitives.

import type { ReactNode } from "react";

/** The panel header bar — the one place the bar height/border lives. `title` as a
 *  string gets the default label style; pass a node for a custom label (e.g. a
 *  mono truncated filename). `right` is pinned to the far edge. */
export function PanelHeader({ title, onBack, right }: { title: ReactNode; onBack?: () => void; right?: ReactNode }) {
  return (
    <div className="flex h-[var(--height-bar)] shrink-0 items-center gap-2 border-b border-border px-3">
      {onBack && (
        <button onClick={onBack} className="text-muted hover:text-subtle" title="back">←</button>
      )}
      {typeof title === "string" ? <span className="text-ui text-ink-100">{title}</span> : title}
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}

/** Centered muted message — empty/loading/error states. */
export function Centered({ children }: { children: ReactNode }) {
  return <div className="grid h-full place-items-center px-6 text-center text-meta text-muted">{children}</div>;
}
