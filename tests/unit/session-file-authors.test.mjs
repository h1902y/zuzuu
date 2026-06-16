// tests/unit/session-file-authors.test.mjs — W2b: trace-linked diff. The pure
// matcher fileAuthorsFromNodes(nodes, paths) maps each changed file path to the
// LAST tool node whose toolInput mentions it: { <path>: { turn, ts } }.
//
// Hermetic: the nodes are the same DISPLAY-content shape sessionContentData
// emits (kind agent_text|user_text|tool, with toolInput/label/ts) — no host
// transcript involved. sessionFileAuthorsData is covered with a seeded index +
// injected transcripts (the same harness session-content uses), but the heart
// is the pure matcher.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fileAuthorsFromNodes, sessionFileAuthorsData } from '../../zuzuu/commands/sessions.mjs';

// ── fileAuthorsFromNodes: pure matcher ──────────────────────────────────────

const NODES = [
  { kind: 'user_text', label: '', ts: '2026-06-15T10:00:00.000Z', text: 'edit src/a.js' },
  { kind: 'tool', label: 'Write', ts: '2026-06-15T10:00:01.000Z',
    toolInput: '{"file_path":"src/a.js","content":"first"}' },
  { kind: 'agent_text', label: '', ts: '2026-06-15T10:00:02.000Z', text: 'done a, now b' },
  { kind: 'tool', label: 'Edit', ts: '2026-06-15T10:00:03.000Z',
    toolInput: '{"file_path":"src/b.js"}' },
  // a SECOND write to src/a.js — this is the LAST one and must win
  { kind: 'tool', label: 'Bash', ts: '2026-06-15T10:00:04.000Z',
    toolInput: 'echo hi >> src/a.js' },
];

test('maps each changed path to the LAST tool node whose toolInput mentions it', () => {
  const out = fileAuthorsFromNodes(NODES, ['src/a.js', 'src/b.js']);
  assert.deepEqual(out['src/a.js'], { turn: 'Bash', ts: '2026-06-15T10:00:04.000Z' });
  assert.deepEqual(out['src/b.js'], { turn: 'Edit', ts: '2026-06-15T10:00:03.000Z' });
});

test('a path no tool mentions is absent from the result (best-effort)', () => {
  const out = fileAuthorsFromNodes(NODES, ['src/a.js', 'src/never.js']);
  assert.ok('src/a.js' in out);
  assert.ok(!('src/never.js' in out), 'unmentioned path omitted');
});

test('only tool nodes count — agent/user text mentioning a path is ignored', () => {
  const nodes = [
    { kind: 'user_text', label: '', ts: '2026-06-15T10:00:00.000Z', text: 'please touch only.txt' },
    { kind: 'agent_text', label: '', ts: '2026-06-15T10:00:01.000Z', text: 'I will write only.txt' },
  ];
  const out = fileAuthorsFromNodes(nodes, ['only.txt']);
  assert.deepEqual(out, {});
});

test('matches a basename when the full path is not in the toolInput', () => {
  const nodes = [
    { kind: 'tool', label: 'Write', ts: '2026-06-15T10:00:01.000Z',
      toolInput: '{"file_path":"a.js"}' },
  ];
  // changed path is a repo-relative path; the tool only logged the basename
  const out = fileAuthorsFromNodes(nodes, ['src/deep/a.js']);
  assert.deepEqual(out['src/deep/a.js'], { turn: 'Write', ts: '2026-06-15T10:00:01.000Z' });
});

test('fail-soft on bad input: empty/missing args → {}', () => {
  assert.deepEqual(fileAuthorsFromNodes(undefined, ['x']), {});
  assert.deepEqual(fileAuthorsFromNodes([], ['x']), {});
  assert.deepEqual(fileAuthorsFromNodes(NODES, undefined), {});
  assert.deepEqual(fileAuthorsFromNodes(NODES, []), {});
  assert.deepEqual(fileAuthorsFromNodes(null, null), {});
});

test('a tool node without toolInput is skipped, never throws', () => {
  const nodes = [
    { kind: 'tool', label: 'Bash', ts: '2026-06-15T10:00:01.000Z' },
    { kind: 'tool', label: 'Write', ts: '2026-06-15T10:00:02.000Z', toolInput: 'x/y.js' },
  ];
  const out = fileAuthorsFromNodes(nodes, ['x/y.js']);
  assert.deepEqual(out['x/y.js'], { turn: 'Write', ts: '2026-06-15T10:00:02.000Z' });
});

// ── sessionFileAuthorsData: loads diff paths + content nodes, applies matcher ─

function jsonl(rows) {
  return rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
}

// A Claude transcript whose tool writes to a file path.
const CLAUDE = jsonl([
  { type: 'assistant', sessionId: 'cc-1', timestamp: '2026-06-15T10:00:01.000Z',
    message: { role: 'assistant', content: [
      { type: 'text', text: 'writing the file' },
      { type: 'tool_use', id: 'toolu_1', name: 'Write', input: { file_path: 'note.txt', content: 'hi' } },
    ] } },
  { type: 'user', sessionId: 'cc-1', timestamp: '2026-06-15T10:00:02.000Z',
    message: { role: 'user', content: [
      { type: 'tool_result', tool_use_id: 'toolu_1', is_error: false, content: 'ok' },
    ] } },
]);

function withRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zuzuu-authors-'));
  const home = join(cwd, '.zuzuu');
  mkdirSync(home, { recursive: true });
  const ref = join(cwd, 'cc.jsonl');
  writeFileSync(ref, CLAUDE);
  writeFileSync(join(home, 'sessions.json'), JSON.stringify({
    version: 1,
    sessions: [{ id: 'cc-1', host: 'claude-code', status: 'captured', traceRef: null,
      git: { commit: null, branch: null }, counts: { turns: 1, tools: 1, errors: 0 } }],
  }, null, 2));
  try {
    return fn({ cwd, id: 'cc-1', transcripts: [{ host: 'claude-code', ref, sessionId: 'cc-1' }] });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test('sessionFileAuthorsData: unknown id → null', () => {
  withRepo(({ cwd }) => {
    assert.equal(sessionFileAuthorsData(cwd, 'nope', { transcripts: [] }), null);
    assert.equal(sessionFileAuthorsData(cwd, undefined), null);
  });
});

test('sessionFileAuthorsData: shape is { sessionId, authors }, fail-soft when no diff', () => {
  withRepo(({ cwd, id, transcripts }) => {
    // No git branch / commit resolvable in this temp repo → diff unavailable →
    // authors {} (fail-soft), never a throw.
    const d = sessionFileAuthorsData(cwd, id, { transcripts });
    assert.ok(d);
    assert.equal(d.sessionId, 'cc-1');
    assert.deepEqual(d.authors, {});
  });
});

test('sessionFileAuthorsData: applies the matcher when diff paths are injected', () => {
  withRepo(({ cwd, id, transcripts }) => {
    // Inject the changed-paths set directly (the diff resolution is git-bound and
    // covered by session-diff tests; here we exercise the wiring of paths→matcher).
    const d = sessionFileAuthorsData(cwd, id, { transcripts, paths: ['note.txt'] });
    assert.ok(d);
    assert.deepEqual(d.authors['note.txt'], { turn: 'Write', ts: '2026-06-15T10:00:01.000Z' });
  });
});
