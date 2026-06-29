// shell/review/use-session-close.ts — the close-card detector (U5/R5/KTD5).
//
// Mounted once (in App, beside the Toaster). It drains the reported-exit queue: for
// each ended AGENT session it polls the session detail (which awaits the close hook
// and carries the post-close `pending` count — the daemon ran `zz observe` after the
// merge so staging is deterministic), then fires the card AT MOST ONCE per session
// when pending > 0. Dedup lives in sessionStorage (session-close-card.ts) so a
// dismiss-without-review never re-fires for that session id.
import { useEffect, useRef } from "react";
import type { StagedSummary, SessionCloseResult } from "#shared/index.js";
import { api } from "../../lib/api.js";
import { useSessionClose, reportAgentExit } from "../../state/session-close.js";
import { useWorkbench } from "../../state/store.js";
import { endedAgentSessions, liveAgentIds } from "./session-liveness.js";
import {
  closeCardFired,
  markCloseCardFired,
  shouldFireCloseCard,
  heldChangesOf,
  codeFromHeld,
  pickHeld,
  type CloseCardCode,
} from "./session-close-card.js";

/** Fire the "what this session taught" card from a close result we already hold —
 *  the explicit-end path (the nav ✕ → DELETE awaits the close hook and returns it), so
 *  it doesn't need the detector's poll. Same dedup as the natural-exit path, so a
 *  session ended this way won't double-fire if its TermView also reports the exit.
 *  Fires on held CODE changes OR staged brain proposals (U6) — a code-only session
 *  cards too. Best-effort: a failed read → degrades, never throws. */
export async function showCloseCardFromResult(sessionId: string, result: SessionCloseResult | null): Promise<void> {
  await fireCloseCard(sessionId, result ?? undefined);
}

/** The shared fire path (both the explicit-end and the natural-exit poll converge
 *  here): resolve the held CODE review + the brain pending count, then fire ONCE when
 *  there's something to review. */
async function fireCloseCard(sessionId: string, result: SessionCloseResult | undefined): Promise<void> {
  if (closeCardFired(sessionId)) return;
  const pending = pendingOf(result) ?? 0;
  const code = await loadCode(sessionId, heldBranchOf(result));
  if (!shouldFireCloseCard(sessionId, pending, heldChangesOf(code), closeCardFired(sessionId))) return;
  markCloseCardFired(sessionId); // before show → a remount won't double-fire
  const staged = pending > 0 ? await loadStaged().catch(() => [] as StagedSummary[]) : [];
  useSessionClose.getState().show({ sessionId, pending, staged, code });
}

/** The post-close pending count, or null when the close result doesn't carry one
 *  (CLI absent / close failed → no meaningful count). */
function pendingOf(result: SessionCloseResult | undefined): number | null {
  if (result && "ok" in result && result.ok && typeof result.pending === "number") return result.pending;
  return null;
}

/** The held branch from a held-variant close result (the session that just ended);
 *  undefined for a merged / failed / shell result (no held code to review). */
function heldBranchOf(result: SessionCloseResult | undefined): string | undefined {
  if (result && "held" in result && result.held && typeof result.branch === "string") return result.branch;
  return undefined;
}

/** Resolve the ended session's CODE review: fetch the workspace's held sessions and
 *  pick this one (by its held branch, else its id). Null when nothing is held for it
 *  (it auto-merged, or was a shell) or the read failed. */
async function loadCode(sessionId: string, branch: string | undefined): Promise<CloseCardCode | null> {
  if (!branch) return null;
  try {
    const { held } = await api.zuzuu.held();
    const entry = pickHeld(held, branch, sessionId);
    return entry ? codeFromHeld(entry) : null;
  } catch {
    return null;
  }
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

/** How often to poll the session list while a live agent session exists (U1). Only runs
 *  when there's a live agent — idle projects never poll. */
const LIVENESS_POLL_MS = 4000;

/**
 * The pane-independent natural-exit watch (U1). Mounted once beside the detector. While a
 * live agent session exists, polls the session list so a PTY that exits with its terminal
 * pane unmounted/backgrounded still surfaces; reports each live→ended agent edge to the
 * same `reported` queue (deduped there + by closeCardFired, so it never double-fires with
 * TermView.onExit). Reads the session list only — never the flow-controlled PTY path.
 */
export function useSessionLivenessWatch(): void {
  const sessions = useWorkbench((s) => s.sessions);
  const refresh = useWorkbench((s) => s.refresh);
  const prevLive = useRef<Set<string>>(new Set());

  // report the live→ended edge for agent sessions, then advance the tracked live set
  useEffect(() => {
    for (const id of endedAgentSessions(prevLive.current, sessions)) reportAgentExit(id);
    prevLive.current = liveAgentIds(sessions);
  }, [sessions]);

  // keep the list fresh while a live agent exists, so a natural exit becomes visible
  const hasLiveAgent = sessions.some((s) => s.type === "agent" && s.alive);
  useEffect(() => {
    if (!hasLiveAgent) return;
    const t = setInterval(() => { void refresh(); }, LIVENESS_POLL_MS);
    return () => clearInterval(t);
  }, [hasLiveAgent, refresh]);
}

export function useSessionCloseDetector(): void {
  const reported = useSessionClose((s) => s.reported);
  const consume = useSessionClose((s) => s.consume);

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
          await fireCloseCard(sessionId, detail.closeResult);
        } catch {
          /* poll failed — leave it unconsumed only if not cancelled; drop to avoid a spin */
        } finally {
          if (!cancelled) consume(sessionId);
        }
      })();
    }
    return () => { cancelled = true; };
  }, [reported, consume]);
}
