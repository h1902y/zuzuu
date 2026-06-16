// Center work-area selection store (WS-C).
//
// The layout is now: sidebar (files) | CENTER (work area) | RIGHT (modules list).
// The right column is ALWAYS the modules master list — there is no more
// files-vs-modules mode toggle. The center work area renders by precedence:
//   (1) editor open (useEditor has open files) → the EditorPane
//   (2) else a module is selected → that module's detail (ModuleView)
//   (3) else → the single-focus session home (slim picker + SessionTree |
//             Terminal tabs + composer + inline recovery banner)
//
// This store owns the center selection (a module — editor wins by precedence).
// There is NO separate session-detail route (T4): a past session is VIEWED in
// the home surface (the slim picker selects which session the center renders as
// a tree) — it is not a competing center page. So the only center selection is
// a module.
import { create } from "zustand";
import type { ModuleKey } from "@zuzuu-web/protocol";

/** What the center work area shows when no editor file is open. */
export type CenterSelection =
  | { kind: "module"; key: ModuleKey }
  | null;

interface RightPanelState {
  /** the center selection: a module detail, or none (the session home) */
  selection: CenterSelection;
  /** convenience read: the selected module key (null when not a module) */
  selectedModule: ModuleKey | null;
  /** open a module's detail in the center (module list row click) */
  openModule: (key: ModuleKey) => void;
  /** clear a module selection → back to the session home */
  closeModule: () => void;
  /** clear whatever is selected → the session home */
  closeCenter: () => void;

  /** Module ids with an enabled-toggle mutation in flight. Shared across BOTH
   *  toggle surfaces (the master-list row Switch + the ModuleView hero Switch)
   *  so a toggle on one disables the other — serializing the two against the
   *  SAME module + the SAME overview cache (no racing optimistic restores). */
  togglingIds: Set<string>;
  /** Mark a module's toggle as in-flight. */
  beginToggle: (id: string) => void;
  /** Clear a module's in-flight mark. */
  endToggle: (id: string) => void;
  /** Is this module's toggle currently in flight? */
  isToggling: (id: string) => boolean;
}

export const useRightPanel = create<RightPanelState>((set, get) => ({
  selection: null,
  selectedModule: null,
  openModule: (key) => set({ selection: { kind: "module", key }, selectedModule: key }),
  closeModule: () => set({ selection: null, selectedModule: null }),
  closeCenter: () => set({ selection: null, selectedModule: null }),

  togglingIds: new Set<string>(),
  beginToggle: (id) =>
    set((s) => {
      if (s.togglingIds.has(id)) return s;
      const next = new Set(s.togglingIds);
      next.add(id);
      return { togglingIds: next };
    }),
  endToggle: (id) =>
    set((s) => {
      if (!s.togglingIds.has(id)) return s;
      const next = new Set(s.togglingIds);
      next.delete(id);
      return { togglingIds: next };
    }),
  isToggling: (id) => get().togglingIds.has(id),
}));
