// shell/WorkbenchShell.tsx — the Stage + Wings frame (R1): nav · stage · wing + the
// footer ribbon, no modes. The selection (world-state) drives which stage + wing actor
// mounts (shell-state.selectActors). The terminal stage re-houses the proven TermView +
// Composer unchanged; grid/record/wing are placeholders until U5–U8 fill them. The
// frame uses static layout utilities (no inline styles / arbitrary values); content
// composes from ds primitives.
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ProjectStateKind } from "#shared/index.js";
import { TermView } from "../term/TermView.js";
import { Composer } from "../composer/Composer.js";
import { api } from "../lib/api.js";
import { useWorkbench } from "../state/store.js";
import { useWorld } from "./world-state.js";
import { selectActors } from "./shell-state.js";
import { homeMode, currentRung, type RungId } from "./project-home-state.js";
import { useStartSession } from "./session/use-start-session.js";
import { toast } from "../state/toast.js";
import { Checklist } from "./onboarding/Checklist.js";
import { Overview } from "./overview/Overview.js";
import { Grid } from "./stage/Grid.js";
import { Record } from "./stage/Record.js";
import { StageHeader } from "./stage/StageHeader.js";
import { stageHeaderModel, newNoteId } from "./stage/stage-header.js";
import { ReviewQueue } from "./review/ReviewQueue.js";
import { Form } from "./wing/Form.js";
import { Schema } from "./wing/Schema.js";
import { dataProvider } from "../data/provider.js";
import { Plus } from "lucide-react";
import { Palette } from "../palette/Palette.js";
import { Loading, ThemeToggle } from "../ds/index.js";
import { useReview } from "../state/review.js";
import { Text } from "../ds/index.js";
import { NavTree } from "./NavTree.js";
import { Ribbon } from "./Ribbon.js";

/** Terse ribbon nudge per current rung (R8) — shown only when home isn't visible. */
const RUNG_HINT: Record<RungId, string> = {
  "git-init": "not a Project yet",
  init: "initialize the Project",
  enable: "enable your agent",
  session: "start a session",
  review: "review your first proposal",
};

function Placeholder({ label }: { label: string }) {
  return <div className="grid h-full place-items-center"><Text tone="muted">{label}</Text></div>;
}

