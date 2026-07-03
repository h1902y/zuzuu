// Safety floor (§I rung 3), feature 4 — per-note run lock: refuse a concurrent run
// of the SAME note; steal a stale one (a crashed holder past its own timeout).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, utimesSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { readManifest } from '../../src/notes/module.mjs';
import { cacheDir } from '../../src/notes/store.mjs';
import { acquireRunLock } from '../../src/use/run-lock.mjs';
import { act } from '../../src/use/act.mjs';
import { runWorkflow, workflowStaleAfterMs } from '../../src/use/workflow.mjs';

function withHome(setup, fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-lock-'));
  const home = join(root, '.zuzuu');
  setup(home);
  try { return fn(home); } finally { rmSync(root, { recursive: true, force: true }); }
}
const writeZu = (home, module, id, note) => {
  mkdirSync(join(home, module, 'items'), { recursive: true });
  writeFileSync(join(home, module, 'items', `${id}.md`), serialize({ id, ...note }));
};
const writeManifest = (home, module, note) => {
  mkdirSync(join(home, module), { recursive: true });
  writeFileSync(join(home, module, 'module.md'), serialize({ type: 'module', id: module, ...note }));
};

// ── acquireRunLock (pure lock mechanics) ─────────────────────────────────────

test('acquireRunLock: a second concurrent acquire is refused; release frees it for a third', () => {
  withHome(() => {}, (home) => {
    const first = acquireRunLock(home, 'actions', 'note-a', 60_000);
    assert.equal(first.ok, true);

    const second = acquireRunLock(home, 'actions', 'note-a', 60_000);
    assert.equal(second.ok, false);
    assert.equal(second.running, true);
    assert.match(second.error, /already running/);

    first.release();
    const third = acquireRunLock(home, 'actions', 'note-a', 60_000);
    assert.equal(third.ok, true);
    third.release();
  });
});

test('acquireRunLock: different notes never contend', () => {
  withHome(() => {}, (home) => {
    const a = acquireRunLock(home, 'actions', 'note-a', 60_000);
    const b = acquireRunLock(home, 'actions', 'note-b', 60_000);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    a.release();
    b.release();
  });
});

test('acquireRunLock: a stale lock (older than staleAfterMs) is stolen, not respected', () => {
  withHome(() => {}, (home) => {
    const first = acquireRunLock(home, 'actions', 'note-a', 100); // 100ms staleness window
    assert.equal(first.ok, true);
    // backdate the lock dir's mtime so it reads as older than the (tiny) window —
    // simulates a crashed holder rather than sleeping in the test.
    const dir = join(cacheDir(home), 'run-locks', 'actions__note-a.lock');
    const old = new Date(Date.now() - 10_000);
    utimesSync(dir, old, old);

    const second = acquireRunLock(home, 'actions', 'note-a', 100);
    assert.equal(second.ok, true, 'a stale lock is stolen rather than refusing the new run');
    assert.equal(existsSync(dir), true, 'the lock dir still exists — reacquired, not left dangling');
    second.release();
  });
});

test('acquireRunLock: lives under the XDG cache dir, never the tracked .zuzuu tree', () => {
  withHome(() => {}, (home) => {
    const lock = acquireRunLock(home, 'actions', 'note-a', 60_000);
    assert.equal(lock.ok, true);
    assert.ok(!existsSync(join(home, 'actions', 'run-locks')), 'nothing landed inside the tracked home');
    assert.ok(existsSync(join(cacheDir(home), 'run-locks', 'actions__note-a.lock')));
    lock.release();
  });
});

// ── act(): a concurrent run of the SAME note is refused ────────────────────

test('act: a second concurrent invocation of the same note is refused', () => {
  withHome((home) => {
    writeManifest(home, 'actions', { note_type: 'action' });
    writeZu(home, 'actions', 'hello', { type: 'action', title: 'say hi', run: 'echo hi' });
  }, (home) => {
    const ctx = { home, module: 'actions', manifest: readManifest(home, 'actions') };
    // hold the lock manually (simulating an in-flight run) rather than racing a real
    // spawnSync, which is deterministic and fast enough to always finish first.
    const held = acquireRunLock(home, 'actions', 'hello', 60_000);
    assert.equal(held.ok, true);

    const r = act(ctx, 'hello');
    assert.equal(r.ok, false);
    assert.equal(r.running, true);
    assert.match(r.error, /already running/);

    held.release();
    const r2 = act(ctx, 'hello');
    assert.equal(r2.ok, true, 'released — a fresh invocation proceeds normally');
  });
});

