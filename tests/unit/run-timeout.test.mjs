// Safety floor (§I rung 3), feature 1 — every run gets a timeout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { readManifest } from '../../src/notes/module.mjs';
import { act, runGated, resolveTimeoutMs, DEFAULT_TIMEOUT_S, MAX_TIMEOUT_S } from '../../src/use/act.mjs';
import { runWorkflow } from '../../src/use/workflow.mjs';
import { read } from '../../src/notes/log.mjs';

function withHome(setup, fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-timeout-'));
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

// ── resolveTimeoutMs (pure) ─────────────────────────────────────────────────

test('resolveTimeoutMs: default when absent/garbage, clamps at the cap, honors a valid value', () => {
  assert.equal(resolveTimeoutMs(undefined), DEFAULT_TIMEOUT_S * 1000);
  assert.equal(resolveTimeoutMs(null), DEFAULT_TIMEOUT_S * 1000);
  assert.equal(resolveTimeoutMs('not-a-number'), DEFAULT_TIMEOUT_S * 1000);
  assert.equal(resolveTimeoutMs(-5), DEFAULT_TIMEOUT_S * 1000);
  assert.equal(resolveTimeoutMs(0), DEFAULT_TIMEOUT_S * 1000);
  assert.equal(resolveTimeoutMs(30), 30 * 1000);
  assert.equal(resolveTimeoutMs(600), MAX_TIMEOUT_S * 1000);
  assert.equal(resolveTimeoutMs(9999), MAX_TIMEOUT_S * 1000, 'a note cannot opt out of the cap');
});

// ── runGated: an actual timeout kill ────────────────────────────────────────

test('runGated: a run past its timeout is killed and reported timedOut', () => {
  withHome(() => {}, (home) => {
    const r = runGated(home, 'actions', 'sleep 5', { timeout: 0.15 });
    assert.equal(r.ran, true);
    assert.equal(r.timedOut, true);
    assert.equal(r.success, false);
    assert.match(r.error, /timed out/);
  });
});

test('runGated: a run within its timeout is unaffected', () => {
  withHome(() => {}, (home) => {
    const r = runGated(home, 'actions', 'echo fine', { timeout: 5 });
    assert.equal(r.timedOut, undefined);
    assert.equal(r.success, true);
  });
});

// ── act(): the note-level timeout field, end to end ─────────────────────────

test('act: a note past its declared timeout returns ok:false + timedOut, logs success:false + timedOut', () => {
  withHome((home) => {
    writeManifest(home, 'actions', { note_type: 'action' });
    writeZu(home, 'actions', 'slow', { type: 'action', title: 'slow one', run: 'sleep 5', timeout: 0.15 });
  }, (home) => {
    const ctx = { home, module: 'actions', manifest: readManifest(home, 'actions') };
    const r = act(ctx, 'slow');
    assert.equal(r.ok, false);
    assert.equal(r.timedOut, true);
    assert.match(r.error, /timed out/);
    const logged = read(home, 'actions', 'runs')[0];
    assert.equal(logged.success, false);
    assert.equal(logged.timedOut, true);
  });
});

test('act: an ordinary fast note is unaffected by the safety floor (no timedOut marker logged)', () => {
  withHome((home) => {
    writeManifest(home, 'actions', { note_type: 'action' });
    writeZu(home, 'actions', 'fast', { type: 'action', title: 'fast one', run: 'echo hi' });
  }, (home) => {
    const ctx = { home, module: 'actions', manifest: readManifest(home, 'actions') };
    const r = act(ctx, 'fast');
    assert.equal(r.ok, true);
    assert.equal(r.timedOut, undefined);
    const logged = read(home, 'actions', 'runs')[0];
    assert.equal('timedOut' in logged, false, 'no shape change for a run that never timed out');
  });
});

// ── runWorkflow(): a timed-out step triggers the normal saga compensation ──

test('workflow: a step-level timeout override kills a hanging step and compensates prior steps', () => {
  const root = mkdtempSync(join(tmpdir(), 'zz-flow-timeout-'));
  const home = join(root, '.zuzuu');
  const comp = join(root, 'comp');
  try {
    mkdirSync(join(home, 'actions', 'items'), { recursive: true });
    writeFileSync(join(home, 'actions', 'items', 'flow.md'), serialize({
      id: 'flow', type: 'workflow', title: 'has a hanging step',
      steps: [
        { id: 'setup', run: 'true', compensate: `touch ${comp}` },
        { id: 'hang', run: 'sleep 5', 'depends-on': 'setup', timeout: 0.15 },
      ],
    }));
    const r = runWorkflow(home, 'actions', 'flow');
    assert.equal(r.ok, false);
    assert.equal(r.failedStep, 'hang');
    assert.equal(r.steps.find((s) => s.id === 'hang').timedOut, true);
    assert.equal(r.compensations.length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
