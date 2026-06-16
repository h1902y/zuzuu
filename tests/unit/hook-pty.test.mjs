// U4 — the SessionStart hook records the daemon's injected PTY id (ZUZUU_PTY_ID)
// into the durable trace record AND the live record, making the PTY <-> trace
// join explicit (KTD2). Characterization-first: a session with NO injected id
// carries no ptyId facet (back-compat), and the absent case never crashes.
//
// Hermetic: drives handleHook's OPEN branch against the real claude-code adapter
// + the claude-sample transcript fixture, asserting against the written index +
// live record. The PTY id is injected explicitly (the hook also reads it from
// the OS environment in production; here we pass it to keep the test free of
// global env mutation).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { handleHook } from '../../zuzuu/commands/hook.mjs';
import { captureTrace } from '../../zuzuu/core/capture-core.mjs';
import { byName } from '../../zuzuu/capture/adapters/registry.mjs';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'claude-sample.jsonl');

function withRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zuzuu-hook-pty-'));
  mkdirSync(join(cwd, '.zuzuu'), { recursive: true });
  try { return fn(cwd); } finally { rmSync(cwd, { recursive: true, force: true }); }
}

const readIndex = (cwd) => JSON.parse(readFileSync(join(cwd, '.zuzuu', 'sessions.json'), 'utf8'));
const liveRecords = (cwd) => {
  const dir = join(cwd, '.zuzuu', '.live');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
};

// A representative daemon PTY id (the daemon uses 16 hex chars; any opaque
// token works for the join).
const PTY_A = 'pty0011223344aabb';
const PTY_B = 'pty99887766ccddee';

// Characterization: capture WITHOUT a ptyId → the index record omits the facet.
test('captureTrace: a record built with no ptyId carries no ptyId facet (characterization)', () => {
  withRepo((cwd) => {
    const { record } = captureTrace({ adapter: byName('claude-code'), ref: FIXTURE, cwd });
    assert.equal('ptyId' in record, false);
    assert.equal('ptyId' in readIndex(cwd).sessions[0], false);
  });
});

// U4: the injected PTY id lands on the durable index record via captureTrace.
test('captureTrace: the injected ptyId threads onto the durable record', () => {
  withRepo((cwd) => {
    const { record } = captureTrace({ adapter: byName('claude-code'), ref: FIXTURE, cwd, ptyId: PTY_A });
    assert.equal(record.ptyId, PTY_A);
    assert.equal(readIndex(cwd).sessions[0].ptyId, PTY_A);
  });
});

// U4: the SessionStart hook records the injected id end-to-end (index + live).
test('handleHook OPEN: records the injected ptyId into the trace + live record', () => {
  withRepo((cwd) => {
    handleHook({ event: 'SessionStart', payload: { session_id: 's1', transcript_path: FIXTURE }, cwd, host: 'claude-code', ptyId: PTY_A });
    const rec = readIndex(cwd).sessions[0];
    assert.equal(rec.ptyId, PTY_A);
    const live = liveRecords(cwd);
    assert.equal(live.length, 1);
    assert.equal(live[0].ptyId, PTY_A);
  });
});

// Absent variable → no ptyId facet, no crash (CLI / non-workbench session).
test('handleHook OPEN: absent ptyId → no facet, no crash (fail-soft)', () => {
  withRepo((cwd) => {
    assert.doesNotThrow(() =>
      handleHook({ event: 'SessionStart', payload: { session_id: 's1', transcript_path: FIXTURE }, cwd, host: 'claude-code', ptyId: null }),
    );
    const rec = readIndex(cwd).sessions[0];
    assert.equal('ptyId' in rec, false);
    const live = liveRecords(cwd);
    assert.equal(live[0].ptyId ?? null, null);
  });
});

// Two different sessions don't cross-link: each capture writes its own id.
test('two captures keep distinct ptyIds (no cross-link / no shared global)', () => {
  withRepo((cwd) => {
    captureTrace({ adapter: byName('claude-code'), ref: FIXTURE, cwd, ptyId: PTY_A });
    const first = readIndex(cwd).sessions[0];
    captureTrace({ adapter: byName('claude-code'), ref: FIXTURE, cwd, ptyId: PTY_B });
    const after = readIndex(cwd).sessions.find((s) => s.id === first.id);
    assert.equal(after.ptyId, PTY_B, 'each capture writes its own ptyId, not a cross-linked one');
  });
});
