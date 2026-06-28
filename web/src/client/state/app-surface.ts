// state/app-surface.ts — the TOP-LEVEL surface: the Projects Home (manage all) vs.
// inside a project (the Stage+Wings shell). Launch lands on "projects" (the decided
// launch landing); opening a project switches to "project" and records its path. This
// sits ABOVE the in-project useWorld selection — they don't fight (useWorld only
// drives the shell).
//
// The path is what makes browser Back/Forward project-accurate: app/use-surface-history
// pushes {screen, path} per user-driven change and, on a popstate, re-enters that exact
// project. surfaceFromHistoryState is the pure mapping (tested); the window/history
// wiring lives in the app-layer hook (which may reach the project-switch logic).
import { create } from "zustand";

export type AppScreen = "projects" | "project";

export interface Surface {
  screen: AppScreen;
  /** the active project's path while screen === "project"; null on the Projects Home. */
  path: string | null;
}

interface AppSurfaceState extends Surface {
  /** enter a project (records its path). The daemon re-root + refetch is the caller's job. */
  open: (path: string) => void;
  /** return to the Projects Home. */
  home: () => void;
}

export const useAppSurface = create<AppSurfaceState>((set) => ({
  screen: "projects",
  path: null,
  open: (path) => set({ screen: "project", path }),
  home: () => set({ screen: "projects", path: null }),
}));

/** Map a popped `history.state` → the surface it encodes. Defensive: only an explicit
 *  project entry WITH a string path reads as "project"; everything else is the Projects
 *  Home. Pure (tested) — the browser wiring calls it. */
export function surfaceFromHistoryState(state: unknown): Surface {
  const s = state as { screen?: unknown; path?: unknown } | null;
  if (s && s.screen === "project" && typeof s.path === "string" && s.path) {
    return { screen: "project", path: s.path };
  }
  return { screen: "projects", path: null };
}