test('act: a stale lock (previous holder crashed) is stolen and the run proceeds', () => {
  withHome((home) => {
    writeManifest(home, 'actions', { note_type: 'action' });
    // a short (but realistic — the actual `echo` easily finishes well inside it)
    // declared timeout keeps this note's staleAfterMs window (timeout + 30s grace)
    // small enough to backdate past without an unrealistic run timeout of its own.
    writeZu(home, 'actions', 'hello', { type: 'action', title: 'say hi', run: 'echo hi', timeout: 1 });
  }, (home) => {
    const ctx = { home, module: 'actions', manifest: readManifest(home, 'actions') };
    const held = acquireRunLock(home, 'actions', 'hello', 60_000);
    assert.equal(held.ok, true);
    // backdate past this note's staleAfterMs window (1s timeout + 30s grace = 31s)
    const dir = join(cacheDir(home), 'run-locks', 'actions__hello.lock');
    const old = new Date(Date.now() - 40_000);
    utimesSync(dir, old, old);

    const r = act(ctx, 'hello');
    assert.equal(r.ok, true, 'the stale lock was stolen, not respected');
  });
});

// ── runWorkflow(): one lock for the whole workflow, shared by every step ───

test('workflow: a concurrent invocation of the same workflow note is refused', () => {
  withHome((home) => {
    writeZu(home, 'actions', 'flow', { type: 'workflow', title: 'w', steps: [{ id: 'a', run: 'true' }, { id: 'b', run: 'true', 'depends-on': 'a' }] });
  }, (home) => {
    const held = acquireRunLock(home, 'actions', 'flow', 60_000);
    assert.equal(held.ok, true);

    const r = runWorkflow(home, 'actions', 'flow');
    assert.equal(r.ok, false);
    assert.equal(r.running, true);

    held.release();
    const r2 = runWorkflow(home, 'actions', 'flow');
    assert.equal(r2.ok, true);
  });
});

// SF2 (audit 2026-07-03): the lock staleness window must cover a worst-case
// failure-then-full-rollback, not just the run phase — else a legitimate rollback
// still in flight can have its own lock stolen by a concurrent invocation, the exact
// double-run the lock exists to prevent.
test('workflow: the lock staleness window covers a worst-case failure-then-full-rollback (compensation budget included)', () => {
  const steps = [
    { id: 'a', run: 'true', compensate: 'true', timeout: 5 },
    { id: 'b', run: 'true', compensate: 'true', timeout: 5, 'depends-on': 'a' },
    { id: 'c', run: 'false', timeout: 5, 'depends-on': 'b' }, // fails → rolls back a and b
  ];
  const staleAfterMs = workflowStaleAfterMs(steps); // 15s run budget + 240s compensation budget + grace
  withHome((home) => {
    writeZu(home, 'actions', 'flow', { type: 'workflow', title: 'w', steps });
  }, (home) => {
    const held = acquireRunLock(home, 'actions', 'flow', staleAfterMs);
    assert.equal(held.ok, true);
    const dir = join(cacheDir(home), 'run-locks', 'actions__flow.lock');

    // backdate to JUST inside the worst-case window (age < staleAfterMs) — a run that
    // failed late and is still legitimately rolling back must NOT lose its lock. The
    // OLD (buggy) computation omitted the compensation budget entirely, so an age
    // like this (well past run-phase-only budget) would have been misjudged stale.
    const justInside = new Date(Date.now() - (staleAfterMs - 5_000));
    utimesSync(dir, justInside, justInside);
    const stillRolling = runWorkflow(home, 'actions', 'flow');
    assert.equal(stillRolling.running, true, 'still within the worst-case rollback window — refused, not stolen');

    // push past the FULL worst-case window — now genuinely stale, steal proceeds
    const pastWindow = new Date(Date.now() - (staleAfterMs + 5_000));
    utimesSync(dir, pastWindow, pastWindow);
    const stolen = runWorkflow(home, 'actions', 'flow');
    assert.notEqual(stolen.running, true, 'past the full window — the lock was reacquired (stolen), not refused');
  });
});
