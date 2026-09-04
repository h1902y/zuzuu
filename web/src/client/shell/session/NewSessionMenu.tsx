// shell/session/NewSessionMenu.tsx — the nav's "+ new session" affordance, now with
// a host picker. "New shell" or any host CLI (an agent session); either way the new
// session is selected into the stage (useStartSession redirects). This is the only
// entry point to a FIRST agent session — the Composer's HostPill only appears once
// you already have one. Static layout utilities only (the ds-no-inline guard).
//
// U4 (curried-plotting-coral.md): the hand-rolled full-screen scrim button is
// gone — composes the shared Popover (U2, `closeOnSelect`) + `PopoverItem` rows,
// single-select: picking a host closes the menu, same as before, now via the
// primitive instead of a manual `setOpen(false)` in every item's onClick.
import { useState } from "react";
import { HOSTS } from "../../app/hosts.js";
import { newSessionItems } from "./new-session-items.js";
import { useStartSession } from "./use-start-session.js";
import { Text, Popover, PopoverItem } from "../../ds/index.js";

export function NewSessionMenu() {
  const start = useStartSession();
  const [open, setOpen] = useState(false);
  const items = newSessionItems(HOSTS);

  return (
    <div className="relative">
      <Text as="button" interactive size="meta" tone="muted" onClick={() => setOpen((o) => !o)}>+ new session</Text>
      {open && (
        <Popover
          open
          onClose={() => setOpen(false)}
          closeOnSelect
          className="z-20 mt-1 w-44 rounded-ui border border-border bg-elevated py-1 shadow-overlay"
        >
          {items.map((it) => (
            <PopoverItem
              key={it.key}
              onSelect={() => void start(it.type, it.host)}
              className="block w-full px-3 py-1.5 text-left text-ui text-subtle transition-colors hover:bg-hover hover:text-ink-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-focus"
            >
              {it.label}
            </PopoverItem>
          ))}
        </Popover>
      )}
    </div>
  );
}
