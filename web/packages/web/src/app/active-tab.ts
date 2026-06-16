// Resolve the center's active tab id (a PTY id OR a trace session id) to the
// session row the body + composer render. Pure/DOM-free so the id-space
// reconciliation is unit-tested.
//
// The async-join problem: useSessions.create() returns a PTY id immediately and
// a tab opens keyed on it, but the trace row (ZuzuuSessionEntry with
// ptyId === thatId) only appears on the next ~6s poll. So a just-started tab has
// no PickerRow yet — we synthesize a minimal LIVE row from the SessionTab so the
// body renders its booting terminal at once (no empty flash) until the trace
// catches up.
import type { ZuzuuSessionEntry } from "@zuzuu-web/protocol";
import { agentTabTitle } from "../modules/host-launch";
import type { PickerRow } from "./session-picker";

/** The slice of a live PTY tab this resolver needs (a useSessions.SessionTab). */
export interface ResolveTab {
  id: string;
  host?: string;
  alive: boolean;
}

/** The CANONICAL open-tab id for a session: its PTY id when it has one (so the
 *  start path — which opens the PTY id before any trace row exists — and a later
 *  picker click on the same session resolve to ONE tab), else its trace id. */
export function tabIdFor(session: { id: string; ptyId?: string }): string {
  return session.ptyId ?? session.id;
}

export interface ActiveTab {
  /** the row to render (real trace row, or a synthesized live one), or null */
  row: PickerRow | null;
  /** the live PTY tab id driving the Terminal sub-tab, or null (view-only) */
  ptyTabId: string | null;
}

/**
 * Resolve `activeId` against the picker rows, then the live PTY tabs.
 *  - match a trace row by `session.id` or by `session.ptyId` → real row;
 *  - else if a live PTY tab matches the id → synthesize a live "opening" row
 *    (the just-started case, before the trace row exists);
 *  - else null (nothing to view).
 */
export function resolveActiveTab(
  activeId: string | null,
  rows: PickerRow[],
  tabs: ResolveTab[],
): ActiveTab {
  if (!activeId) return { row: null, ptyTabId: null };

  const row = rows.find((r) => r.session.id === activeId || r.session.ptyId === activeId) ?? null;
  if (row) {
    const ptyTabId = row.live ? (row.session.ptyId ?? activeId) : null;
    return { row, ptyTabId };
  }

  // No trace row yet — a freshly started session keyed on its PTY id.
  const tab = tabs.find((t) => t.id === activeId);
  if (tab && tab.alive) {
    const session: ZuzuuSessionEntry = {
      id: activeId,
      host: tab.host,
      state: "opening",
      ptyId: tab.id,
    };
    return { row: { session, live: true, band: "now" }, ptyTabId: tab.id };
  }

  return { row: null, ptyTabId: null };
}

/** One open tab, resolved for the strip. `live` → a pulsing dot; `outside` →
 *  the "· outside" note (running in the user's terminal, no workbench PTY). */
export interface OpenTabItem {
  id: string;
  label: string;
  live: boolean;
  outside: boolean;
}

const LIVE_STATES = new Set(["active", "opening"]);

/** Resolve each open tab id to its strip descriptor (host label + live/outside),
 *  reusing the same row/pty resolution as the body. Unresolvable ids (a session
 *  that briefly has neither a row nor a live tab) degrade to a plain label. */
export function openTabItems(openIds: string[], rows: PickerRow[], tabs: ResolveTab[]): OpenTabItem[] {
  return openIds.map((id) => {
    const { row } = resolveActiveTab(id, rows, tabs);
    const state = String(row?.session.state ?? "");
    return {
      id,
      label: agentTabTitle(row?.session.host),
      live: row?.live ?? false,
      outside: !(row?.live ?? false) && LIVE_STATES.has(state),
    };
  });
}
