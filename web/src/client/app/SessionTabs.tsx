// src/client/app/SessionTabs.tsx — the terminal session tab strip.
//
// Extracted from App so the shell stays a pure layout. The select button is the
// tab (role="tab" + aria-selected, so the active session isn't conveyed by colour
// alone); the ✕ and + are accessible icon buttons.

import { IconButton } from "../panel/kit.js";

export function SessionTabs({
  sessions,
  activeId,
  onSelect,
  onClose,
  onNew,
}: {
  sessions: { id: string; title: string }[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="flex h-[var(--height-bar)] shrink-0 items-stretch border-b border-border bg-surface">
      <div role="tablist" aria-label="terminal sessions" className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`group flex max-w-[200px] items-center gap-2 border-r border-border px-3 ${
              s.id === activeId ? "bg-app text-ink-100" : "text-muted hover:text-subtle"
            }`}
          >
            <button
              role="tab"
              aria-selected={s.id === activeId}
              onClick={() => onSelect(s.id)}
              className="truncate text-ui focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              title={s.title}
            >
              {s.title || "shell"}
            </button>
            <IconButton
              label="close session"
              onClick={() => onClose(s.id)}
              className="text-muted opacity-0 group-hover:opacity-100"
            >
              ✕
            </IconButton>
          </div>
        ))}
      </div>
      <IconButton label="new shell" onClick={onNew} className="px-3 text-subtle hover:bg-hover">
        +
      </IconButton>
    </div>
  );
}
