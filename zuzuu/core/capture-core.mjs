// Shared capture: transcript -> OTLP trace blob + git-native session record.
// Used by `zuzuu capture` (post-hoc, status `captured`) and the live lifecycle
// (`hook`/`reconcile`, statuses active/completed/abandoned). One proven path —
// Design B: the hook never builds spans, it re-runs THIS.

import { eventsToSpans } from '../capture/core/spans.mjs';
import { toExportRequest } from '../capture/core/otlp.mjs';
import { EventKind, Status } from '../capture/core/event.mjs';
import { makeSession, SessionState } from './session.mjs';
import { writeTrace, upsertSession, gitInfo } from './store.mjs';

export function countsOf(trace) {
  return {
    turns: trace.events.filter((e) => e.kind === EventKind.TURN).length,
    tools: trace.events.filter((e) => e.kind === EventKind.TOOL_CALL).length,
    errors: trace.events.filter((e) => e.kind === EventKind.TOOL_CALL && e.status === Status.ERROR).length,
  };
}

/**
 * Parse a transcript via `adapter`, write the OTLP blob, upsert the index record.
 * Idempotent (deterministic ids) — safe to re-run on every lifecycle signal.
 * @param {string|null} [generation]  active generation id — threads from the OPEN
 *   hook so every session carries its Run linkage (WS3-T3). Null-safe.
 * @param {string|null} [ptyId]  daemon PTY id (U4/KTD2 join key) when the host
 *   ran under the workbench — threaded from the OPEN hook via ZUZUU_PTY_ID. Null-safe.
 * @returns {{trace, traceId, spans, traceRef, record, counts}}
 */
export function captureTrace({ adapter, ref, status = SessionState.CAPTURED, cwd = process.cwd(), generation = null, ptyId = null }) {
  const trace = adapter.parse(ref);
  const { traceId, spans } = eventsToSpans(trace);
  const request = toExportRequest({ traceId, spans }, { host: trace.host, sessionId: trace.sessionId });
  const traceRef = writeTrace(trace.host, trace.sessionId, [request], cwd);

  const root = trace.events.find((e) => e.kind === EventKind.SESSION) || trace.events[0];
  const counts = countsOf(trace);
  const record = makeSession({
    id: trace.sessionId,
    host: trace.host,
    status,
    startedAt: new Date(root.startMs).toISOString(),
    endedAt: new Date(root.endMs).toISOString(),
    traceId,
    traceRef,
    git: gitInfo(cwd),
    counts,
    generation,
    ptyId,
  });
  upsertSession(record, cwd);
  return { trace, traceId, spans, traceRef, record, counts };
}
