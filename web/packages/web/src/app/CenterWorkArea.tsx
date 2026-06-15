// WS-C — the CENTER work-area router.
//
// Renders ONE surface by strict precedence (see state/center-precedence.ts):
//   (1) editor open  → the EditorPane (Monaco tabs + previews)
//   (2) module sel.  → that module's detail (ModuleView) with a Back control
//   (3) session sel. → that session's detail (SessionDetail) with a Back control
//   (4) home         → the sessions home: the live session terminal (SessionPane)
//                      with the relocated session history above it.
import { lazy, Suspense } from "react";
import { useEditor } from "../state/editor";
import { useRightPanel } from "../state/right-panel";
import { centerView } from "../state/center-precedence";
import { SessionPane } from "./SessionPane";
import { ModuleView } from "../panel/ModuleView";
import { SessionDetail } from "../panel/SessionDetail";
import { SessionsSection } from "../panel/SessionsSection";

// Lazy boundary: the editor pane graph (Monaco wrapper, markdown/CSV/cast
// previews) rides its own chunk — loaded the first time a file opens.
const EditorPane = lazy(() =>
  import("../editor/EditorPane").then((m) => ({ default: m.EditorPane })));

export function CenterWorkArea({ zuzuuHome }: { zuzuuHome: boolean }) {
  const hasOpenFiles = useEditor((s) => s.openFiles.length > 0);
  const selection = useRightPanel((s) => s.selection);
  const closeCenter = useRightPanel((s) => s.closeCenter);

  const view = centerView(hasOpenFiles, selection);

  if (view.kind === "editor") {
    return (
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-ui text-ink-500">
            loading editor…
          </div>
        }
      >
        <EditorPane />
      </Suspense>
    );
  }

  if (view.kind === "module") {
    return (
      <DetailShell onBack={closeCenter}>
        <ModuleView moduleKey={view.key} />
      </DetailShell>
    );
  }

  if (view.kind === "session") {
    return (
      <DetailShell onBack={closeCenter}>
        <SessionDetail sessionId={view.id} />
      </DetailShell>
    );
  }

  // home — the sessions surface (terminal + composer) with the history above
  return (
    <div className="flex h-full min-w-0 flex-col">
      {zuzuuHome && (
        <div className="max-h-[40%] shrink-0 overflow-y-auto border-b border-border bg-surface p-3">
          <SessionsSection />
        </div>
      )}
      <div className="min-h-0 flex-1">
        <SessionPane />
      </div>
    </div>
  );
}

/** A scrollable detail shell with a Back control that clears the selection. */
function DetailShell({ onBack, children }: { onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="flex h-full min-w-0 flex-col bg-surface">
      <div className="flex h-[34px] shrink-0 items-center border-b border-border px-3">
        <button
          onClick={onBack}
          className="wc-sans flex items-center gap-1 text-meta text-ink-500 transition-colors hover:text-ink-200"
          title="Back to sessions"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 4l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
