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
import { selectActors, shouldClearWorldSelectionOnEscape } from "./shell-state.js";
import { onboardingWallShows, currentRung, type RungId } from "./project-home-state.js";
import { useStartSession } from "./session/use-start-session.js";
import { sessionTabs } from "./session/session-tabs.js";
import { toast } from "../state/toast.js";
import { Checklist } from "./onboarding/Checklist.js";
import { SetupPill } from "./onboarding/SetupPill.js";
import { companionView } from "./onboarding/companion-state.js";
import { onboardingStep, recordConsent, reopen, RUNG_ROUTE, describeSetupFailure, type ConsentRecord, type PrepRungId, type SetupFailure } from "./onboarding/onboarding-state.js";
import { loadConsent, saveConsent } from "./onboarding/onboarding-consent.js";
import { hudModel } from "./overview/overview-model.js";
import { HudPill } from "./HudPill.js";
import { projectionSwitch, type ProjTarget } from "./projection-switch.js";
import { ProjectionToggle } from "./ProjectionToggle.js";
import { Flow } from "./stage/Flow.js";
import { flowTarget, isWorkflowAddr } from "./stage/flow-switch.js";
import { useAppSurface } from "../state/app-surface.js";
import { useSettingsDialog } from "../state/settings-dialog.js";
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
import { Plus, Power, Orbit } from "lucide-react";
import { Palette } from "../palette/Palette.js";
import { useEndSession } from "../state/end-session.js";
import { EndSessionDialog } from "./session/EndSessionDialog.js";
import { Loading, ThemeToggle, AppHeader, Text, Inline, Icon, Dialog, useDismiss, useOverlayStack } from "../ds/index.js";
import { useReview } from "../state/review.js";
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
  // §I rung 5 — the Flow toggle's availability + in-context target. Same queryKey
  // Flow.tsx itself reads (["zuzuu","flow"]) — react-query shares the cache, so
  // this costs no extra fetch once the Flow stage is open, and vice versa.
  const flowList = useQuery({ queryKey: ["zuzuu", "flow"], queryFn: api.zuzuu.flow });
  const workflowAddrs = new Set((flowList.data?.workflows ?? []).map((w) => w.addr));
  const qc = useQueryClient();
  const [busy, setBusy] = useState<RungId | null>(null);
  // the module stage's Table⇄Map projection lives in a per-module store so the
  // T shortcut and the palette (>table / >map) reach it from anywhere
  const viewByModule = useModuleView((s) => s.byModule);
  const setModuleView = useModuleView((s) => s.set);
  const [sessionView, setSessionView] = useState<string>("terminal"); // the session stage's Terminal·Changes tab (P2.8)
  const reviewOpen = useReview((s) => s.open);
  const setReview = useReview((s) => s.setOpen);
  // U5 (curried-plotting-coral.md) — the review overlay registers with the shared
  // stack: Escape now closes it ONLY when it's topmost, via the SAME `useDismiss`
  // mechanism Dialog/Popover already use — the direct fix for "Escape closed the
  // background review queue instead of the foreground agent view." Called
  // unconditionally (hooks can't be conditional); `enabled: reviewOpen` keeps a
  // closed review off the stack entirely (Dialog's own pattern). closeOnOutside
  // stays at its default (true) — harmless alongside the scrim button below,
  // which already closes on outside click the same way.
  const reviewPanelRef = useRef<HTMLDivElement | null>(null);
  useDismiss({ id: "review", onClose: () => setReview(false), enabled: reviewOpen, ref: reviewPanelRef });
  // the shared overlay stack (U1) — read here so the shell's OWN Escape handler
  // (below) can tell whether it's shadowed by an open overlay; see
  // shouldClearWorldSelectionOnEscape.
  const overlayStack = useOverlayStack();
  const setPalette = useWorld((s) => s.setPalette);
  const requestWorld = useWorldCommand((s) => s.request);
  const goGlobal = useAppSurface((s) => s.home);
  const settingsOpen = useSettingsDialog((s) => s.open);
  const setSettingsOpen = useSettingsDialog((s) => s.setOpen);
  const requestEnd = useEndSession((s) => s.request);

  // the footer projection switcher applies a target: World home · Everything · a module
  const applyProjection = (t: ProjTarget) => {
    if (t.scope === null) { select(null); requestWorld({ kind: "fit" }); }
    else if (t.scope === "") { setModuleView("", t.view); select({ kind: "everything" }); }
    else { setModuleView(t.scope, t.view); select({ kind: "module", id: t.scope }); }
  };
  // the Flow toggle: the in-context workflow (already focused, or the current
  // selection IS one), else Flow HOME (the picker) — >flow does the same lookup.
  const goFlow = () => {
    const t = flowTarget(selected, workflowAddrs);
    select(t ? { kind: "flow", module: t.module, id: t.id } : { kind: "flow" });
  };

  // Hoisted early (used by the greet-effect gate right below, and reused
  // lower down for the ribbon/onboarding render) — content modules (beyond
  // the safety floor), the mechanical project state, whether the full-screen
  // onboarding wall should show (bug fix: hooks-off never walls — see
  // onboardingWallShows), and whether a setup rung is still pending (the
  // SAME "Setup n/3" signal the companion pin / SetupPill show).
  const modules = overview.data?.modules ?? [];
  const contentModules = modules.filter((m) => m.id !== "instructions" && m.id !== "guardrails").length;
  const pState: ProjectStateKind | undefined = projectState.data?.state;
  const onboarding = pState !== undefined && onboardingWallShows(pState, contentModules);
  const setupIncomplete = pState !== undefined && companionView(pState, sessions.length).rung !== null;

  useEffect(() => { void refresh(); }, [refresh]); // load sessions; home is the database (no auto-open)

  // The brain-state push (/ws/zuzuu): a staged proposal, a landed row, or a schema
  // change invalidates ["zuzuu"] the moment its file lands — an agent turn visibly
  // grows the project without waiting for a refetch cycle ("watch it build").
  useEffect(() => {
    brainEvents.start(() => void qc.invalidateQueries({ queryKey: ["zuzuu"] }));
  }, [qc]);

  // §E.4 — the workbench-launch greeting: the FIRST open of the day (per project)
  // presents the omnibar's assist zero-state once. Non-blocking — Esc lands on the
  // World; typing collapses it; nothing auto-fires. localStorage marks the day.
  const greetRoot = workspace.data?.root ?? "";
  const greetReady = projectState.data !== undefined && !projectState.isLoading;
  useEffect(() => {
    // bug fix: never auto-open ON TOP of the un-started onboarding wall (it
    // used to fire regardless, colliding with the "Setup 1/3" card and
    // showing a stale "All caught up" greeting under it). `onboarding` not
    // yet resolved reads as "still walled" (skip) via `greetReady`.
    if (!greetRoot || !greetReady || onboarding) return;
    const key = `zz:greeted:${greetRoot}`;
    const today = new Date().toDateString();
    if (localStorage.getItem(key) === today) return;
    localStorage.setItem(key, today);
    setPalette(true);
  }, [greetRoot, greetReady, onboarding, setPalette]);

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
      if (e.key === "r" || e.key === "R") {
        // U5 — "r" is now the review queue's OWN reject-key for its focused card
        // (ReviewQueue's keyboard model — see review-flow.ts/ReviewQueue.tsx). A
        // ReviewQueue instance is keyboard-hot either as the overlay (already open)
        // or as the wing (sel.wing === "review", the default whenever a session is
        // selected — kept hot only while the overlay is closed, see the
        // `keyboard={!reviewOpen}` wiring on the wing's <ReviewQueue/> below). Only
        // fall through to the shell's open-toggle when NEITHER is hot, so "r" still
        // opens the overlay from the World/table home exactly as before; once a
        // queue owns "r", the shell defers to it entirely (Esc/the close button
        // still close the overlay).
        const reviewIsHot = useReview.getState().open || selectActors(useWorld.getState().selected).wing === "review";
        if (reviewIsHot) return;
        e.preventDefault();
        setReview(true);
      }
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
      else if (e.key === "Escape") {
        // U5 (curried-plotting-coral.md) — no more hardcoded review→settings
        // priority here: every overlay now owns its own Escape via `useDismiss`,
        // guarded by the shared stack's topmost check (Settings' Dialog since U3;
        // Review's own registration above, U5). This branch owns exactly the
        // NON-overlay Escape — clearing the map/world selection — and only fires
        // when the stack is empty (nothing is shadowing it); a non-empty stack
        // means some overlay is topmost and already handling this keypress itself.
        // The palette owns its own Esc (it stops propagation); the onboarding
        // dialog is non-dismissible (consent is the way through). A focused
        // terminal/input is already guarded out above, so vim's Esc is preserved.
        if (shouldClearWorldSelectionOnEscape(overlayStack.stack.length, useWorld.getState().selected !== null)) {
          e.preventDefault();
          select(null);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setReview, setPalette, select, overlayStack.stack]);

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
  const pendingByModule = Object.fromEntries(modules.map((m) => [m.id, m.counts?.pending ?? 0]));
  const sessionsLite = sessions.map((s) => ({ id: s.id, live: s.alive, lastActiveAt: s.createdAt }));
  // ribbon setup nudge (R8) — visible whenever a rung is open and the checklist
  // dialog isn't (the dialog only shows during full onboarding)
  const setupHint = pState !== undefined && pState !== "steady" && !onboarding ? RUNG_HINT[currentRung(pState)] : undefined;
  // §D — the needs-me HUD pill: the Overview's composite signal, ON the map
  const heldQ = useQuery({ queryKey: ["zuzuu", "held"], queryFn: api.zuzuu.held });
  const integrity = modules.reduce((n, m) => n + (m.counts?.errors ?? 0), 0);
  const hud = hudModel(
    Object.values(pendingByModule).reduce((n, v) => n + v, 0),
    heldQ.data?.held?.length ?? 0,
    integrity,
  );
  // the footer's always-there projection switcher (derived from the selection +
  // each scope's resolved view) — the visible twin of the T shortcut / >map/>table
  const projection = projectionSwitch(selected, (scope) => (viewOf(viewByModule, scope) === "graph" ? "graph" : "table"));

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
    : selected?.kind === "flow" ? (selected.module && selected.id ? ["Flow", selected.module, selected.id] : ["Flow"])
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
  // MODULE_TABS still resolves the CURRENT projection of a module/'' scope (drives the
  // stage render below); the Table⇄Map CONTROL itself moved to the top header. The
  // stage-header strip now carries only the SESSION Terminal·Changes tabs.
  const everythingTab = selected?.kind === "everything" ? resolveTab(MODULE_TABS, viewOf(viewByModule, "")) : undefined;
  const activeModuleTab = selected?.kind === "module" ? resolveTab(MODULE_TABS, viewOf(viewByModule, selected.id)) : undefined;
  const activeSessionTab = resolveTab(SESSION_TABS, sessionView);

  return (
    <div className="flex h-full flex-col">
      <AppHeader
        leading={
          <Inline gap="md" align="center">
            <Switcher />
            {/* the Globe — beside the project switcher, back to the global page (§F) */}
            <Text as="button" interactive tone="muted" onClick={goGlobal} aria-label="all projects" title="All projects — the globe">
              <Icon icon={Orbit} size={16} />
            </Text>
            {/* the context breadcrumb (project › stage) — moved out of the per-stage
                header strip; the one home for "where am I" */}
            {stageCrumb.length > 0 && (
              <Inline gap="xs" align="center">
                <Text size="meta" tone="subtle">›</Text>
                {stageCrumb.map((seg, i) => (
                  <Inline key={`${seg}-${i}`} gap="xs" align="center">
                    {i > 0 && <Text size="meta" tone="subtle">›</Text>}
                    <Text size="meta" tone={i === stageCrumb.length - 1 ? "default" : "muted"}>{seg}</Text>
                  </Inline>
                ))}
              </Inline>
            )}
            {/* the ONE always-visible projection toggle (was the per-stage strip) —
                now three-way: Table · Map · Flow (§I rung 5) */}
            <ProjectionToggle
              projection={projection}
              onProject={applyProjection}
              flow={{ available: workflowAddrs.size > 0, active: selected?.kind === "flow", onClick: goFlow }}
            />
          </Inline>
        }
        actions={
          <>
            {selected?.kind === "module" && (
              <Text as="button" interactive size="meta" tone="muted" onClick={() => onNewNote(selected.id)} title="New note" aria-label="new note">
                <Icon icon={Plus} size={15} />
              </Text>
            )}
            <Text as="button" interactive size="meta" tone="muted" onClick={() => setPalette(true)}>⌘K</Text>
            <ThemeToggle />
          </>
        }
      />

      <div className="flex min-h-0 flex-1">
        {/* §D: the nav tree is retired — the palette (⌘K), the map, the HUD pill,
            and the footer ARE the navigation; sessions live in the omnibar source. */}
        <main className="relative flex min-w-0 flex-1 flex-col bg-app">
          <HudPill hud={hud} onClick={() => setReview(true)} />
          {/* bug fix: the "Brain paused" full-screen wall used to be the ONLY
              way to see hooks-off (set up but not observing) — no Escape,
              click-out, or nav out. hooks-off never walls now (onboarding is
              false for it); this non-blocking, dismissible pill carries the
              SAME narration/consent/re-enable affordance instead. */}
          {pState === "hooks-off" && (
            <SetupPill
              projectName={workspace.data?.name ?? "this project"}
              step={onboardStep}
              failure={setupError}
              onAffirm={affirmRung}
              onDecline={declineRung}
              onReopen={reopenRung}
              onRetry={retrySetup}
            />
          )}
          {/* the per-stage header strip is retired (§ header consolidation): the
              breadcrumb + Table⇄Map toggle live in the TOP app header now. Only a
              SESSION keeps a stage strip — its Terminal·Changes tabs + End-session. */}
          {selected?.kind === "session" && (
            <StageHeader crumb={[]} primary={stagePrimary} tabs={SESSION_TABS} activeTab={activeSessionTab} onTab={setSessionView} />
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
            ) : sel.stage === "acp" && selected?.kind === "acp" ? (
              <AcpView id={selected.id} />
            ) : sel.stage === "flow" && selected?.kind === "flow" ? (
              <Flow module={selected.module} id={selected.id} />
            ) : projectState.isLoading || overview.isLoading ? (
              <Loading />
            ) : (
              // MAP-FIRST, single-screen (§D): the home IS the World, always — an
              // onboarding project shows its (empty) world too, with the checklist
              // riding above as a dialog. There is no other home screen.
              <World />
            )}
          </div>
        </main>

        {sel.wing !== "none" && (
          <aside className="hidden w-96 shrink-0 flex-col border-l border-border bg-surface xl:flex">
            {sel.wing === "review" ? (
              // U5 — the wing now gets the same keyboard model as the overlay, but
              // only while the overlay itself isn't open (avoids TWO keyboard-hot
              // ReviewQueue instances racing the same keystroke — see the "r"
              // collision note above and ReviewQueue.tsx's header).
              <ReviewQueue keyboard={!reviewOpen} />
            ) : sel.wing === "form" && selected?.kind === "draft" ? (
              <NewNoteForm key={selected.module} module={selected.module} seed={selected.seed} />
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

      <Ribbon sessions={sessionsLite} pendingByModule={pendingByModule} setupHint={setupHint} setupIncomplete={setupIncomplete} onReview={() => setReview(true)} onSettings={() => setSettingsOpen(true)} />

      {/* §D — onboarding is a DIALOG SEQUENCE over the dimmed World: the recorded
          consent gates (per-rung affirm/decline/reopen, resumable, failures inline
          with retry) relocate verbatim; only the container changed. Not dismissible
          — consent is the way through, exactly as the checklist page was. */}
      {onboarding && pState && (
        <div className="animate-fade fixed inset-0 z-40 flex items-center justify-center bg-scrim p-10">
          <div className="animate-pop max-h-full w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-elevated p-8 shadow-overlay">
            {companionView(pState, sessions.length).label && (
              <div className="mb-4 text-meta text-muted">{companionView(pState, sessions.length).label}</div>
            )}
            <Checklist projectName={workspace.data?.name ?? "this project"} companion step={onboardStep} failure={setupError} onAffirm={affirmRung} onDecline={declineRung} onReopen={reopenRung} onRetry={retrySetup} onStartSession={onStartSession} starting={busy === "session"} />
          </div>
        </div>
      )}

      {/* §D — Settings: a dialog from the footer's right edge; the canvas undisturbed.
          Composes ds/kit/Dialog (U3, curried-plotting-coral.md) — no separate title/
          footer slots (<Settings> renders its own heading + owns its own padding), so
          the scrim + panel markup is the only thing that changed here. This dialog's
          own useDismiss registration closes it on Escape (when topmost) / outside-
          click — the shell's own Escape handler below no longer special-cases
          settings at all (U5 reconciled the two mechanisms: the stack owns overlay-
          Escape, the shell only clears the world selection when the stack is
          empty). */}
      <Dialog
        open={settingsOpen}
        id="settings-dialog"
        onClose={() => setSettingsOpen(false)}
        className="inset-x-0 top-16 mx-auto max-h-96 w-full max-w-2xl overflow-y-auto"
      >
        <Settings />
      </Dialog>

      {reviewOpen && (
        <>
          <button type="button" aria-label="close review" onClick={() => setReview(false)} className="animate-fade fixed inset-0 z-40 bg-scrim" />
          {/* U5 — registered on the shared stack via the `useDismiss` call above
              (id "review"); ref is this panel so an eventual outside-pointerdown
              check treats the scrim (outside this node) as "outside" too. Layout
              unchanged (U3's scope note — this stays its own hand-rolled canvas,
              not a Dialog). */}
          <div ref={reviewPanelRef} className="animate-pop fixed inset-x-0 top-12 z-50 mx-auto flex max-h-96 w-96 flex-col overflow-hidden rounded-lg border border-border bg-elevated shadow-overlay">
            <ReviewQueue keyboard />
          </div>
        </>
      )}

      <Palette />
      <EndSessionDialog />
    </div>
  );
}
