// src/client/app/App.tsx — the workbench entry. Two top-level surfaces, chosen by
// useAppSurface (the launch landing is the Projects Home; opening a project flips to
// the in-project shell). The in-project shell is "Stage + Wings": one fixed three-
// region frame (nav · stage · wing) + a footer ribbon, no modes
// (docs/brainstorms/2026-06-25-workbench-shell-requirements.md). The frame lives in
// shell/WorkbenchShell; the launcher in shell/projects/ProjectsHome.
import { WorkbenchShell } from "../shell/WorkbenchShell.js";
import { ProjectsHome } from "../shell/projects/ProjectsHome.js";
import { useAppSurface } from "../state/app-surface.js";
import { useSurfaceHistory } from "./use-surface-history.js";
import { Toaster } from "../ds/index.js";
import { SessionCloseCard } from "../shell/review/SessionCloseCard.js";
import { useSessionCloseDetector, useSessionLivenessWatch } from "../shell/review/use-session-close.js";

export function App() {
  const screen = useAppSurface((s) => s.screen);
  useSurfaceHistory(); // tie browser Back/Forward to the home↔project surface
  useSessionLivenessWatch();  // U1: a natural PTY exit (pane unmounted) still surfaces
  useSessionCloseDetector();  // U5: an agent session-end surfaces the close card
  return (
    <>
      {screen === "projects" ? <ProjectsHome /> : <WorkbenchShell />}
      <Toaster />
      <SessionCloseCard />
    </>
  );
}
