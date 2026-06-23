// src/client/app/App.tsx — the workbench shell: sidebar | session center | right.
//
// Three panes. The left is the file workspace (Sidebar); the center is the live
// terminal with a session tab strip; the right panel (RightPanel) is one surface
// with two modes — the editor (files) and the modules dashboard. A global ⌘P/⌘K
// palette floats over it. On boot we open a shell if there are none.

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { TermView } from "../term/TermView.js";
import { Sidebar } from "./Sidebar.js";
import { SessionTabs } from "./SessionTabs.js";
import { Footer } from "./Footer.js";
import { RightPanel } from "../panel/RightPanel.js";
import { Composer } from "../composer/Composer.js";
import { Palette } from "../palette/Palette.js";
import { api } from "../lib/api.js";
import { useWorkbench } from "../state/store.js";
import { usePanel } from "../state/panel.js";

export function App() {
  // selector form (not whole-store destructure) so the shell doesn't re-render on
  // terminal `status` blips it never reads — only on the slices it actually uses.
  const sessions = useWorkbench((s) => s.sessions);
  const activeId = useWorkbench((s) => s.activeId);
  const refresh = useWorkbench((s) => s.refresh);
  const open = useWorkbench((s) => s.open);
  const setActive = useWorkbench((s) => s.setActive);
  const close = useWorkbench((s) => s.close);
  const openFile = usePanel((s) => s.openFile);
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
          <Sidebar onOpenFile={openFile} />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <SessionTabs sessions={sessions} activeId={activeId} onSelect={setActive} onClose={close} onNewSession={(type, host) => open(type, host)} />
          <div className="flex min-h-0 flex-1 flex-col">
            {activeId ? (
              <>
                <div className="min-h-0 flex-1">
                  <TermView key={activeId} sessionId={activeId} />
                </div>
                {sessions.find((s) => s.id === activeId)?.type === "agent" && (
                  <Composer key={activeId} sessionId={activeId} />
                )}
              </>
            ) : (
              <div className="grid h-full place-items-center text-muted">no session — press +</div>
            )}
          </div>
        </main>

        {/* the one right-hand surface: editor (files mode) ⇆ modules dashboard */}
        <aside className="hidden w-[340px] shrink-0 border-l border-border bg-surface xl:block">
          <RightPanel />
        </aside>
      </div>
      <Footer workspace={workspace.data?.root} />
      <Palette />
    </div>
  );
}
