// src/client/composer/HostPill.tsx — shows the active agent session's host and
// opens a small menu to start another agent. Opens upward since the composer
// sits at the bottom.
//
// U4 (curried-plotting-coral.md): migrated onto ds/kit/Popover (the "Base UI's
// Popover" this file's old comment anticipated) — the hand-rolled full-screen
// scrim div is gone, replaced by outside-click + topmost-only Escape from the
// shared overlay stack. `closeOnSelect` + `PopoverItem`: picking a host closes
// the menu, same as before. `placement="above-left"` matches the pre-existing
// opens-upward `bottom-full left-0`; `className` preserves its own z-50/shadow-xl
// (higher-stacked than the rest of the toolbar popovers, unchanged from before).
import { useState } from "react";
import { HOSTS } from "../app/hosts.js";
import { useWorkbench } from "../state/store.js";
import { Popover, PopoverItem } from "../ds/index.js";

export function HostPill({ sessionId }: { sessionId: string }) {
  const host = useWorkbench((s) => s.sessions.find((x) => x.id === sessionId)?.host);
  const open = useWorkbench((s) => s.open);
  const [menu, setMenu] = useState(false);
  const label = HOSTS.find((h) => h.id === host)?.label ?? host ?? "agent";

  return (
    <div className="relative">
      <button
        onClick={() => setMenu((o) => !o)}
        className="flex h-7 items-center rounded-ui px-2 text-meta text-subtle transition-colors hover:bg-hover hover:text-ink-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus"
        title="active agent — click to start another"
      >
        {label} ▾
      </button>
      {menu && (
        <Popover
          open
          onClose={() => setMenu(false)}
          closeOnSelect
          placement="above-left"
          className="z-50 mb-1 w-40 rounded-ui border border-border bg-elevated py-1 shadow-xl"
        >
          <div className="px-3 py-1 text-meta uppercase tracking-wide text-muted">New agent</div>
          {HOSTS.map((h) => (
            <PopoverItem
              key={h.id}
              onSelect={() => void open("agent", h.id)}
              className="block w-full px-3 py-1.5 text-left text-ui text-subtle hover:bg-hover"
            >
              {h.label}
            </PopoverItem>
          ))}
        </Popover>
      )}
    </div>
  );
}
