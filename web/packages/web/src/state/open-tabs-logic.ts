// Pure, DOM-free logic for the center's session TAB STRIP (editor model).
//
// "Open tabs" is VIEW state — which sessions are open in the center and which is
// focused — kept deliberately separate from useSessions.tabs (the live PTY
// LIFECYCLE state). Closing a tab is a pure view op here; it never ends a
// session or unmounts a PTY. That separation is what protects the flow-controlled
// PTY hot path: the always-mounted TermViews iterate useSessions.tabs, never
// these openIds.
//
// A tab id is EITHER a daemon PTY id OR a trace session id. A freshly started
// session opens keyed on its PTY id (create() returns it immediately, before any
// trace row exists); resolution reconciles the two id spaces (see active-tab.ts).
//
// React/store-free so open/focus/close/reconcile are unit-tested as data.

export interface OpenTabsCore {
  /** ordered left→right; each is a PTY id or a trace session id */
  openIds: string[];
  activeId: string | null;
}

/** Open a tab (dedupe) and focus it. Already-open ids are NOT duplicated — they
 *  just take focus. New ids append to the end. */
export function openTab(state: OpenTabsCore, id: string): OpenTabsCore {
  const openIds = state.openIds.includes(id) ? state.openIds : [...state.openIds, id];
  return { openIds, activeId: id };
}

/** Focus an already-open tab. A no-op if the id isn't open (guards against
 *  focusing something never opened). */
export function focusTab(state: OpenTabsCore, id: string): OpenTabsCore {
  if (!state.openIds.includes(id)) return state;
  if (state.activeId === id) return state;
  return { ...state, activeId: id };
}

/** The tab to focus after closing `closingId`: the right neighbor, else the left,
 *  else null (closed the only tab). */
export function neighborAfterClose(openIds: string[], closingId: string): string | null {
  const i = openIds.indexOf(closingId);
  if (i === -1) return null;
  return openIds[i + 1] ?? openIds[i - 1] ?? null;
}

/** Close a tab (remove from the strip — does NOT end the session). If it was the
 *  active tab, focus a neighbor. Closing an absent id is a no-op. */
export function closeTab(state: OpenTabsCore, id: string): OpenTabsCore {
  if (!state.openIds.includes(id)) return state;
  const openIds = state.openIds.filter((x) => x !== id);
  const activeId = state.activeId === id ? neighborAfterClose(state.openIds, id) : state.activeId;
  return { openIds, activeId };
}

/** Drop open tabs whose session has vanished entirely (not in `knownIds` — the
 *  union of live PTY tab ids and trace session ids). If the active tab is
 *  dropped, focus a survivor (preferring the prior neighbor order). */
export function reconcileTabs(state: OpenTabsCore, knownIds: Set<string>): OpenTabsCore {
  const openIds = state.openIds.filter((id) => knownIds.has(id));
  if (openIds.length === state.openIds.length) return state; // unchanged
  let activeId = state.activeId;
  if (activeId !== null && !knownIds.has(activeId)) {
    // find the nearest surviving tab from the active tab's original position
    const from = state.openIds.indexOf(activeId);
    activeId =
      state.openIds.slice(from + 1).find((id) => knownIds.has(id)) ??
      [...state.openIds.slice(0, from)].reverse().find((id) => knownIds.has(id)) ??
      null;
  }
  return { openIds, activeId };
}
