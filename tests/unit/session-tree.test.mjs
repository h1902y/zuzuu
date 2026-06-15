// tests/unit/session-tree.test.mjs — sessionTreeData: nested SESSION→TURN→TOOL tree
// from the stored OTLP blob. Hermetic: seeded session index + constructed OTLP
// fixtures that match the format eventsToSpans/toExportRequest actually produces.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { sessionTreeData, sessionTraceData } from '../../zuzuu/commands/sessions.mjs';

// ── OTLP fixture helpers ────────────────────────────────────────────────────
// (Mirrors the pattern in session-trace.test.mjs — reuse the format exactly.)

/** Build one OTLP span matching the format from capture/core/spans.mjs + otlp.mjs.
 *  parentSpanId absent = SESSION root. */
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

/** Write one or more OTLP export requests as NDJSON and return the path. */
function writeOtlpBlob(dir, filename, ...requests) {
  const file = join(dir, filename);
  writeFileSync(file, requests.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return file;
}

const T0 = 1_700_000_000_000; // baseline epoch ms
const TRACE_ID = 'a'.repeat(32);

// ── Full fixture: SESSION → TURN → (TOOL_ok, TOOL_err) ─────────────────────

function withFullRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zuzuu-stree-'));
  const home = join(cwd, '.zuzuu');
  mkdirSync(join(home, '.traces'), { recursive: true });

  const sessionSpan = mkSpan({
    traceId: TRACE_ID, spanId: '0000000000000001',
    name: 'session tree-test (claude-code)', startMs: T0, endMs: T0 + 5000,
    attrs: { 'host.name': 'claude-code' },
  });
  const turnSpan = mkSpan({
    traceId: TRACE_ID, spanId: '0000000000000002', parentSpanId: '0000000000000001',
    name: 'turn: write a hello world', startMs: T0 + 100, endMs: T0 + 3000,
    attrs: { 'turn.prompt.bytes': 20 },
  });
  const toolOkSpan = mkSpan({
    traceId: TRACE_ID, spanId: '0000000000000003', parentSpanId: '0000000000000002',
    name: 'Bash', startMs: T0 + 500, endMs: T0 + 1000, statusCode: 1,
    attrs: { 'gen_ai.operation.name': 'execute_tool', 'gen_ai.tool.name': 'Bash' },
  });
  const toolErrSpan = mkSpan({
    traceId: TRACE_ID, spanId: '0000000000000004', parentSpanId: '0000000000000002',
    name: 'Write', startMs: T0 + 1500, endMs: T0 + 2000, statusCode: 2,
    attrs: { 'gen_ai.operation.name': 'execute_tool', 'gen_ai.tool.name': 'Write' },
  });

  const req = mkExportRequest('sess-tree', 'claude-code', [sessionSpan, turnSpan, toolOkSpan, toolErrSpan]);
  writeOtlpBlob(join(home, '.traces'), 'claude-code-sess-tree.otlp.jsonl', req);

  const RECORDS = [
    {
      id: 'sess-tree', host: 'claude-code', status: 'completed',
      startedAt: '2026-06-15T10:00:00.000Z', endedAt: '2026-06-15T10:05:00.000Z', durationMs: 5000,
      traceId: TRACE_ID, traceRef: '.zuzuu/.traces/claude-code-sess-tree.otlp.jsonl',
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

// ── Gemini-thin fixture: SESSION → (TURN1, TURN2), no tool children ─────────

function withGeminiRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zuzuu-stree-gemini-'));
  const home = join(cwd, '.zuzuu');
  mkdirSync(join(home, '.traces'), { recursive: true });

  const sessionSpan = mkSpan({
    traceId: TRACE_ID, spanId: '0000000000000010',
    name: 'session gemini-thin (gemini)', startMs: T0, endMs: T0 + 4000,
    attrs: { 'host.name': 'gemini' },
  });
  const turn1Span = mkSpan({
    traceId: TRACE_ID, spanId: '0000000000000011', parentSpanId: '0000000000000010',
    name: 'turn: first prompt', startMs: T0 + 100, endMs: T0 + 2000,
  });
  const turn2Span = mkSpan({
    traceId: TRACE_ID, spanId: '0000000000000012', parentSpanId: '0000000000000010',
    name: 'turn: second prompt', startMs: T0 + 2100, endMs: T0 + 3500,
  });

  const req = mkExportRequest('sess-gemini', 'gemini', [sessionSpan, turn1Span, turn2Span]);
  writeOtlpBlob(join(home, '.traces'), 'gemini-sess-gemini.otlp.jsonl', req);

  writeFileSync(join(home, 'sessions.json'), JSON.stringify({
    version: 1,
    sessions: [{
      id: 'sess-gemini', host: 'gemini', status: 'completed',
      startedAt: '2026-06-15T11:00:00.000Z', endedAt: '2026-06-15T11:04:00.000Z', durationMs: 4000,
      traceId: TRACE_ID, traceRef: '.zuzuu/.traces/gemini-sess-gemini.otlp.jsonl',
      git: { commit: null, branch: 'main' }, counts: { turns: 2, tools: 0, errors: 0 }, generation: null,
    }],
  }, null, 2));

  try { return fn(cwd); } finally { rmSync(cwd, { recursive: true, force: true }); }
}

// ── Tests ───────────────────────────────────────────────────────────────────

test('sessionTreeData: session→turn→(tool,tool) nested tree, parents preserved', () => {
  withFullRepo((cwd) => {
    const d = sessionTreeData(cwd, 'sess-tree');
    assert.ok(d, 'returns a result');
    assert.equal(d.sessionId, 'sess-tree');

    const root = d.root;
    assert.ok(root, 'root node present');
    assert.equal(root.kind, 'session');
    assert.equal(root.children.length, 1, 'one turn child');

    const turn = root.children[0];
    assert.equal(turn.kind, 'turn');
    assert.equal(turn.label, 'write a hello world');
    assert.equal(turn.status, undefined, 'turn UNSET status → no status field');
    assert.equal(turn.children.length, 2, 'two tool children under the turn');

    const [toolOk, toolErr] = turn.children;
    assert.equal(toolOk.kind, 'tool');
    assert.equal(toolOk.label, 'Bash');
    assert.equal(toolOk.status, 'ok');
    assert.equal(toolOk.children.length, 0, 'tool has no children');

    assert.equal(toolErr.kind, 'tool');
    assert.equal(toolErr.label, 'Write');
    assert.equal(toolErr.status, 'error');
    assert.equal(toolErr.children.length, 0);
  });
});

test('sessionTreeData: tool children are time-ordered', () => {
  withFullRepo((cwd) => {
    const d = sessionTreeData(cwd, 'sess-tree');
    const tools = d.root.children[0].children;
    assert.ok(tools[0].ts <= tools[1].ts, 'Bash (T0+500ms) before Write (T0+1500ms)');
  });
});

test('sessionTreeData: timestamps are ISO strings', () => {
  withFullRepo((cwd) => {
    const d = sessionTreeData(cwd, 'sess-tree');
    function checkNode(node) {
      assert.match(node.ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, `ts is ISO: ${node.ts}`);
      for (const child of node.children) checkNode(child);
    }
    checkNode(d.root);
  });
});

test('sessionTreeData: output nodes have no spanId/parentSpanId (stripped)', () => {
  withFullRepo((cwd) => {
    const d = sessionTreeData(cwd, 'sess-tree');
    function checkNode(node) {
      assert.equal(node.spanId, undefined, 'spanId stripped from output');
      assert.equal(node.parentSpanId, undefined, 'parentSpanId stripped from output');
      for (const child of node.children) checkNode(child);
    }
    checkNode(d.root);
  });
});

test('sessionTreeData: Gemini-thin → session→turns with empty children arrays', () => {
  withGeminiRepo((cwd) => {
    const d = sessionTreeData(cwd, 'sess-gemini');
    assert.ok(d, 'returns a result');
    assert.equal(d.sessionId, 'sess-gemini');

    const root = d.root;
    assert.ok(root, 'root present');
    assert.equal(root.kind, 'session');
    assert.equal(root.children.length, 2, 'two turn children');

    for (const turn of root.children) {
      assert.equal(turn.kind, 'turn');
      assert.deepEqual(turn.children, [], 'turn has no tool children (Gemini-thin)');
    }

    // Turns are time-ordered
    assert.ok(root.children[0].ts <= root.children[1].ts, 'first prompt before second prompt');
  });
});

test('sessionTreeData: missing/gone blob → { sessionId, root: null }, never throws', () => {
  withFullRepo((cwd) => {
    const d = sessionTreeData(cwd, 'sess-gone');
    assert.ok(d, 'found the session record');
    assert.equal(d.sessionId, 'sess-gone');
    assert.equal(d.root, null, 'root is null when blob is absent');
  });
});

test('sessionTreeData: unknown id → null', () => {
  withFullRepo((cwd) => {
    assert.equal(sessionTreeData(cwd, 'nope'), null);
    assert.equal(sessionTreeData(cwd, undefined), null);
  });
});

test('sessionTreeData: unique id prefix resolves', () => {
  withFullRepo((cwd) => {
    const d = sessionTreeData(cwd, 'sess-tr');
    assert.ok(d);
    assert.equal(d.sessionId, 'sess-tree');
    assert.ok(d.root);
    assert.equal(d.root.kind, 'session');
  });
});

test('flat sessionTraceData (U6 back-compat) still works unchanged', () => {
  // The flat sessionTraceData must continue to work after adding sessionTreeData.
  withFullRepo((cwd) => {
    const d = sessionTraceData(cwd, 'sess-tree');
    assert.ok(d, 'returns a result');
    assert.equal(d.sessionId, 'sess-tree');
    // 3 actions: SESSION root skipped; turn + 2 tools
    assert.equal(d.actions.length, 3);
    assert.equal(d.actions[0].kind, 'turn');
    assert.equal(d.actions[1].kind, 'tool');
    assert.equal(d.actions[2].kind, 'tool');
  });
});
