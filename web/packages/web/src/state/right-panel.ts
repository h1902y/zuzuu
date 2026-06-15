// Center work-area selection store (WS-C).
//
// The layout is now: sidebar (files) | CENTER (work area) | RIGHT (modules list).
// The right column is ALWAYS the modules master list — there is no more
// files-vs-modules mode toggle. The center work area renders by precedence:
//   (1) editor open (useEditor has open files) → the EditorPane
//   (2) else a module is selected → that module's detail (ModuleView)
//   (3) else a session is selected → that session's detail (SessionDetail)
//   (4) else → the sessions home (live terminal + session history)
//
// This store owns the center selection (a module OR a session — they replace
// each other). Editor precedence is read live from useEditor by CenterWorkArea;
// opening a file no longer mutates this store. Opening a file while a module is
// selected keeps the selection (it resurfaces when the last tab closes), so we
// clear nothing on file open — the editor simply wins by precedence.
import { create } from "zustand";
import type { ModuleKey } from "@zuzuu-web/protocol";

/** What the center work area shows when no editor file is open. */
export type CenterSelection =
  | { kind: "module"; key: ModuleKey }
  | { kind: "session"; id: string }
  | null;

interface RightPanelState {
  /** the center selection: a module detail, a session detail, or none (home) */
  selection: CenterSelection;
  /** convenience read: the selected module key (null when not a module) */
  selectedModule: ModuleKey | null;
  /** convenience read: the selected session id (null when not a session) */
  selectedSession: string | null;
  /** open a module's detail in the center (module list row click) */
  openModule: (key: ModuleKey) => void;
  /** clear a module selection → back to the sessions home */
  closeModule: () => void;
  /** open a session's detail in the center (session-history row click) */
  openSession: (id: string) => void;
  /** clear a session selection → back to the sessions home */
  closeSession: () => void;
  /** clear whatever is selected → the sessions home */
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
  selectedSession: null,
  openModule: (key) =>
    set({ selection: { kind: "module", key }, selectedModule: key, selectedSession: null }),
  closeModule: () => set({ selection: null, selectedModule: null, selectedSession: null }),
  openSession: (id) =>
    set({ selection: { kind: "session", id }, selectedSession: id, selectedModule: null }),
  closeSession: () => set({ selection: null, selectedModule: null, selectedSession: null }),
  closeCenter: () => set({ selection: null, selectedModule: null, selectedSession: null }),

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
