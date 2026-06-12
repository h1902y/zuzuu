// The right panel's mode store + the editor-store subscription that enforces
// the layout rules (one surface, two modes):
//   - opening a file (tree, search hit, ⌘K, faculty item — every path routes
//     through the editor store) forces mode 'files'
//   - closing the LAST editor tab forces mode 'faculties'
//   - the `‹ faculties` affordance flips mode WITHOUT touching editor tabs;
//     while tabs exist, faculty mode shows a `files ›` return chip (showFiles)
import { create } from "zustand";
import type { FacultyKey } from "@zuzuu-web/protocol";
import { useEditor } from "./editor";

export type RightPanelMode = "files" | "faculties";
export type PanelTab = "pulse" | FacultyKey;

interface RightPanelState {
  mode: RightPanelMode;
  /** which faculty-mode tab is showing (sticky across mode flips) */
  facultyTab: PanelTab;
  /** the `files ›` return chip — only meaningful while editor tabs exist */
  showFiles: () => void;
  /** the `‹ faculties` affordance — editor tabs stay open */
  showFaculties: () => void;
  setFacultyTab: (tab: PanelTab) => void;
}

export const useRightPanel = create<RightPanelState>((set) => ({
  mode: "faculties",
  facultyTab: "pulse",
  showFiles: () =>
    set((s) => (useEditor.getState().openFiles.length > 0 ? { mode: "files" } : s)),
  showFaculties: () => set({ mode: "faculties" }),
  setFacultyTab: (facultyTab) => set({ mode: "faculties", facultyTab }),
}));

// One wiring point for "opening a file forces files mode": every open path
// (FileTree, search, ⌘K, terminal links, faculty clicks) lands in the editor
// store, so we watch it instead of patching N call sites. A re-focus of an
// already-open tab (activePath change) counts as opening too.
useEditor.subscribe((s, prev) => {
  if (s.openFiles.length === 0) {
    if (prev.openFiles.length > 0) useRightPanel.setState({ mode: "faculties" });
    return;
  }
  if (s.openFiles.length > prev.openFiles.length || s.activePath !== prev.activePath) {
    useRightPanel.setState({ mode: "files" });
  }
});
