// shell/switcher-model.ts — the pure model behind the switcher popover (R9–R12).
// Recents → picker rows (current first), the in-place switch descriptor (D1 — no
// running/idle branch, no daemon-URL/token: switching reuses POST /api/workspace/
// switch), and the "Open a folder…" autocomplete reducer. Keyboard nav is pure so
// the .tsx (U11) only dispatches.

import type { RecentProject } from "#shared/index.js";

export interface PickerRow {
  path: string;
  name: string;
  current: boolean;
}

/** Popover rows: the current Project first, then the rest in recency order. */
export function pickerRows(recents: RecentProject[]): PickerRow[] {
  const current = recents.filter((r) => r.current);
  const rest = recents.filter((r) => !r.current);
  return [...current, ...rest];
}

export interface SwitchAction {
  kind: "switch";
  path: string;
}

/** The in-place switch descriptor for a row (the .tsx disables the current row). */
export function switchAction(row: PickerRow): SwitchAction {
  return { kind: "switch", path: row.path };
}

// ── "Open a folder…" autocomplete ─────────────────────────────────────────────

export interface OpenFolderState {
  prefix: string;
  dirs: string[];
  highlighted: number;
}

export const initialOpenFolder: OpenFolderState = { prefix: "", dirs: [], highlighted: 0 };

export type OpenFolderEvent =
  | { type: "setPrefix"; prefix: string }
  | { type: "setDirs"; dirs: string[] }
  | { type: "moveHighlight"; delta: number }
  | { type: "applyHighlighted" };

/** Reducer for the path field: typing resets the highlight, ↑/↓ wrap, ⏎ applies the
 *  highlighted dir to the prefix (a no-op when there are no suggestions). */
export function openFolderReducer(s: OpenFolderState, e: OpenFolderEvent): OpenFolderState {
  switch (e.type) {
    case "setPrefix":
      return { ...s, prefix: e.prefix, highlighted: 0 };
    case "setDirs":
      return { ...s, dirs: e.dirs, highlighted: 0 };
    case "moveHighlight": {
      if (!s.dirs.length) return s;
      const n = s.dirs.length;
      return { ...s, highlighted: (((s.highlighted + e.delta) % n) + n) % n };
    }
    case "applyHighlighted": {
      if (!s.dirs.length) return s;
      const dir = s.dirs[s.highlighted]!;
      const base = s.prefix.endsWith("/") ? s.prefix : s.prefix.slice(0, s.prefix.lastIndexOf("/") + 1);
      return { ...s, prefix: base + dir + "/", dirs: [], highlighted: 0 };
    }
  }
}
