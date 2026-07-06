// tests/unit/doctor-autonomy.test.mjs — U6, docs/plans/2026-07-06-001-feat-wake-
// source-tick-plan.md: `zz doctor` must reflect the wake source's opt-in switch —
// ON (with the last tick's timestamp + fired count, mirroring `zz autonomy status`'s
// own read, U4) vs OFF (the idle-triggers hint pointing at `zz autonomy on`).
// Mirrors tests/unit/cli-doctor.test.mjs's `withDir` fixture + tests/unit/tick.test.mjs's
// fixture helpers (a real git repo — durable runs pin a generation via `git show`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { doctorReport } from '../../src/cli/doctor.mjs';
import { initHome } from '../../src/cli/init.mjs';
import { resetCapabilities } from '../../src/serve/wire.mjs';
import { createNote } from '../../src/grow/edit.mjs';
import { tick } from '../../src/grow/tick.mjs';
import { homeDir, repoRoot } from '../../src/notes/store.mjs';

function withRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zz-doctor-autonomy-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd });
  execFileSync('git', ['config', 'user.name', 't'], { cwd });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd });
  resetCapabilities();
  // `homeDir(repoRoot(cwd))` — NOT a raw `join(cwd, '.zuzuu')` — because `repoRoot`
  // shells `git rev-parse --show-toplevel`, which resolves symlinks (macOS's tmpdir()
  // is itself a symlink into /private); `doctorReport` computes `home` the SAME way,
  // so a fixture using the raw path would write the tick log/watermark under a
  // DIFFERENT (unresolved) path than doctor reads from stateDir(home) — a fixture-only
  // mismatch, not a product bug, but one that silently makes the fired-tick assertion
  // below false-fail without this.
  try { return fn(cwd, homeDir(repoRoot(cwd))); } finally { rmSync(cwd, { recursive: true, force: true }); resetCapabilities(); }
}

const enableAutonomy = (home, enabled = true) =>
  createNote(home, 'instructions', 'autonomy', { type: 'autonomy', title: 'Autonomy', autonomy_enabled: enabled });

const putWorkflow = (home, id, steps) => {
  const r = createNote(home, 'actions', id, { type: 'workflow', title: id, steps });
  assert.equal(r.ok, true, `fixture workflow '${id}': ${r.error}`);
};

const putCronTrigger = (home, id, { expr, run, enabled = true }) => {
  const r = createNote(home, 'actions', id, { type: 'trigger', title: id, on: { kind: 'cron', expr }, run, enabled });
  assert.equal(r.ok, true, `fixture cron trigger '${id}': ${r.error}`);
};

const cronExprFor = (date) => `${date.getMinutes()} ${date.getHours()} * * *`;

test('doctor: autonomy OFF surfaces the idle-triggers warning, not the old "never auto-fires" line', () => {
  withRepo((cwd, home) => {
    initHome(cwd);
    putWorkflow(home, 'flow', [{ id: 'a', run: 'true' }]);
    putCronTrigger(home, 't1', { expr: '0 3 * * *', run: 'actions:flow', enabled: true });
    const r = doctorReport(cwd);
    assert.ok(r.warnings.some((w) => /autonomy: OFF/.test(w) && /1 enabled trigger/.test(w) && /zz autonomy on/.test(w)), r.warnings.join('\n'));
    assert.ok(!r.warnings.some((w) => /never auto-fires/.test(w)), 'the retired warning text must be gone');
  });
});

test('doctor: autonomy OFF with no enabled triggers reports 0 idle', () => {
  withRepo((cwd, home) => {
    initHome(cwd);
    const r = doctorReport(cwd);
    assert.ok(r.warnings.some((w) => /autonomy: OFF — 0 enabled trigger/.test(w)), r.warnings.join('\n'));
  });
});

test('doctor: autonomy ON with no tick run yet reports the ON/idle-tick form', () => {
  withRepo((cwd, home) => {
    initHome(cwd);
    enableAutonomy(home, true);
    const r = doctorReport(cwd);
    assert.ok(r.info.some((i) => /autonomy: ON/.test(i) && /no tick has run yet/.test(i)), r.info.join('\n'));
    assert.ok(!r.warnings.some((w) => /autonomy: OFF/.test(w)));
  });
});

test('doctor: autonomy ON after a real tick shows last-tick timestamp + fired count', () => {
  withRepo((cwd, home) => {
    initHome(cwd);
    enableAutonomy(home, true);
    const now = new Date();
    putWorkflow(home, 'flow', [{ id: 'a', run: 'true' }]);
    putCronTrigger(home, 't1', { expr: cronExprFor(now), run: 'actions:flow', enabled: true });
    const t = tick(home, { now });
    assert.equal(t.fired.length, 1, `fixture tick should have fired: ${JSON.stringify(t)}`);

    const r = doctorReport(cwd);
    assert.ok(r.info.some((i) => /autonomy: ON — last tick .+, fired 1/.test(i)), r.info.join('\n'));
  });
});
