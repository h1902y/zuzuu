// src/client/app/App.tsx — the workbench entry. Two top-level surfaces, chosen by
// useAppSurface (the no-workspace landing is the GLOBAL page — the same World+greeting
// grammar as a project, where the nodes ARE projects, §F; opening one flips to the
// in-project shell). The in-project shell is "Stage + Wings": one fixed frame + a
// footer ribbon, no modes. The frame lives in shell/WorkbenchShell; the global page in
// shell/projects/GlobalHome (retiring the ProjectsHome list launcher — kept on disk
// until the globe has full parity, but no longer routed to).
import { WorkbenchShell } from "../shell/WorkbenchShell.js";
import { GlobalHome } from "../shell/projects/GlobalHome.js";
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
      {screen === "projects" ? <GlobalHome /> : <WorkbenchShell />}
      <Toaster />
      <SessionCloseCard />
    </>
  );
}
