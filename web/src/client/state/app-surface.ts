// state/app-surface.ts — the TOP-LEVEL surface: the Projects Home (manage all) vs.
// inside a project (the Stage+Wings shell). Launch lands on "projects" (the decided
// launch landing); opening a project switches to "project". This sits ABOVE the
// in-project useWorld selection — they don't fight (useWorld only drives the shell).
import { create } from "zustand";

export type AppScreen = "projects" | "project";

interface AppSurfaceState {
  screen: AppScreen;
  setScreen: (screen: AppScreen) => void;
}

export const useAppSurface = create<AppSurfaceState>((set) => ({
  screen: "projects",
  setScreen: (screen) => set({ screen }),
}));
