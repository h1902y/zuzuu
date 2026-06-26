// shell/review/use-session-close.ts — the close-card detector (U5/R5/KTD5).
//
// Mounted once (in App, beside the Toaster). It drains the reported-exit queue: for
// each ended AGENT session it polls the session detail (which awaits the close hook
// and carries the post-close `pending` count — the daemon ran `zz observe` after the
// merge so staging is deterministic), then fires the card AT MOST ONCE per session
// when pending > 0. Dedup lives in sessionStorage (session-close-card.ts) so a
// dismiss-without-review never re-fires for that session id.
import { useEffect } from "react";
import type { StagedSummary, SessionCloseResult } from "#shared/index.js";
import { api } from "../../lib/api.js";
import { useSessionClose } from "../../state/session-close.js";
import { closeCardFired, markCloseCardFired, shouldFireCloseCard } from "./session-close-card.js";

/** Fire the "what this session taught" card from a close result we already hold —
 *  the explicit-end path (the nav ✕ → DELETE awaits the merge and returns it), so it
 *  doesn't need the detector's poll. Same dedup as the natural-exit path, so a session
 *  ended this way won't double-fire if its TermView also reports the exit. No-ops for
 *  a shell / a merge with nothing staged. Best-effort: a failed staged read → no card. */
export async function showCloseCardFromResult(sessionId: string, result: SessionCloseResult | null): Promise<void> {
  const pending = pendingOf(result ?? undefined);
  if (pending === null || !shouldFireCloseCard(sessionId, pending, closeCardFired(sessionId))) return;
  markCloseCardFired(sessionId); // before show → a TermView remount won't double-fire
  const staged = await loadStaged().catch(() => [] as StagedSummary[]);
  useSessionClose.getState().show({ sessionId, pending, staged });
}

/** The post-close pending count, or null when the close result doesn't carry one
 *  (CLI absent / merge failed → no meaningful count → no card). */
function pendingOf(result: SessionCloseResult | undefined): number | null {
  if (result && "ok" in result && result.ok && typeof result.pending === "number") return result.pending;
  return null;
}

/** Load every pending module's staged proposals (for the card's count + patterns).
 *  Best-effort: a failed module read degrades to fewer cards, never throws. */
async function loadStaged(): Promise<StagedSummary[]> {
  const ov = await api.zuzuu.overview();
  const pending = ov.modules.filter((m) => (m.counts?.pending ?? 0) > 0);
  const details = await Promise.all(
    pending.map((m) => api.zuzuu.module(m.id).catch(() => null)),
  );
  return details.flatMap((d) => d?.staged ?? []);
}

export function useSessionCloseDetector(): void {
  const reported = useSessionClose((s) => s.reported);
  const consume = useSessionClose((s) => s.consume);
  const show = useSessionClose((s) => s.show);

  useEffect(() => {
    if (!reported.length) return;
    let cancelled = false;
    for (const sessionId of reported) {
      if (closeCardFired(sessionId)) { consume(sessionId); continue; }
      void (async () => {
        try {
          // sessionDetail awaits whenClosed() on the daemon → closeResult is settled.
          const detail = await api.sessionDetail(sessionId);
          if (cancelled) return;
          const pending = pendingOf(detail.closeResult);
          if (pending !== null && shouldFireCloseCard(sessionId, pending, closeCardFired(sessionId))) {
            markCloseCardFired(sessionId); // before show → a remount won't double-fire
            const staged = await loadStaged().catch(() => [] as StagedSummary[]);
            if (!cancelled) show({ sessionId, pending, staged });
          }
        } catch {
          /* poll failed — leave it unconsumed only if not cancelled; drop to avoid a spin */
        } finally {
          if (!cancelled) consume(sessionId);
        }
      })();
    }
    return () => { cancelled = true; };
  }, [reported, consume, show]);
}
