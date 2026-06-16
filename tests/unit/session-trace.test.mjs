// tests/unit/session-trace.test.mjs — sessionTraceData: ordered per-action records
// from the stored OTLP blob. Hermetic: seeded session index + constructed OTLP
// fixtures that match the format eventsToSpans/toExportRequest actually produces.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { sessionTraceData, sessionInspectData } from '../../zuzuu/commands/sessions.mjs';

// ── OTLP fixture helpers ────────────────────────────────────────────────────

/** Build one OTLP span matching the format from capture/core/spans.mjs + otlp.mjs.
 *  parentSpanId absent = SESSION root (skipped by sessionTraceData). */
function mkSpan({ traceId, spanId, parentSpanId, name, startMs, endMs, statusCode = 0, attrs = {} }) {
  const toNano = (ms) => String(Math.round(ms) * 1_000_000);
  const span = {
    traceId,
    spanId,
    name,
    kind: 1,
    startTimeUnixNano: toNano(startMs),
    endTimeUnixNano: toNano(endMs),
    attributes: Object.entries(attrs).map(([key, value]) => {
      const v = typeof value === 'number' && Number.isInteger(value)
        ? { intValue: String(value) }
        : typeof value === 'boolean'
          ? { boolValue: value }
          : { stringValue: String(value) };
      return { key, value: v };
    }),
    status: { code: statusCode },
  };
  if (parentSpanId) span.parentSpanId = parentSpanId;
  return span;
}

/** Wrap spans into one OTLP ExportTraceServiceRequest (matches toExportRequest). */
function mkExportRequest(sessionId, host, spans) {
  return {
    resourceSpans: [{
      resource: {
        attributes: [
          { key: 'service.name', value: { stringValue: 'zuzuu' } },
          { key: 'host.name', value: { stringValue: host } },
          { key: 'session.id', value: { stringValue: sessionId } },
        ],
      },
      scopeSpans: [{ scope: { name: 'zuzuu/trace-capture', version: '0.1.0' }, spans }],
    }],
  };
}

/** Write one OTLP export request as NDJSON and return the path. */
function writeOtlpBlob(dir, filename, ...requests) {
  const file = join(dir, filename);
  writeFileSync(file, requests.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return file;
}

// ── Shared fixture builder ──────────────────────────────────────────────────

const T0 = 1_700_000_000_000; // baseline epoch ms for fixture spans
const TRACE_ID = 'a'.repeat(32);

function withSeededRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zuzuu-strace-'));
  const home = join(cwd, '.zuzuu');
  mkdirSync(join(home, '.traces'), { recursive: true });

  // Build spans: SESSION root → TURN → TOOL(ok) → TOOL(err)
  const sessionSpan = mkSpan({ traceId: TRACE_ID, spanId: '0000000000000001', name: 'session abc (claude-code)', startMs: T0, endMs: T0 + 5000, attrs: { 'host.name': 'claude-code' } });
  const turnSpan = mkSpan({ traceId: TRACE_ID, spanId: '0000000000000002', parentSpanId: '0000000000000001', name: 'turn: write a hello world', startMs: T0 + 100, endMs: T0 + 3000, attrs: { 'turn.prompt.bytes': 20 } });
  const toolOkSpan = mkSpan({ traceId: TRACE_ID, spanId: '0000000000000003', parentSpanId: '0000000000000002', name: 'Bash', startMs: T0 + 500, endMs: T0 + 1000, statusCode: 1, attrs: { 'gen_ai.operation.name': 'execute_tool', 'gen_ai.tool.name': 'Bash', 'host.tool.name': 'Bash', 'tool.input.bytes': 50, 'tool.result.bytes': 100 } });
  const toolErrSpan = mkSpan({ traceId: TRACE_ID, spanId: '0000000000000004', parentSpanId: '0000000000000002', name: 'Write', startMs: T0 + 1500, endMs: T0 + 2000, statusCode: 2, attrs: { 'gen_ai.operation.name': 'execute_tool', 'gen_ai.tool.name': 'Write', 'host.tool.name': 'Write', 'tool.input.bytes': 30, 'tool.result.bytes': 0 } });

  const req = mkExportRequest('sess-trace', 'claude-code', [sessionSpan, turnSpan, toolOkSpan, toolErrSpan]);
  writeOtlpBlob(join(home, '.traces'), 'claude-code-sess-trace.otlp.jsonl', req);

  const RECORDS = [
    {
      id: 'sess-trace', host: 'claude-code', status: 'completed',
      startedAt: '2026-06-15T10:00:00.000Z', endedAt: '2026-06-15T10:05:00.000Z', durationMs: 5000,
      traceId: TRACE_ID, traceRef: '.zuzuu/.traces/claude-code-sess-trace.otlp.jsonl',
      git: { commit: null, branch: 'main' }, counts: { turns: 1, tools: 2, errors: 1 }, generation: null,
    },
    {
      id: 'sess-gone', host: 'claude-code', status: 'abandoned',
      startedAt: '2026-06-15T09:00:00.000Z', endedAt: '2026-06-15T09:01:00.000Z', durationMs: 60000,
      traceId: 'b'.repeat(32), traceRef: '.zuzuu/.traces/claude-code-sess-gone.otlp.jsonl',
      git: { commit: null, branch: null }, counts: { turns: 0, tools: 0, errors: 0 }, generation: null,
    },
  ];
  writeFileSync(join(home, 'sessions.json'), JSON.stringify({ version: 1, sessions: RECORDS }, null, 2));

  try { return fn(cwd); } finally { rmSync(cwd, { recursive: true, force: true }); }
}