export function WorkbenchShell() {
  const sessions = useWorkbench((s) => s.sessions);
  const refresh = useWorkbench((s) => s.refresh);
  const selected = useWorld((s) => s.selected);
  const select = useWorld((s) => s.select);
  const startSession = useStartSession();
  const workspace = useQuery({ queryKey: ["workspace"], queryFn: api.workspace });
  const overview = useQuery({ queryKey: ["zuzuu", "overview"], queryFn: api.zuzuu.overview });
  const projectState = useQuery({ queryKey: ["zuzuu", "project-state"], queryFn: api.zuzuu.projectState });
  const qc = useQueryClient();
  const [busy, setBusy] = useState<RungId | null>(null);
  const reviewOpen = useReview((s) => s.open);
  const setReview = useReview((s) => s.setOpen);
  const setPalette = useWorld((s) => s.setPalette);

  useEffect(() => { void refresh(); }, [refresh]); // load sessions; home is the database (no auto-open)

  // Global shortcuts: ⌘K opens the omnibar; R toggles the review gate (unless typing / in a terminal).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette(true); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
      if (e.key === "r" || e.key === "R") { e.preventDefault(); setReview(!useReview.getState().open); }
      else if (e.key === "Escape") setReview(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setReview, setPalette]);

  // Fire a real setup verb, then refetch so the home advances on TRUE state (D4).
  async function onRung(r: RungId) {
    setBusy(r);
    try {
      if (r === "git-init") await api.setup.gitInit();
      else if (r === "init") await api.setup.init();
      else if (r === "enable") await api.setup.enable();
      else if (r === "session") await startSession();
      // review: the by-doing handoff — the first proposal lands in the ribbon (R7)
    } catch { toast(`Couldn't ${r}`, "error"); }
    finally { setBusy(null); void qc.invalidateQueries({ queryKey: ["zuzuu"] }); }
  }

  // "New note" (the module stage's primary): a create → a PENDING proposal (the gate),
  // never a landed row — it surfaces in the review queue.
  async function onNewNote(module: string) {
    try {
      await dataProvider.create(module, newNoteId(Date.now()), { title: "Untitled note", body: "" });
      toast("New note staged for review");
      void qc.invalidateQueries({ queryKey: ["zuzuu"] });
    } catch { toast("Couldn't stage the note", "error"); }
  }

  const sel = selectActors(selected);
  const sessionNode = selected?.kind === "session" ? selected : null;
  const activeSession = sessionNode ? sessions.find((s) => s.id === sessionNode.id) : null;
  const modules = overview.data?.modules ?? [];
  const pendingByModule = Object.fromEntries(modules.map((m) => [m.id, m.counts?.pending ?? 0]));
  const sessionsLite = sessions.map((s) => ({ id: s.id, live: s.alive, lastActiveAt: s.createdAt }));
  const pState: ProjectStateKind | undefined = projectState.data?.state;
  const onboarding = pState !== undefined && homeMode(pState) === "onboarding";
  // ribbon setup nudge (R8) — only when home (the checklist) isn't the current view, so the same prompt never double-surfaces
  const setupHint = pState !== undefined && pState !== "steady" && selected !== null ? RUNG_HINT[currentRung(pState)] : undefined;

  // the governed stage-header (P2.1): a friendly breadcrumb + the stage's primary action.
  const header = stageHeaderModel(selected);
  const moduleTitle = (id: string) => modules.find((m) => m.id === id)?.title ?? id;
  const stageCrumb =
    selected?.kind === "module" ? [moduleTitle(selected.id)]
    : selected?.kind === "row" ? [moduleTitle(selected.module), selected.id]
    : selected?.kind === "session" ? [activeSession?.title || "session"]
    : [];
  const stagePrimary =
    header.primary?.key === "new-note" && selected?.kind === "module"
      ? { label: "New note", icon: Plus, onClick: () => void onNewNote(selected.id) }
      : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-5">
        <Text as="button" interactive size="meta" tone="muted" onClick={() => setPalette(true)}>⌘K</Text>
        <div className="ml-auto"><ThemeToggle /></div>
      </div>

      <div className="flex min-h-0 flex-1">
        <NavTree />

        <main className="flex min-w-0 flex-1 flex-col bg-app">
          {header.show && <StageHeader crumb={stageCrumb} primary={stagePrimary} />}
          <div className="flex min-h-0 flex-1 flex-col">
            {sel.stage === "terminal" && sessionNode ? (
              <>
                <div className="min-h-0 flex-1"><TermView key={sessionNode.id} sessionId={sessionNode.id} /></div>
                {activeSession?.type === "agent" && <Composer key={sessionNode.id} sessionId={sessionNode.id} />}
              </>
            ) : sel.stage === "grid" && selected?.kind === "module" ? (
              <Grid module={selected.id} />
            ) : sel.stage === "record" && selected?.kind === "row" ? (
              <Record module={selected.module} id={selected.id} />
            ) : onboarding && pState ? (
              <Checklist state={pState} onRung={onRung} busy={busy} />
            ) : projectState.isLoading || overview.isLoading ? (
              <Loading />
            ) : (
              <Overview
                name={workspace.data?.name ?? "this project"}
                path={workspace.data?.root ?? ""}
                enabled={projectState.data?.host.enabled ?? false}
                modules={modules}
                sessions={sessions}
                onPickModule={(id) => select({ kind: "module", id })}
                onPickSession={(id) => select({ kind: "session", id })}
                onStartSession={() => void startSession()}
                onReview={() => setReview(true)}
              />
            )}
          </div>
        </main>

        {sel.wing !== "none" && (
          <aside className="hidden w-96 shrink-0 flex-col border-l border-border bg-surface xl:flex">
            {sel.wing === "review" ? (
              <ReviewQueue />
            ) : sel.wing === "form" && selected?.kind === "row" ? (
              <Form module={selected.module} id={selected.id} />
            ) : sel.wing === "schema" && selected?.kind === "module" ? (
              <Schema module={selected.id} />
            ) : (
              <Placeholder label="—" />
            )}
          </aside>
        )}
      </div>

      <Ribbon sessions={sessionsLite} pendingByModule={pendingByModule} setupHint={setupHint} onReview={() => setReview(true)} />

      {reviewOpen && (
        <>
          <button type="button" aria-label="close review" onClick={() => setReview(false)} className="animate-fade fixed inset-0 z-40 bg-scrim" />
          <div className="animate-pop fixed inset-x-0 top-12 z-50 mx-auto flex max-h-96 w-96 flex-col overflow-hidden rounded-lg border border-border bg-elevated shadow-overlay">
            <ReviewQueue keyboard />
          </div>
        </>
      )}

      <Palette />
    </div>
  );
}
