// src/client/app/App.tsx — the workbench entry. The shell is "Stage + Wings": one
// fixed three-region frame (nav · stage · wing) + a footer ribbon, no modes
// (docs/brainstorms/2026-06-25-workbench-shell-requirements.md). The frame lives in
// shell/WorkbenchShell; this is just the mount point.
import { WorkbenchShell } from "../shell/WorkbenchShell.js";

export function App() {
  return <WorkbenchShell />;
}
