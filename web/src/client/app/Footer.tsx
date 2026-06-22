// src/client/app/Footer.tsx — the status bar: live connection state + workspace.

import { useWorkbench } from "../state/store.js";

const DOT: Record<string, string> = {
  open: "text-accent",
  connecting: "text-muted",
  reconnecting: "text-danger",
  closed: "text-danger",
};

export function Footer({ workspace }: { workspace?: string }) {
  const status = useWorkbench((s) => s.status);
  const count = useWorkbench((s) => s.sessions.length);
  return (
    <div className="flex h-[var(--height-bar)] shrink-0 items-center gap-3 border-t border-border bg-surface px-3 text-meta text-muted">
      <span className={DOT[status] ?? "text-muted"}>● {status}</span>
      <span className="font-mono">{count} session{count === 1 ? "" : "s"}</span>
      {workspace && <span className="ml-auto truncate font-mono" title={workspace}>{workspace}</span>}
    </div>
  );
}
