// src/client/composer/HostPill.tsx — shows the active agent session's host and
// opens a small menu to start another agent. Reuses the minimal dropdown pattern
// from SessionTabs (zero new dep); migrate to Base UI's Popover when it ships GA
// (currently 1.0.0-rc). Opens upward since the composer sits at the bottom.

import { useState } from "react";
import { HOSTS } from "../app/hosts.js";
import { useWorkbench } from "../state/store.js";

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
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} aria-hidden />
          <div className="absolute bottom-full left-0 z-50 mb-1 w-40 rounded-ui border border-border bg-elevated py-1 shadow-xl">
            <div className="px-3 py-1 text-meta uppercase tracking-wide text-muted">New agent</div>
            {HOSTS.map((h) => (
              <button
                key={h.id}
                onClick={() => { void open("agent", h.id); setMenu(false); }}
                className="block w-full px-3 py-1.5 text-left text-ui text-subtle hover:bg-hover"
              >
                {h.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
