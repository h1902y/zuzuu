// Global "the daemon stopped accepting us" flag.
//
// A 401 means the browser's auth cookie no longer matches the daemon's token
// (cookie cleared, or a daemon restarted with a different token). It's a
// terminal state for this tab — every subsequent request 401s too — so we flip
// one flag and show the ReconnectScreen over the whole app rather than letting
// each surface fail independently. Recovery is out-of-band (`zz web` reopens an
// authenticated tab), so there's no "clear" action here: a reload re-evaluates
// from a clean slate.
import { create } from "zustand";
import { ApiError } from "../lib/api";

interface AuthLossState {
  lost: boolean;
}

export const useAuthLoss = create<AuthLossState>(() => ({ lost: false }));

/** Mark this tab's session as lost (idempotent). */
export function markAuthLost(): void {
  if (!useAuthLoss.getState().lost) useAuthLoss.setState({ lost: true });
}

/** True when an error is (or wraps) an HTTP 401 from the daemon. */
export function isAuthLoss(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}
