// app/use-surface-history.ts — tie the browser Back / Forward buttons to the
// home↔project surface, project-accurate. Mount ONCE (in App).
//
// A user-driven surface change (open a project / go home) pushes a {screen, path}
// history entry. On a popstate (Back/Forward) we read the popped entry and reconcile:
// a different project → re-ENTER it (the full daemon re-root + refetch via
// useEnterProject); the Projects Home → go home. The `fromPop` guard stops a
// popstate-driven store change from pushing a fresh entry (which would break Forward).
//
// Lives in app/ (not state/) because the re-entry reaches the shell-layer
// useEnterProject — state/ must not import shell/.
import { useEffect, useRef } from "react";
import { useAppSurface, surfaceFromHistoryState, type Surface } from "../state/app-surface.js";
import { useEnterProject } from "../shell/session/use-enter-project.js";

export function useSurfaceHistory(): void {
  const screen = useAppSurface((s) => s.screen);
  const path = useAppSurface((s) => s.path);
  const home = useAppSurface((s) => s.home);
  const enter = useEnterProject();

  // the popstate listener binds once; keep the latest callbacks reachable via refs.
  const fromPop = useRef(false);
  const enterRef = useRef(enter); enterRef.current = enter;
  const homeRef = useRef(home); homeRef.current = home;

  useEffect(() => {
    // seed the initial entry so the first Back has a state to return to
    const seed: Surface = { screen: useAppSurface.getState().screen, path: useAppSurface.getState().path };
    window.history.replaceState(seed, "");

    const onPop = (e: PopStateEvent) => {
      const target = surfaceFromHistoryState(e.state);
      const cur = useAppSurface.getState();
      if (target.screen === "project" && target.path) {
        if (target.path !== cur.path) { fromPop.current = true; void enterRef.current(target.path); }
        else if (cur.screen !== "project") { fromPop.current = true; useAppSurface.setState({ screen: "project" }); }
      } else if (cur.screen !== "projects") {
        fromPop.current = true; homeRef.current();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // a surface change pushes a new history entry — UNLESS it came from a popstate
  // (Back/Forward already moved the history cursor), and never a duplicate.
  useEffect(() => {
    if (fromPop.current) { fromPop.current = false; return; }
    const cur = window.history.state as Surface | null;
    if (cur && cur.screen === screen && (cur.path ?? null) === (path ?? null)) return;
    window.history.pushState({ screen, path } satisfies Surface, "");
  }, [screen, path]);
}
