// shell/session/new-session-items.ts — the pure model for the "new session" menu.
// "New shell" plus one item per host CLI (an agent session). Ids match the daemon's
// command allowlist via app/hosts.ts. The .tsx menu (NewSessionMenu) renders these.

export interface HostDef { id: string; label: string }

export interface NewSessionItem {
  key: string;
  label: string;
  type: "shell" | "agent";
  /** the host CLI command for an agent session (absent for the shell). */
  host?: string;
}

export function newSessionItems(hosts: HostDef[]): NewSessionItem[] {
  return [
    { key: "shell", label: "New shell", type: "shell" },
    ...hosts.map((h) => ({ key: h.id, label: h.label, type: "agent" as const, host: h.id })),
  ];
}
