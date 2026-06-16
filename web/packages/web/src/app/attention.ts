// W1-C: attention routing. Long agent sessions finish or crash while you've
// tabbed away — detect the transition between two poll snapshots so the UI can
// notify + surface the session. Pure → unit-tested; the notify/toast side
// effects live in the hook that consumes this.
//
// We only emit on a transition FROM a live state (active/opening) → terminal.
// "Awaiting input" is deliberately NOT detected: a PTY exposes no machine-
// readable turn boundary, so we'd be guessing (see the daemon/CLI notes).

export type AttentionKind = "finished" | "crashed";

export interface AttentionSnapshot {
  id: string;
  state: string;
  label: string;
}

export interface AttentionEvent {
  sessionId: string;
  kind: AttentionKind;
  label: string;
}

const LIVE = new Set(["active", "opening"]);
const FINISHED = new Set(["completed", "captured"]);
const CRASHED = new Set(["crashed", "abandoned"]);

/** Sessions that transitioned from live → terminal between two snapshots. */
export function detectAttention(prev: AttentionSnapshot[], next: AttentionSnapshot[]): AttentionEvent[] {
  const prevById = new Map(prev.map((s) => [s.id, s]));
  const events: AttentionEvent[] = [];
  for (const s of next) {
    const before = prevById.get(s.id);
    if (!before || !LIVE.has(before.state)) continue; // only transitions FROM live
    if (FINISHED.has(s.state)) events.push({ sessionId: s.id, kind: "finished", label: s.label });
    else if (CRASHED.has(s.state)) events.push({ sessionId: s.id, kind: "crashed", label: s.label });
  }
  return events;
}
