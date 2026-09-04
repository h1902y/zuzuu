// ds/kit/overlay/overlay-stack-context.tsx — the thin React binding over the pure
// overlay-stack.ts core (U1, curried-plotting-coral.md). ONE provider, mounted at
// the app root (src/client/main.tsx), holds the shared LIFO stack; every overlay
// in the tree (Dialog, Popover, the review wing, the switcher, …) registers with
// it via useDismiss (use-dismiss.ts) instead of owning a private boolean.
import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import { EMPTY_OVERLAY_STACK, overlayStackReducer, type OverlayId, type OverlayStack } from "./overlay-stack.js";

export interface OverlayStackContextValue {
  /** The current stack, oldest first — read this to ask `isTopmost`. */
  stack: OverlayStack;
  /** Register an overlay as open (idempotent — see pushOverlay). */
  register: (id: OverlayId) => void;
  /** Unregister an overlay, wherever it sits in the stack (see popOverlay). */
  unregister: (id: OverlayId) => void;
}

const Ctx = createContext<OverlayStackContextValue | null>(null);

export function OverlayStackProvider({ children }: { children: ReactNode }) {
  const [stack, dispatch] = useReducer(overlayStackReducer, EMPTY_OVERLAY_STACK);
  // stable identities (dispatch never changes) — a consumer's registration effect
  // can depend on these without re-subscribing every time the STACK CONTENTS
  // change (i.e. whenever any OTHER overlay opens/closes). If these closures were
  // remade per-render instead, an overlay's own register/unregister effect would
  // re-run on every sibling's open/close and (unregister-then-register) bump it
  // to the front of the stack out of turn.
  const register = useCallback((id: OverlayId) => dispatch({ type: "push", id }), []);
  const unregister = useCallback((id: OverlayId) => dispatch({ type: "pop", id }), []);
  const value = useMemo<OverlayStackContextValue>(() => ({ stack, register, unregister }), [stack, register, unregister]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The stack + register/unregister — used by useDismiss, and available directly
 *  for a coordinator that needs to know what's open (e.g. U4's sibling-popover
 *  mutual-exclusion in Grid.tsx/Everything.tsx). Throws outside the provider —
 *  the same "must be inside" contract as data/ListContext.tsx's useList, so a
 *  missing provider mount is a loud error, not a silently-inert overlay. */
export function useOverlayStack(): OverlayStackContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOverlayStack (and useDismiss) must be used inside <OverlayStackProvider>");
  return v;
}
