// shell/review/session-liveness.ts — the natural-exit detector (U1, plan
// 2026-06-29-001). PURE edge-detection over the session list: which AGENT sessions
// transitioned live → ended (PTY died — `alive:false` — or dropped from the list).
//
// Why: the close-card's other trigger, TermView.onExit, is bound to a MOUNTED terminal
// pane, so a natural PTY exit while the user is on Home/Brain (pane unmounted) is missed.
// The liveness watch (use-session-close) polls the session list while a live agent exists
// and feeds these edges to the same dedup'd `reported` queue — pane-independent. The
// edge is reported ONCE (the id leaves the live set after), and the queue + the
// closeCardFired mark dedup against TermView.onExit firing the same exit. Additive: reads
// the existing session list, never the flow-controlled PTY hot path.
import type { SessionInfo } from "#shared/index.js";

/** The ids of agent sessions whose PTY is currently alive. */
export function liveAgentIds(sessions: SessionInfo[]): Set<string> {
  return new Set(sessions.filter((s) => s.type === "agent" && s.alive).map((s) => s.id));
}

/**
 * Agent sessions that were live (in `prevLive`) and are now ended — either still in the
 * list with `alive:false` (natural PTY exit) or gone from the list (explicit close). Pure;
 * edge-triggered, so a still-dead session is reported only on the transition, never again.
 */
export function endedAgentSessions(prevLive: Set<string>, current: SessionInfo[]): string[] {
  const stillLive = liveAgentIds(current);
  return [...prevLive].filter((id) => !stillLive.has(id));
}
