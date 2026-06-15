// Pure precedence selector for the center work area (WS-C).
//
// The center renders ONE surface by strict precedence:
//   (1) editor   — any files open in the editor store
//   (2) module   — a module is selected (and no editor files)
//   (3) session  — a session is selected (and no editor files / module)
//   (4) home     — the sessions home (live terminal + history)
//
// Kept React-free so it's unit-tested directly; CenterWorkArea feeds it the
// live editor-file count and the current center selection.
import type { CenterSelection } from "./right-panel";

export type CenterView =
  | { kind: "editor" }
  | { kind: "module"; key: string }
  | { kind: "session"; id: string }
  | { kind: "home" };

export function centerView(hasOpenFiles: boolean, selection: CenterSelection): CenterView {
  if (hasOpenFiles) return { kind: "editor" };
  if (selection?.kind === "module") return { kind: "module", key: selection.key };
  if (selection?.kind === "session") return { kind: "session", id: selection.id };
  return { kind: "home" };
}