// ── Tests ───────────────────────────────────────────────────────────────────

test('sessionTraceData: ordered actions with correct kinds + timestamps', () => {
  withSeededRepo((cwd) => {
    const d = sessionTraceData(cwd, 'sess-trace');
    assert.ok(d, 'returns a result');
    assert.equal(d.sessionId, 'sess-trace');
    // 3 actions: turn + 2 tools (SESSION root is skipped)
    assert.equal(d.actions.length, 3, 'SESSION root is skipped; 3 actions');

    const [turn, toolOk, toolErr] = d.actions;

    // kinds
    assert.equal(turn.kind, 'turn');
    assert.equal(toolOk.kind, 'tool');
    assert.equal(toolErr.kind, 'tool');

    // labels
    assert.equal(turn.label, 'write a hello world');
    assert.equal(toolOk.label, 'Bash');
    assert.equal(toolErr.label, 'Write');

    // statuses
    assert.equal(turn.status, undefined, 'turn has UNSET status → no status field');
    assert.equal(toolOk.status, 'ok');
    assert.equal(toolErr.status, 'error');

    // timestamps are ISO strings in ascending order (sorted by startTimeUnixNano)
    for (const a of d.actions) {
      assert.match(a.ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'ts is ISO');
    }
    assert.ok(turn.ts <= toolOk.ts, 'turn before first tool');
    assert.ok(toolOk.ts <= toolErr.ts, 'tools in start-time order');
  });
});

test('sessionTraceData: missing/gone blob → empty actions, never throws', () => {
  withSeededRepo((cwd) => {
    const d = sessionTraceData(cwd, 'sess-gone');
    assert.ok(d, 'found the session record');
    assert.equal(d.sessionId, 'sess-gone');
    assert.deepEqual(d.actions, [], 'empty when blob is absent');
  });
});

test('sessionTraceData: unknown id → null', () => {
  withSeededRepo((cwd) => {
    assert.equal(sessionTraceData(cwd, 'nope'), null);
    assert.equal(sessionTraceData(cwd, undefined), null);
  });
});

test('sessionTraceData: unique id prefix resolves', () => {
  withSeededRepo((cwd) => {
    const d = sessionTraceData(cwd, 'sess-tr');
    assert.ok(d);
    assert.equal(d.sessionId, 'sess-trace');
    assert.equal(d.actions.length, 3);
  });
});

test('counts-only sessionInspectData still works unchanged (back-compat)', () => {
  // Ensure our additions did not break the existing sessionInspectData path.
  withSeededRepo((cwd) => {
    const d = sessionInspectData(cwd, 'sess-trace', { transcripts: [] });
    assert.ok(d, 'inspect found the session');
    assert.equal(d.trace.spans, 4, '4 spans in the blob');
    assert.equal(d.trace.tools, 2, 'tools from the session record');
    assert.deepEqual(d.signals, {}, 'no transcripts → no signals');
    assert.ok(d.warnings.some((w) => w.includes('transcript unavailable')));
  });
});

test('sessionTraceData: multiple export requests per blob → all spans, sorted', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'zuzuu-strace-multi-'));
  const home = join(cwd, '.zuzuu');
  mkdirSync(join(home, '.traces'), { recursive: true });

  // Two separate export requests (two NDJSON lines)
  const req1 = mkExportRequest('sess-multi', 'claude-code', [
    mkSpan({ traceId: TRACE_ID, spanId: '0000000000000001', name: 'session', startMs: T0, endMs: T0 + 9000 }),
    mkSpan({ traceId: TRACE_ID, spanId: '0000000000000002', parentSpanId: '0000000000000001', name: 'turn: second', startMs: T0 + 200, endMs: T0 + 400 }),
  ]);
  const req2 = mkExportRequest('sess-multi', 'claude-code', [
    mkSpan({ traceId: TRACE_ID, spanId: '0000000000000003', parentSpanId: '0000000000000001', name: 'turn: first', startMs: T0 + 100, endMs: T0 + 150 }),
  ]);
  writeOtlpBlob(join(home, '.traces'), 'claude-code-sess-multi.otlp.jsonl', req1, req2);

  writeFileSync(join(home, 'sessions.json'), JSON.stringify({
    version: 1,
    sessions: [{
      id: 'sess-multi', host: 'claude-code', status: 'completed',
      traceRef: '.zuzuu/.traces/claude-code-sess-multi.otlp.jsonl',
      counts: { turns: 2, tools: 0, errors: 0 },
    }],
  }, null, 2));

  try {
    const d = sessionTraceData(cwd, 'sess-multi');
    assert.equal(d.actions.length, 2, 'root skipped; 2 turns across 2 requests');
    assert.equal(d.actions[0].label, 'first', 'earliest start-time comes first');
    assert.equal(d.actions[1].label, 'second');
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
