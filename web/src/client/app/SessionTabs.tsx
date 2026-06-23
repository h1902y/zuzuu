// src/client/app/SessionTabs.tsx — the terminal session tab strip.
//
// Extracted from App so the shell stays a pure layout. The select button is the
// tab (role="tab" + aria-selected, so the active session isn't conveyed by colour
// alone); the ✕ and + are accessible icon buttons.

import { useState } from "react";
import { IconButton } from "../panel/kit.js";
import { HOSTS } from "./hosts.js";

export function SessionTabs({
  sessions,
  activeId,
  onSelect,
  onClose,
  onNewSession,
}: {
  sessions: { id: string; title: string }[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNewSession: (type: "shell" | "agent", host?: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const pick = (type: "shell" | "agent", host?: string) => { onNewSession(type, host); setMenu(false); };
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
      <div className="relative flex items-stretch">
        <IconButton label="new session" onClick={() => setMenu((o) => !o)} className="px-3 text-subtle hover:bg-hover">
          +
        </IconButton>
        {menu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} aria-hidden />
            <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-ui border border-border bg-elevated py-1 shadow-xl">
              <button onClick={() => pick("shell")} className="block w-full px-3 py-1.5 text-left text-ui text-subtle hover:bg-hover">
                New shell
              </button>
              <div className="my-1 border-t border-border" />
              <div className="px-3 py-1 text-meta uppercase tracking-wide text-muted">New agent</div>
              {HOSTS.map((h) => (
                <button key={h.id} onClick={() => pick("agent", h.id)} className="block w-full px-3 py-1.5 text-left text-ui text-subtle hover:bg-hover">
                  {h.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
