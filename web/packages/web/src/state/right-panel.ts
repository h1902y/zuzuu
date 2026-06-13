// The right panel's mode store + the editor-store subscription that enforces
// the layout rules (one surface, two modes):
//   - opening a file (tree, search hit, ⌘K, module item — every path routes
//     through the editor store) forces mode 'files'
//   - closing the LAST editor tab forces mode 'modules'
//   - the `‹ modules` affordance flips mode WITHOUT touching editor tabs;
//     while tabs exist, module mode shows a `files ›` return chip (showFiles)
// Module mode itself is the panel root (drill null) with two slide-in
// drill-ins: a module's view (card click) or a session's detail (row
// click). Every return to module mode lands on the panel ROOT (drill
// cleared — deliberately simple).
import { create } from "zustand";
import type { ModuleKey } from "@zuzuu-web/protocol";
import { useEditor } from "./editor";

export type RightPanelMode = "files" | "modules";

/** What slides over the panel root: a module view or a session detail. */
export type PanelDrill =
  | { kind: "module"; key: ModuleKey }
  | { kind: "session"; id: string };

interface RightPanelState {
  mode: RightPanelMode;
  /** the drill-in showing over the panel root; null = the root */
  drill: PanelDrill | null;
  /** the `files ›` return chip — only meaningful while editor tabs exist */
  showFiles: () => void;
  /** the `‹ modules` affordance — editor tabs stay open; panel root */
  showModules: () => void;
  /** card click → that module's drill-in */
  openModule: (key: ModuleKey) => void;
  /** session row click → that session's detail */
  openSession: (id: string) => void;
  /** back chevron → the panel root */
  closeDrill: () => void;
}

export const useRightPanel = create<RightPanelState>((set) => ({
  mode: "modules",
  drill: null,
  showFiles: () =>
    set((s) => (useEditor.getState().openFiles.length > 0 ? { mode: "files" } : s)),
  showModules: () => set({ mode: "modules", drill: null }),
  openModule: (key) => set({ mode: "modules", drill: { kind: "module", key } }),
  openSession: (id) => set({ mode: "modules", drill: { kind: "session", id } }),
  closeDrill: () => set({ drill: null }),
}));

// One wiring point for "opening a file forces files mode": every open path
// (FileTree, search, ⌘K, terminal links, module clicks) lands in the editor
// store, so we watch it instead of patching N call sites. A re-focus of an
// already-open tab (activePath change) counts as opening too.
useEditor.subscribe((s, prev) => {
  if (s.openFiles.length === 0) {
    if (prev.openFiles.length > 0) useRightPanel.setState({ mode: "modules", drill: null });
    return;
  }
  if (s.openFiles.length > prev.openFiles.length || s.activePath !== prev.activePath) {
    useRightPanel.setState({ mode: "files" });
  }
});
