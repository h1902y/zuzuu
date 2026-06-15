// Pure precedence selector for the center work area (WS-C).
//
// The center renders ONE surface by strict precedence:
//   (1) editor   — any files open in the editor store
//   (2) module   — a module is selected (and no editor files)
//   (3) home     — the single-focus session home (slim picker + SessionTree |
//                  Terminal tabs + composer + inline recovery banner)
//
// There is NO separate `session` view (T4): a past session is viewed INSIDE the
// home surface (the picker selects which session the center renders as a tree),
// not as a competing detail page. Editor/module precedence is unchanged.
//
// Kept React-free so it's unit-tested directly; CenterWorkArea feeds it the
// live editor-file count and the current center selection.
import type { CenterSelection } from "./right-panel";

export type CenterView =
  | { kind: "editor" }
  | { kind: "module"; key: string }
  | { kind: "home" };

export function centerView(hasOpenFiles: boolean, selection: CenterSelection): CenterView {
  if (hasOpenFiles) return { kind: "editor" };
  if (selection?.kind === "module") return { kind: "module", key: selection.key };
  return { kind: "home" };
}
