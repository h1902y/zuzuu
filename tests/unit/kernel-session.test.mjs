// rung 8a — the session record + lifecycle + index (kernel/session).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SessionState, isTerminal, canTransition, transition, makeSession,
  readIndex, upsertSession, getSession, removeSession,
} from '../../zuzuu/kernel/session.mjs';

function withCwd(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zuzuu-ses-'));
  try { return fn(cwd); } finally { rmSync(cwd, { recursive: true, force: true }); }
}

// ── lifecycle ─────────────────────────────────────────────────────────────────

test('lifecycle: legal transitions advance; illegal ones throw', () => {
  const s = makeSession({ id: 'a', host: 'claude-code', status: SessionState.OPENING, startedAt: '2026-06-21T00:00:00Z' });
  assert.equal(canTransition(SessionState.OPENING, SessionState.ACTIVE), true);
  const active = transition(s, SessionState.ACTIVE);
  assert.equal(active.status, 'active');
  const done = transition(active, SessionState.COMPLETED, '2026-06-21T00:00:10Z');
  assert.equal(done.status, 'completed');
  assert.equal(done.durationMs, 10000, 'duration computed on terminal transition');
  assert.equal(isTerminal('completed'), true);
  assert.throws(() => transition(done, SessionState.ACTIVE), /illegal session transition/);
});

test('makeSession: requires id+host, rejects unknown status, preserves extra fields', () => {
  assert.throws(() => makeSession({ host: 'h' }), /id required/);
  assert.throws(() => makeSession({ id: 'x', host: 'h', status: 'bogus' }), /unknown status/);
  // session-mgmt fields (branch/baseline/previousSession) ride along untouched
  const s = makeSession({ id: 'x', host: 'claude-code', branch: 'zz/session-x', baseline: 'abc123', previousSession: 'w' });
  assert.equal(s.branch, 'zz/session-x');
  assert.equal(s.baseline, 'abc123');
  assert.equal(s.previousSession, 'w');
  assert.equal(s.status, 'captured', 'default status');
  assert.equal('traceRef' in s, false, 'no OTLP fields (trace layer dropped)');
});

// ── index ─────────────────────────────────────────────────────────────────────

test('index: empty when absent; upsert persists valid JSON', () => {
  withCwd((cwd) => {
    assert.deepEqual(readIndex(cwd).sessions, []);
    upsertSession(makeSession({ id: 'a', host: 'claude-code', startedAt: '2026-06-21T01:00:00Z' }), cwd);
    const idx = readIndex(cwd);
    assert.equal(idx.sessions.length, 1);
    assert.equal(idx.sessions[0].id, 'a');
  });
});

test('index: upsert replaces by (id,host); newest-first order', () => {
  withCwd((cwd) => {
    upsertSession(makeSession({ id: 'a', host: 'claude-code', startedAt: '2026-06-21T01:00:00Z' }), cwd);
    upsertSession(makeSession({ id: 'b', host: 'claude-code', startedAt: '2026-06-21T02:00:00Z' }), cwd);
    upsertSession(makeSession({ id: 'a', host: 'claude-code', status: SessionState.COMPLETED, startedAt: '2026-06-21T01:00:00Z' }), cwd);
    const idx = readIndex(cwd);
    assert.equal(idx.sessions.length, 2, 'a replaced, not duplicated');
    assert.equal(idx.sessions[0].id, 'b', 'newest startedAt first');
    assert.equal(getSession('a', cwd).status, 'completed');
  });
});

test('index: getSession/removeSession scope by id (+host)', () => {
  withCwd((cwd) => {
    upsertSession(makeSession({ id: 'a', host: 'claude-code', startedAt: '2026-06-21T01:00:00Z' }), cwd);
    upsertSession(makeSession({ id: 'a', host: 'opencode', startedAt: '2026-06-21T01:00:00Z' }), cwd);
    assert.equal(readIndex(cwd).sessions.length, 2, 'same id, different host = two records');
    assert.equal(removeSession('a', cwd, 'opencode'), 1);
    assert.equal(readIndex(cwd).sessions.length, 1);
    assert.equal(getSession('a', cwd).host, 'claude-code');
  });
});

test('index: a corrupt file reads as empty (tolerant)', () => {
  withCwd((cwd) => {
    upsertSession(makeSession({ id: 'a', host: 'h', startedAt: '2026-06-21T01:00:00Z' }), cwd);
    writeFileSync(join(cwd, '.zuzuu', 'sessions.json'), '{ this is not json');
    assert.deepEqual(readIndex(cwd).sessions, []);
  });
});
