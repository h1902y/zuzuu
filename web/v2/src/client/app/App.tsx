// src/client/app/App.tsx — the workbench shell: sidebar | session center | right.
//
// Three panes. The left is the file workspace (Sidebar); the center is the live
// terminal with a session tab strip; the right panel is a stub seam Rung 5 fills
// with the editor (files mode) and the modules dashboard. On boot we list
// sessions and open a shell if there are none, so the terminal is always live.

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { TermView } from "../term/TermView.js";
import { Sidebar } from "./Sidebar.js";
import { Footer } from "./Footer.js";
import { api } from "../lib/api.js";
import { useWorkbench } from "../state/store.js";

export function App() {
  const { sessions, activeId, refresh, open, setActive, close } = useWorkbench();
  const workspace = useQuery({ queryKey: ["workspace"], queryFn: api.workspace });

  // boot: load sessions, open a shell if there are none
  useEffect(() => {
    void (async () => {
      await refresh();
      if (useWorkbench.getState().sessions.length === 0) await open("shell");
    })();
  }, [refresh, open]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <aside className="w-[240px] shrink-0 border-r border-border">
          <Sidebar />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <SessionTabs sessions={sessions} activeId={activeId} onSelect={setActive} onClose={close} onNew={() => open("shell")} />
          <div className="min-h-0 flex-1">
            {activeId ? (
              <TermView key={activeId} sessionId={activeId} />
            ) : (
              <div className="grid h-full place-items-center text-muted">no session — press +</div>
            )}
          </div>
        </main>

        {/* Rung 5 seam: editor (files mode) + the five-ModuleTile dashboard */}
        <aside className="hidden w-[320px] shrink-0 border-l border-border bg-surface xl:block">
          <div className="grid h-full place-items-center px-4 text-center text-meta text-muted">
            right panel — editor + modules dashboard (Rung 5)
          </div>
        </aside>
      </div>
      <Footer workspace={workspace.data?.root} />
    </div>
  );
}

function SessionTabs({
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
      <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`group flex max-w-[200px] items-center gap-2 border-r border-border px-3 ${
              s.id === activeId ? "bg-app text-ink-100" : "text-muted hover:text-subtle"
            }`}
          >
            <button onClick={() => onSelect(s.id)} className="truncate text-ui" title={s.title}>
              {s.title || "shell"}
            </button>
            <button onClick={() => onClose(s.id)} className="text-muted opacity-0 group-hover:opacity-100" title="close">
              ✕
            </button>
          </div>
        ))}
      </div>
      <button onClick={onNew} className="px-3 text-subtle hover:bg-hover" title="new shell">
        +
      </button>
    </div>
  );
}
