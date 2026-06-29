// shell/WorkbenchShell.tsx — the Stage + Wings frame (R1): nav · stage · wing + the
// footer ribbon, no modes. The selection (world-state) drives which stage + wing actor
// mounts (shell-state.selectActors). The terminal stage re-houses the proven TermView +
// Composer unchanged; grid/record/wing are placeholders until U5–U8 fill them. The
// frame uses static layout utilities (no inline styles / arbitrary values); content
// composes from ds primitives.
import { useEffect, useRef, useState } from "react";
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
import { sessionTabs } from "./session/session-tabs.js";
import { toast } from "../state/toast.js";
import { Checklist } from "./onboarding/Checklist.js";
import { onboardingStep, recordConsent, reopen, RUNG_ROUTE, type ConsentRecord, type PrepRungId } from "./onboarding/onboarding-state.js";
import { loadConsent, saveConsent } from "./onboarding/onboarding-consent.js";
import { Overview } from "./overview/Overview.js";
import { Grid } from "./stage/Grid.js";
import { Record } from "./stage/Record.js";
import { ModuleGraph } from "./stage/ModuleGraph.js";
import { BrainGraph } from "./graph/BrainGraph.js";
import { Search } from "./search/Search.js";
import { Settings } from "./settings/Settings.js";
import { StageHeader } from "./stage/StageHeader.js";
import { stageHeaderModel, newNoteId, resolveTab, type StageTab } from "./stage/stage-header.js";
import { ReviewQueue } from "./review/ReviewQueue.js";
import { Form } from "./wing/Form.js";
import { Schema } from "./wing/Schema.js";
import { dataProvider } from "../data/provider.js";
import { Plus, Power } from "lucide-react";
import { Palette } from "../palette/Palette.js";
import { useEndSession } from "../state/end-session.js";
import { EndSessionDialog } from "./session/EndSessionDialog.js";
import { Loading, ThemeToggle, AppHeader, Text } from "../ds/index.js";
import { useReview } from "../state/review.js";
import { NavTree } from "./NavTree.js";
import { Switcher } from "./switcher/Switcher.js";
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
  const [moduleView, setModuleView] = useState<string>("table"); // the module stage's Table·Graph tab (P2.7)
  const [sessionView, setSessionView] = useState<string>("terminal"); // the session stage's Terminal·Changes tab (P2.8)
  const reviewOpen = useReview((s) => s.open);
  const setReview = useReview((s) => s.setOpen);
  const setPalette = useWorld((s) => s.setPalette);
  const requestEnd = useEndSession((s) => s.request);

  useEffect(() => { void refresh(); }, [refresh]); // load sessions; home is the database (no auto-open)

  // Reset each stage's tab when the SELECTION changes, so a tab choice (Graph /
  // Changes) never leaks to the next module/session (it's a per-node view, not global).
  const moduleId = selected?.kind === "module" ? selected.id : null;
  const sessionId = selected?.kind === "session" ? selected.id : null;
  useEffect(() => { setModuleView("table"); }, [moduleId]);
  useEffect(() => { setSessionView("terminal"); }, [sessionId]);

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

  // The setup→work stitch: onboarding picks a HOST (an agent session — zuzuu only
  // observes agents), then drops into the terminal AND teaches the loop just entered.
  async function onStartSession(type: "shell" | "agent", host?: string) {
    setBusy("session");
    try {
      await startSession(type, host);
      toast("Session started — zuzuu is watching. It proposes changes you review (press R).");
    } catch { toast("Couldn't start a session", "error"); }
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

  // The per-step CONSENT GATE (U3): setup no longer auto-fires. A durable consent record
  // (localStorage, per-workspace) + the mechanical state derive the onboarding step; the
  // Checklist renders each rung's narration + consent affordance, and only an affirmative
  // flips a rung to "executing" — which the effect below then runs. Resumable across
  // reload/tabs (PR5); decline → a reversible dormant state (U6).
  const workspaceRoot = workspace.data?.root ?? "";
  const [consent, setConsent] = useState<ConsentRecord>({});
  useEffect(() => { if (workspaceRoot) setConsent(loadConsent(workspaceRoot)); }, [workspaceRoot]);
  const onboardStep = pState !== undefined ? onboardingStep(pState, consent) : null;
  const persistConsent = (next: ConsentRecord) => {
    setConsent(next);
    if (workspaceRoot) saveConsent(workspaceRoot, next);
  };
  const affirmRung = (rung: PrepRungId) => persistConsent(recordConsent(consent, rung, "consented"));
  const declineRung = (rung: PrepRungId) => persistConsent(recordConsent(consent, rung, "declined"));
  const reopenRung = (rung: PrepRungId) => persistConsent(reopen(consent, rung));

  // Run a consented setup step (U3): fire its daemon route only once the rung is
  // "executing" (the user affirmed), then refetch so the next rung surfaces. A ref guards
  // re-entry; a failed step toasts (U6 will surface it in-conversation with retry).
  const prepping = useRef(false);
  const executingRung = onboardStep?.kind === "executing" ? onboardStep.rung : null;
  useEffect(() => {
    if (prepping.current || !executingRung) return;
    prepping.current = true;
    void (async () => {
      try { await api.setup[RUNG_ROUTE[executingRung]](); }
      catch { toast("A setup step failed — see Settings", "error"); }
      finally {
        prepping.current = false;
        await qc.invalidateQueries({ queryKey: ["zuzuu", "project-state"] });
      }
    })();
  }, [executingRung, qc]);

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
      : header.primary?.key === "end-session" && activeSession
        ? { label: "End session", icon: Power, variant: "outline" as const, onClick: () => requestEnd(activeSession) }
        : null;
  // the stage tab strips: a module's Table·Graph (P2.7), a session's Terminal·Changes (P2.8).
  const MODULE_TABS: StageTab[] = [{ key: "table", label: "Table" }, { key: "graph", label: "Graph" }];
  const totalPending = Object.values(pendingByModule).reduce((n, v) => n + v, 0);
  const SESSION_TABS = sessionTabs(totalPending);
  const activeModuleTab = resolveTab(MODULE_TABS, moduleView);
  const activeSessionTab = resolveTab(SESSION_TABS, sessionView);
  const stageTabs = selected?.kind === "module" ? MODULE_TABS : selected?.kind === "session" ? SESSION_TABS : undefined;
  const activeTab = selected?.kind === "module" ? activeModuleTab : selected?.kind === "session" ? activeSessionTab : undefined;
  const onTab = selected?.kind === "module" ? setModuleView : selected?.kind === "session" ? setSessionView : undefined;

  return (
    <div className="flex h-full flex-col">
      <AppHeader
        leading={<Switcher />}
        actions={
          <>
            <Text as="button" interactive size="meta" tone="muted" onClick={() => setPalette(true)}>⌘K</Text>
            <ThemeToggle />
          </>
        }
      />

      <div className="flex min-h-0 flex-1">
        <NavTree />

        <main className="flex min-w-0 flex-1 flex-col bg-app">
          {header.show && (
            <StageHeader crumb={stageCrumb} primary={stagePrimary} tabs={stageTabs} activeTab={activeTab} onTab={onTab} />
          )}
          <div className="flex min-h-0 flex-1 flex-col">
            {sel.stage === "terminal" && sessionNode ? (
              activeSessionTab === "changes" ? (
                // the brain proposals this work is staging (click-driven; the overlay owns keyboard)
                <ReviewQueue />
              ) : (
                <>
                  {/* One terminal pane PER session, kept mounted — only the active is
                      visible. Switching toggles visibility, never remounts, so a switch
                      never reattaches/replays (no flicker, and the live alt-screen TUI
                      is preserved instead of replayed-without-alt-buffer). */}
                  <div className="relative min-h-0 flex-1">
                    {sessions.map((s) => (
                      <div
                        key={s.id}
                        aria-hidden={s.id !== sessionNode.id}
                        className={s.id === sessionNode.id ? "absolute inset-0 z-10" : "invisible absolute inset-0"}
                      >
                        <TermView sessionId={s.id} active={s.id === sessionNode.id} />
                      </div>
                    ))}
                  </div>
                  {activeSession?.type === "agent" && <Composer key={sessionNode.id} sessionId={sessionNode.id} />}
                </>
              )
            ) : sel.stage === "grid" && selected?.kind === "module" ? (
              activeModuleTab === "graph" ? <ModuleGraph module={selected.id} /> : <Grid module={selected.id} />
            ) : sel.stage === "record" && selected?.kind === "row" ? (
              <Record module={selected.module} id={selected.id} />
            ) : sel.stage === "graph" ? (
              <BrainGraph />
            ) : sel.stage === "search" ? (
              <Search />
            ) : sel.stage === "settings" ? (
              <Settings />
            ) : onboarding && pState ? (
              <Checklist projectName={workspace.data?.name ?? "this project"} step={onboardStep} onAffirm={affirmRung} onDecline={declineRung} onReopen={reopenRung} onStartSession={onStartSession} starting={busy === "session"} />
            ) : projectState.isLoading || overview.isLoading ? (
              <Loading />
            ) : (
              <Overview
                name={workspace.data?.name ?? "this project"}
                emoji={workspace.data?.emoji}
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
      <EndSessionDialog />
    </div>
  );
}
