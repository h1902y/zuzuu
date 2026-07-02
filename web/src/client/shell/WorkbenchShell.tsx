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
import { api, ApiError } from "../lib/api.js";
import { brainEvents } from "../lib/brain-events.js";
import { useModuleView, viewOf, type ModuleView } from "../state/module-view.js";
import { useWorldCommand } from "../state/world-command.js";
import { FilterChips } from "./stage/FilterChips.js";
import { useWorkbench } from "../state/store.js";
import { useWorld } from "./world-state.js";
import { selectActors } from "./shell-state.js";
import { homeMode, currentRung, type RungId } from "./project-home-state.js";
import { useStartSession } from "./session/use-start-session.js";
import { sessionTabs } from "./session/session-tabs.js";
import { toast } from "../state/toast.js";
import { Checklist } from "./onboarding/Checklist.js";
import { companionView } from "./onboarding/companion-state.js";
import { onboardingStep, recordConsent, reopen, RUNG_ROUTE, describeSetupFailure, type ConsentRecord, type PrepRungId, type SetupFailure } from "./onboarding/onboarding-state.js";
import { loadConsent, saveConsent } from "./onboarding/onboarding-consent.js";
import { Overview } from "./overview/Overview.js";
import { Grid } from "./stage/Grid.js";
import { Everything } from "./stage/Everything.js";
import { Record } from "./stage/Record.js";
import { AcpView } from "./stage/AcpView.js";
import { World } from "./stage/World.js";
import { Search } from "./search/Search.js";
import { Settings } from "./settings/Settings.js";
import { StageHeader } from "./stage/StageHeader.js";
import { stageHeaderModel, newNoteId, resolveTab, type StageTab } from "./stage/stage-header.js";
import { ReviewQueue } from "./review/ReviewQueue.js";
import { Form } from "./wing/Form.js";
import { NewNoteForm } from "./wing/NewNoteForm.js";
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
  // the module stage's Table⇄Map projection lives in a per-module store so the
  // T shortcut and the palette (>table / >map) reach it from anywhere
  const viewByModule = useModuleView((s) => s.byModule);
  const setModuleView = useModuleView((s) => s.set);
  const [sessionView, setSessionView] = useState<string>("terminal"); // the session stage's Terminal·Changes tab (P2.8)
  const reviewOpen = useReview((s) => s.open);
  const setReview = useReview((s) => s.setOpen);
  const setPalette = useWorld((s) => s.setPalette);
  const requestEnd = useEndSession((s) => s.request);

  useEffect(() => { void refresh(); }, [refresh]); // load sessions; home is the database (no auto-open)

  // The brain-state push (/ws/zuzuu): a staged proposal, a landed row, or a schema
  // change invalidates ["zuzuu"] the moment its file lands — an agent turn visibly
  // grows the project without waiting for a refetch cycle ("watch it build").
  useEffect(() => {
    brainEvents.start(() => void qc.invalidateQueries({ queryKey: ["zuzuu"] }));
  }, [qc]);

  // The session tab resets on selection change (a per-node view). The MODULE view
  // does not: it lives per-module in the module-view store — a choice never leaks
  // to the NEXT module (the C1 rule holds), and a return visit keeps its projection.
  const sessionId = selected?.kind === "session" ? selected.id : null;
  useEffect(() => { setSessionView("terminal"); }, [sessionId]);

  // Global shortcuts: ⌘K opens the omnibar; R toggles the review gate; T flips the
  // module stage's Table⇄Map projection (unless typing / in a terminal).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette(true); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
      if (e.key === "r" || e.key === "R") { e.preventDefault(); setReview(!useReview.getState().open); }
      else if (e.key === "t" || e.key === "T") {
        // ONE continuous space, two projections — T toggles them in a module context;
        // on the unified Everything it flips table ⇄ the FULL World (the '' scope);
        // deep inside an island on the World home, T crystallizes it into its table;
        // on the plain World home, T opens Everything (the table of what you see).
        const sel = useWorld.getState().selected;
        if (sel?.kind === "module") { e.preventDefault(); useModuleView.getState().toggle(sel.id); }
        else if (sel?.kind === "everything") { e.preventDefault(); useModuleView.getState().toggle(""); }
        else if (sel === null) {
          const deep = useWorldCommand.getState().deep;
          e.preventDefault();
          if (deep) {
            useModuleView.getState().set(deep, "table");
            select({ kind: "module", id: deep });
          } else {
            useModuleView.getState().set("", "table");
            select({ kind: "everything" });
          }
        }
      }
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

  // "New note" (the module stage's primary): FORM-FIRST (audit item 3) — open the
  // draft wing (typed fields, required markers) and stage on save. The old blind
  // `{title: "Untitled note"}` stage could never be approved on a schema'd module.
  function onNewNote(module: string) {
    select({ kind: "draft", module });
  }

  const sel = selectActors(selected);
  const sessionNode = selected?.kind === "session" ? selected : null;
  const activeSession = sessionNode ? sessions.find((s) => s.id === sessionNode.id) : null;
  const modules = overview.data?.modules ?? [];
  const pendingByModule = Object.fromEntries(modules.map((m) => [m.id, m.counts?.pending ?? 0]));
  const sessionsLite = sessions.map((s) => ({ id: s.id, live: s.alive, lastActiveAt: s.createdAt }));
  const pState: ProjectStateKind | undefined = projectState.data?.state;
  // content modules (beyond the safety floor) flip the home to the map even when a
  // later rung is open — the checklist stays reachable via the nav setup node
  const contentModules = modules.filter((m) => m.id !== "instructions" && m.id !== "guardrails").length;
  const onboarding = pState !== undefined && homeMode(pState, contentModules) === "onboarding";
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
  const reopenRung = (rung: PrepRungId) => { setSetupError(null); persistConsent(reopen(consent, rung)); };

  // U6: a failed setup step surfaces IN the onboarding surface (the Checklist), not a
  // detached toast — with a Retry. 503 (CLI absent) is non-retryable; other failures retry
  // by bumping the nonce (re-runs the effect against the still-consented rung).
  const [setupError, setSetupError] = useState<SetupFailure | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const retrySetup = () => { setSetupError(null); setRetryNonce((n) => n + 1); };

  // Run a consented setup step (U3): fire its daemon route only once the rung is
  // "executing" (the user affirmed), then refetch so the next rung surfaces. A ref guards
  // re-entry; a failure lands in setupError (U6) for the Checklist to surface with retry.
  const prepping = useRef(false);
  const executingRung = onboardStep?.kind === "executing" ? onboardStep.rung : null;
  useEffect(() => {
    if (prepping.current || !executingRung) return;
    const rung = executingRung;
    prepping.current = true;
    void (async () => {
      try { await api.setup[RUNG_ROUTE[rung]](); setSetupError(null); }
      catch (e) { setSetupError(describeSetupFailure(rung, e instanceof ApiError ? e.status : 0)); }
      finally {
        prepping.current = false;
        await qc.invalidateQueries({ queryKey: ["zuzuu", "project-state"] });
      }
    })();
  }, [executingRung, retryNonce, qc]);

  // the governed stage-header (P2.1): a friendly breadcrumb + the stage's primary action.
  const header = stageHeaderModel(selected);
  const moduleTitle = (id: string) => modules.find((m) => m.id === id)?.title ?? id;
  const stageCrumb =
    selected?.kind === "everything" ? ["Everything"]
    : selected?.kind === "module" ? [moduleTitle(selected.id)]
    : selected?.kind === "row" || selected?.kind === "note" ? [moduleTitle(selected.module), selected.id]
    : selected?.kind === "draft" ? [moduleTitle(selected.module), "new note"]
    : selected?.kind === "session" ? [activeSession?.title || "session"]
    : [];
  const stagePrimary =
    header.primary?.key === "new-note" && selected?.kind === "module"
      ? { label: "New note", icon: Plus, onClick: () => onNewNote(selected.id) }
      : header.primary?.key === "end-session" && activeSession
        ? { label: "End session", icon: Power, variant: "outline" as const, onClick: () => requestEnd(activeSession) }
        : null;
  // the stage tab strips: a module's Table⇄Map segmented toggle (one control, two
  // projections of one space — `T` flips it), a session's Terminal·Changes (P2.8).
  const MODULE_TABS: StageTab[] = [{ key: "table", label: "Table" }, { key: "graph", label: "Map" }];
  const totalPending = Object.values(pendingByModule).reduce((n, v) => n + v, 0);
  const SESSION_TABS = sessionTabs(totalPending);
  // the unified Everything scope keys the module-view/filter stores at '' — the
  // same Table⇄Map grammar, project-wide
  const everythingTab = selected?.kind === "everything" ? resolveTab(MODULE_TABS, viewOf(viewByModule, "")) : undefined;
  const activeModuleTab = selected?.kind === "module" ? resolveTab(MODULE_TABS, viewOf(viewByModule, selected.id)) : undefined;
  const activeSessionTab = resolveTab(SESSION_TABS, sessionView);
  const stageTabs = selected?.kind === "module" || selected?.kind === "everything" ? MODULE_TABS : selected?.kind === "session" ? SESSION_TABS : undefined;
  const activeTab = selected?.kind === "module" ? activeModuleTab : selected?.kind === "everything" ? everythingTab : selected?.kind === "session" ? activeSessionTab : undefined;
  const onTab = selected?.kind === "module"
    ? (key: string) => setModuleView(selected.id, key as ModuleView)
    : selected?.kind === "everything"
      ? (key: string) => setModuleView("", key as ModuleView)
      : selected?.kind === "session" ? setSessionView : undefined;

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
              // the Map projection mounts the WHOLE world, focused on this module —
              // physics is project-level (two coupled sims); focus is a camera move.
              // The shared filter rides both projections: chips above the map name
              // the spotlight; the same lens filters the table.
              // the projection swap CRYSTALLIZES (keyed fade — the island resolving
              // into rows and back; a full FLIP node→row correspondence is future polish)
              activeModuleTab === "graph" ? (
                <div key="map" className="animate-fade flex min-h-0 flex-1 flex-col">
                  <FilterChips module={selected.id} />
                  <div className="min-h-0 flex-1"><World focus={selected.id} /></div>
                </div>
              ) : (
                <div key="table" className="animate-fade flex min-h-0 flex-1 flex-col">
                  <Grid module={selected.id} />
                </div>
              )
            ) : sel.stage === "everything" ? (
              // one table over everything (module = a column/facet) — same two
              // projections: T flips to the FULL World, the '' lens spotlighted
              everythingTab === "graph" ? (
                <div key="emap" className="animate-fade flex min-h-0 flex-1 flex-col">
                  <FilterChips module="" />
                  <div className="min-h-0 flex-1"><World lens="" /></div>
                </div>
              ) : (
                <div key="etable" className="animate-fade flex min-h-0 flex-1 flex-col">
                  <Everything />
                </div>
              )
            ) : sel.stage === "grid" && selected?.kind === "draft" ? (
              // the New-note draft: the module's table stays visible; the form is the wing
              <Grid module={selected.module} />
            ) : sel.stage === "record" && selected?.kind === "row" ? (
              <Record module={selected.module} id={selected.id} />
            ) : sel.stage === "search" ? (
              <Search />
            ) : sel.stage === "settings" ? (
              <Settings />
            ) : sel.stage === "acp" && selected?.kind === "acp" ? (
              <AcpView id={selected.id} />
            ) : projectState.isLoading || overview.isLoading ? (
              <Loading />
            ) : sel.stage === "world" && !onboarding ? (
              // MAP-FIRST (C1): the steady-state home is the World — the whole Project
              // as the living map. Onboarding keeps the Overview+checklist below
              // (the map never takes over a first-run); Overview stays one click away.
              <World />
            ) : (
              // U5: no hard-swap — the home always renders; onboarding composes IN as a
              // receding companion block (no full-stage takeover), so completing the last
              // rung recedes in place instead of snapping to the dashboard.
              <Overview
                name={workspace.data?.name ?? "this project"}
                emoji={workspace.data?.emoji}
                path={workspace.data?.root ?? ""}
                enabled={projectState.data?.host.enabled ?? false}
                modules={modules}
                sessions={sessions}
                onStartSession={() => void startSession()}
                onReview={() => setReview(true)}
                companion={onboarding && pState ? (
                  <Checklist projectName={workspace.data?.name ?? "this project"} companion step={onboardStep} failure={setupError} onAffirm={affirmRung} onDecline={declineRung} onReopen={reopenRung} onRetry={retrySetup} onStartSession={onStartSession} starting={busy === "session"} />
                ) : undefined}
                segue={pState !== undefined && companionView(pState, sessions.length).segue}
              />
            )}
          </div>
        </main>

        {sel.wing !== "none" && (
          <aside className="hidden w-96 shrink-0 flex-col border-l border-border bg-surface xl:flex">
            {sel.wing === "review" ? (
              <ReviewQueue />
            ) : sel.wing === "form" && selected?.kind === "draft" ? (
              <NewNoteForm key={selected.module} module={selected.module} />
            ) : sel.wing === "form" && (selected?.kind === "row" || selected?.kind === "note") ? (
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
