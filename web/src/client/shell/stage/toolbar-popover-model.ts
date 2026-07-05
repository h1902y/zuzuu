// shell/stage/toolbar-popover-model.ts — the pure coordinator behind U4's
// toolbar-popover mutual exclusion (curried-plotting-coral.md). Grid.tsx's
// Filter/Group/Sort builders (TableBuilders.tsx, self-exclusive within itself
// already) and its SEPARATE "+ column" FieldConfigPanel are siblings in the same
// toolbar row — without a coordinator both could be open at once. The fix is one
// lifted `ToolbarPopoverKey | null` slot (held by Grid.tsx / Everything.tsx,
// passed down as a controlled prop) instead of each popover owning its own
// boolean; this file is the one pure transition on that slot, kept separate from
// JSX so the coordinator is unit-testable without mounting anything.
export type ToolbarPopoverKey = "filter" | "group" | "sort" | "column";

/** Toggling the popover that's ALREADY open closes it (back to `null` — same
 *  as TableBuilders.tsx's own pre-U4 per-panel toggle); toggling a DIFFERENT one
 *  switches to it, implicitly replacing whatever was open — never two at once. */
export function toggleToolbarPopover(current: ToolbarPopoverKey | null, key: ToolbarPopoverKey): ToolbarPopoverKey | null {
  return current === key ? null : key;
}
