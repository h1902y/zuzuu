// rung 6 — observe: adapter signal extraction · aggregate · routing to modules.
// The adapter fixture mirrors the real Claude transcript shape (verified against
// ~/.claude/projects transcripts Claude actually produced — real-wire-data rule).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { claudeCode } from '../../src/hosts/adapters/claude-code.mjs';
import { aggregate, observe } from '../../src/grow/observe.mjs';
import { listProposals } from '../../src/grow/propose.mjs';

// one transcript line per row, exactly as Claude Code writes them
function fixtureTranscript(rows) {
  const dir = mkdtempSync(join(tmpdir(), 'zuzuu-tx-'));
  const file = join(dir, 'sess.jsonl');
  writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return file;
}
const user = (text) => ({ type: 'user', sessionId: 'sess', message: { role: 'user', content: [{ type: 'text', text }] } });
const bash = (id, command) => ({ type: 'assistant', sessionId: 'sess', message: { role: 'assistant', content: [{ type: 'tool_use', id, name: 'Bash', input: { command } }] } });
const edit = (id, file_path) => ({ type: 'assistant', sessionId: 'sess', message: { role: 'assistant', content: [{ type: 'tool_use', id, name: 'Edit', input: { file_path } }] } });
const result = (id, isError = false) => ({ type: 'user', sessionId: 'sess', message: { content: [{ type: 'tool_result', tool_use_id: id, is_error: isError, content: 'ok' }] } });

// ── adapter: signal extraction from a real-shaped transcript ─────────────────

test('adapter: mineSignals extracts commands, files, failures, corrections', () => {
  const file = fixtureTranscript([
    user('build the thing'),
    bash('t1', 'npm run build'), result('t1', false),
    edit('t2', '/proj/src/App.tsx'), result('t2', false),
    bash('t3', 'rm -rf /'), result('t3', true),       // a destructive failure
    user("no, don't do that — always run tests first"), // a corrective turn after a tool action
  ]);
  const s = claudeCode.mineSignals(file);
  assert.equal(s.sessionId, 'sess');
  assert.deepEqual(s.commands.map((c) => c.cmd), ['npm run build', 'rm -rf /']);
  assert.deepEqual(s.files, ['/proj/src/App.tsx']);
  assert.deepEqual(s.failures, ['Bash']); // t3 failed
  assert.equal(s.destructiveFailures.length, 1);
  assert.equal(s.correctionTurns.length, 1);
  rmSync(join(file, '..'), { recursive: true, force: true });
});

test('adapter: a malformed line is skipped, never fatal', () => {
  const dir = mkdtempSync(join(tmpdir(), 'zuzuu-tx-'));
  const file = join(dir, 'sess.jsonl');
  writeFileSync(file, '{not json\n' + JSON.stringify(bash('t1', 'ls')) + '\n' + JSON.stringify(result('t1')) + '\n');
  const s = claudeCode.mineSignals(file);
  assert.deepEqual(s.commands.map((c) => c.cmd), ['ls']);
  rmSync(dir, { recursive: true, force: true });
});

test('adapter: a missing file returns empty signals (fail-soft)', () => {
  const s = claudeCode.mineSignals('/no/such/transcript.jsonl');
  assert.deepEqual(s.commands, []);
  assert.deepEqual(s.files, []);
});

// ── aggregate: the corroboration thresholds ──────────────────────────────────

test('aggregate: a command recurring across enough sessions becomes a candidate', () => {
  const sessions = [
    { sessionId: 'a', commands: [{ cmd: 'npm test', failed: false }], files: [], failures: [] },
    { sessionId: 'b', commands: [{ cmd: 'npm test', failed: false }], files: [], failures: [] },
    { sessionId: 'c', commands: [{ cmd: 'npm test', failed: false }], files: [], failures: [] },
  ];
  const cands = aggregate(sessions);
  assert.equal(cands.length, 1);
  assert.equal(cands[0].kind, 'command');
  assert.equal(cands[0].attributes.command, 'npm test');
});

test('aggregate: a single sighting is below threshold — proposes nothing', () => {
  const sessions = [{ sessionId: 'a', commands: [{ cmd: 'npm test', failed: false }], files: [], failures: [] }];
  assert.equal(aggregate(sessions).length, 0);
});

test('aggregate: a hot file (≥5 touches) becomes a knowledge entity', () => {
  const sessions = [{ sessionId: 'a', commands: [], failures: [], files: Array(5).fill('/p/src/App.tsx') }];
  const cands = aggregate(sessions);
  assert.equal(cands.length, 1);
  assert.equal(cands[0].kind, 'entity');
});

// ── observe: candidates → proposals routed to the right module ───────────────

test('observe: routes a command to actions (runnable) and a file to knowledge', () => {
  const root = mkdtempSync(join(tmpdir(), 'zuzuu-obs-'));
  const home = join(root, '.zuzuu');
  const sessions = [
    { sessionId: 'a', commands: [{ cmd: 'npm run build', failed: false }], failures: [], files: Array(5).fill('/p/src/App.tsx') },
    { sessionId: 'b', commands: [{ cmd: 'npm run build', failed: false }], failures: [], files: [] },
    { sessionId: 'c', commands: [{ cmd: 'npm run build', failed: false }], failures: [], files: [] },
  ];
  const r = observe(home, { sessions });
  assert.equal(r.proposed, 2);
  const actions = listProposals(home, 'actions');
  const knowledge = listProposals(home, 'knowledge');
  assert.equal(actions.length, 1);
  assert.equal(actions[0].change.type, 'action');
  assert.equal(actions[0].change.run, 'npm run build', 'the command became a runnable action note');
  assert.equal(knowledge.length, 1);
  assert.equal(knowledge[0].change.type, 'knowledge');

  // idempotent — a second observe of the same evidence proposes nothing new
  assert.equal(observe(home, { sessions }).proposed, 0);
  rmSync(root, { recursive: true, force: true });
});

// ── the `fact` route (frequently-failing tool → knowledge) — was untested ────

test('aggregate: a tool failing across enough sessions becomes a fact candidate', () => {
  const sessions = Array.from({ length: 3 }, (_, i) => ({ sessionId: `s${i}`, commands: [], files: [], failures: ['Bash'] }));
  const fact = aggregate(sessions).find((c) => c.kind === 'fact');
  assert.ok(fact, 'a recurring tool failure (≥ minFailures) is a fact candidate');
  assert.equal(fact.id, 'failing-tool-bash');
  assert.match(fact.title, /Bash fails frequently/);
});

test('aggregate: a tool failing in too few sessions is below the threshold', () => {
  const sessions = Array.from({ length: 2 }, (_, i) => ({ sessionId: `s${i}`, commands: [], files: [], failures: ['Bash'] }));
  assert.equal(aggregate(sessions).filter((c) => c.kind === 'fact').length, 0);
});

test('observe: a recurring tool failure routes a fact to knowledge', () => {
  const root = mkdtempSync(join(tmpdir(), 'zuzuu-obs-fact-'));
  const home = join(root, '.zuzuu');
  const sessions = Array.from({ length: 3 }, (_, i) => ({ sessionId: `s${i}`, commands: [], files: [], failures: ['Bash'] }));
  observe(home, { sessions });
  const knowledge = listProposals(home, 'knowledge');
  assert.equal(knowledge.length, 1);
  assert.equal(knowledge[0].change.type, 'knowledge');
  assert.match(knowledge[0].change.title, /Bash fails frequently/);
  rmSync(root, { recursive: true, force: true });
});
