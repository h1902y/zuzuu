// W1-D: pure builder for the cmd-K command palette's "Sessions" group.
//
// The center's tab strip (useOpenTabs + openTabItems) is the live model; this
// turns its display items into palette commands so cmd-K can switch between or
// close open session tabs (the browser reserves cmd-1..9 / cmd-W / cmd-T, so the
// palette is the reliable surface). React/DOM-free so it's unit-tested.

/** A tab as the palette sees it: an id and a display label. */
export interface SessionTabItem {
  id: string;
  label: string;
}

/** One palette command for a session action. */
export interface SessionPaletteItem {
  /** stable cmdk key, also drives the `value` for filtering */
  id: string;
  /** the command's display title */
  title: string;
  /** what selecting it does */
  action: "focus" | "close";
  /** the session id the action targets (the active id for `close`) */
  sessionId: string;
}

/**
 * Build the "Sessions" palette commands:
 *  - a "Switch to: <label>" focus command per open tab;
 *  - a "Close current tab" close command when there IS an active tab (i.e. the
 *    active id matches an open tab — a stale active id with no tabs yields none).
 */
export function sessionPaletteItems(
  items: SessionTabItem[],
  activeId: string | null,
): SessionPaletteItem[] {
  const out: SessionPaletteItem[] = items.map((t) => ({
    id: `session-focus-${t.id}`,
    title: `Switch to: ${t.label}`,
    action: "focus",
    sessionId: t.id,
  }));

  if (activeId && items.some((t) => t.id === activeId)) {
    out.push({
      id: "session-close-current",
      title: "Close current tab",
      action: "close",
      sessionId: activeId,
    });
  }

  return out;
}
