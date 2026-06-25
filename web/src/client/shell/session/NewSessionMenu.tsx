// shell/session/NewSessionMenu.tsx — the nav's "+ new session" affordance, now with
// a host picker. "New shell" or any host CLI (an agent session); either way the new
// session is selected into the stage (useStartSession redirects). This is the only
// entry point to a FIRST agent session — the Composer's HostPill only appears once
// you already have one. Static layout utilities only (the ds-no-inline guard).
import { useState } from "react";
import { HOSTS } from "../../app/hosts.js";
import { newSessionItems } from "./new-session-items.js";
import { useStartSession } from "./use-start-session.js";
import { Text } from "../../ds/index.js";

export function NewSessionMenu() {
  const start = useStartSession();
  const [open, setOpen] = useState(false);
  const items = newSessionItems(HOSTS);

  return (
    <div className="relative">
      <Text as="button" size="meta" tone="muted" onClick={() => setOpen((o) => !o)}>+ new session</Text>
      {open && (
        <>
          <button type="button" aria-label="close" onClick={() => setOpen(false)} className="fixed inset-0 z-10 cursor-default" />
          <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-ui border border-border bg-elevated py-1 shadow-lg">
            {items.map((it) => (
              <button
                key={it.key}
                type="button"
                onClick={() => { void start(it.type, it.host); setOpen(false); }}
                className="block w-full px-3 py-1.5 text-left text-ui text-subtle transition-colors hover:bg-hover hover:text-ink-100"
              >
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
