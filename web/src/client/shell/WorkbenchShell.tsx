// shell/WorkbenchShell.tsx — the Stage + Wings frame (R1): nav · stage · wing + the
// footer ribbon, no modes. The selection (world-state) drives which stage + wing actor
// mounts (shell-state.selectActors). The terminal stage re-houses the proven TermView +
// Composer unchanged; grid/record/wing are placeholders until U5–U8 fill them. The
// frame uses static layout utilities (no inline styles / arbitrary values); content
// composes from ds primitives.
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ModuleOverviewEntry, ProjectStateKind } from "#shared/index.js";
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
import { Grid } from "./stage/Grid.js";
import { Stack, Text } from "../ds/index.js";
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

function Overview({ modules, onPick }: { modules: ModuleOverviewEntry[]; onPick: (id: string) => void }) {
  return (
    <div className="h-full overflow-y-auto p-6">
      <Stack gap="md">
        <Text size="body" tone="subtle" weight="semibold">The database</Text>
        <div className="grid grid-cols-3 gap-3">
          {modules.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick(m.id)}
              className="flex flex-col gap-1 rounded-ui border border-border bg-elevated p-3 text-left transition-colors hover:border-accent-dim"
            >
              <Text weight="medium">▦ {m.title}</Text>
              <Text size="meta" tone="muted">
                {m.counts?.items ?? 0} rows{m.counts?.pending ? ` · ◷ ${m.counts.pending}` : ""}
              </Text>
            </button>
          ))}
          {!modules.length && <Text size="ui" tone="muted">no modules yet — run `zz init`</Text>}
        </div>
      </Stack>
    </div>
  );
}

export function WorkbenchShell() {
  const sessions = useWorkbench((s) => s.sessions);
  const refresh = useWorkbench((s) => s.refresh);
  const selected = useWorld((s) => s.selected);
  const select = useWorld((s) => s.select);
  const startSession = useStartSession();
  const overview = useQuery({ queryKey: ["zuzuu", "overview"], queryFn: api.zuzuu.overview });
  const projectState = useQuery({ queryKey: ["zuzuu", "project-state"], queryFn: api.zuzuu.projectState });
  const qc = useQueryClient();
  const [busy, setBusy] = useState<RungId | null>(null);

  useEffect(() => { void refresh(); }, [refresh]); // load sessions; home is the database (no auto-open)

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

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
        <Text as="button" size="meta" tone="subtle" onClick={() => select(null)}>{sel.crumb.length ? sel.crumb.join(" › ") : "the database"}</Text>
      </div>

      <div className="flex min-h-0 flex-1">
        <NavTree />

        <main className="flex min-w-0 flex-1 flex-col bg-app">
          {sel.stage === "terminal" && sessionNode ? (
            <>
              <div className="min-h-0 flex-1"><TermView key={sessionNode.id} sessionId={sessionNode.id} /></div>
              {activeSession?.type === "agent" && <Composer key={sessionNode.id} sessionId={sessionNode.id} />}
            </>
          ) : sel.stage === "grid" && selected?.kind === "module" ? (
            <Grid module={selected.id} />
          ) : sel.stage === "record" ? (
            <Placeholder label="record (U6)" />
          ) : onboarding && pState ? (
            <Checklist state={pState} onRung={onRung} busy={busy} />
          ) : (
            <Overview modules={modules} onPick={(id) => select({ kind: "module", id })} />
          )}
        </main>

        {sel.wing !== "none" && (
          <aside className="hidden w-80 shrink-0 flex-col border-l border-border bg-surface xl:flex">
            <Placeholder label={sel.wing === "review" ? "review queue (U7)" : sel.wing === "form" ? "form (U6)" : "schema + generations"} />
          </aside>
        )}
      </div>

      <Ribbon sessions={sessionsLite} pendingByModule={pendingByModule} setupHint={setupHint} />
    </div>
  );
}
