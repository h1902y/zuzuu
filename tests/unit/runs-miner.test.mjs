// §I rung 2 — the runs-miner: observe's sibling. Mines notes/log.mjs's runs.jsonl
// (real act()/runWorkflow() executions) into per-note evidence, then stages ONE
// aggregate proposal per note crossing a threshold — never one per failed run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { logRun, append, read } from '../../src/notes/log.mjs';
import { ensureModuleManifest } from '../../src/notes/module-templates.mjs';
import { listStaged, stageChange } from '../../src/grow/stage.mjs';
import {
  mineRuns, needsAttention, observeRuns,
  CONSECUTIVE_FAILURE_THRESHOLD, FAILURE_RATE_THRESHOLD, FAILURE_RATE_MIN_RUNS, HEALTH_NEEDS_ATTENTION,
} from '../../src/grow/runs-miner.mjs';

function withHome(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-runs-miner-'));
  const home = join(root, '.zuzuu');
  try { return fn(home, root); } finally { rmSync(root, { recursive: true, force: true }); }
}

/** Append N run events for one note, in order. `outcomes`: array of booleans
 *  (success), or {success, ts, timedOut, inputs} objects for finer control. */
function seedRuns(home, module, note, outcomes, extra = {}) {
  for (const o of outcomes) {
    const opts = typeof o === 'boolean' ? { success: o } : o;
    logRun(home, module, note, { exitCode: opts.success ? 0 : 1, actor: 'agent', ...extra, ...opts });
  }
}

// ── mineRuns: pure evidence math ──────────────────────────────────────────────────

test('mineRuns: totals, failures, rate, and the TRAILING consecutive-failure streak', () => {
  withHome((home) => {
    // fail, fail, success, fail, fail, fail — streak counts only the trailing 3,
    // not all 5 failures across the whole history.
    seedRuns(home, 'actions', 'flaky', [false, false, true, false, false, false]);
    const [ev] = mineRuns(home, { module: 'actions' });
    assert.equal(ev.addr, 'actions:flaky');
    assert.equal(ev.totalRuns, 6);
    assert.equal(ev.failures, 5);
    assert.equal(ev.consecutiveFailureStreak, 3, 'only the TRAILING run of failures counts');
    assert.ok(Math.abs(ev.failureRate - 5 / 6) < 1e-9);
  });
});

test('mineRuns: a streak resets to 0 the moment the most recent run succeeded', () => {
  withHome((home) => {
    seedRuns(home, 'actions', 'recovered', [false, false, false, false, true]);
    const [ev] = mineRuns(home, { module: 'actions' });
    assert.equal(ev.consecutiveFailureStreak, 0, 'passing right now — a past bad streak does not linger');
    assert.equal(ev.failures, 4, 'the historical failure count is still honest');
  });
});

test('mineRuns: timedOut runs are counted separately from ordinary failures', () => {
  withHome((home) => {
    seedRuns(home, 'actions', 'slow', [
      { success: false, timedOut: true },
      { success: false, timedOut: true },
      { success: true },
    ]);
    const [ev] = mineRuns(home, { module: 'actions' });
    assert.equal(ev.timedOut, 2);
    assert.equal(ev.failures, 2);
  });
});

test('mineRuns: firstSeen/lastSeen derive from ts when present; null when every run is untimestamped', () => {
  withHome((home) => {
    seedRuns(home, 'actions', 'timed', [
      { success: false, ts: '2026-07-01T00:00:00Z' },
      { success: false, ts: '2026-07-03T00:00:00Z' },
      { success: false, ts: '2026-07-02T00:00:00Z' },
    ]);
    const [timed] = mineRuns(home, { module: 'actions' });
    assert.equal(timed.firstSeen, '2026-07-01T00:00:00Z');
    assert.equal(timed.lastSeen, '2026-07-03T00:00:00Z');

    seedRuns(home, 'actions', 'untimed', [false, false]); // production shape: ts always absent
    const untimed = mineRuns(home, { module: 'actions' }).find((e) => e.note === 'untimed');
    assert.equal(untimed.firstSeen, null, 'null is the honest "not recorded" signal, never invented');
    assert.equal(untimed.lastSeen, null);
  });
});

test('mineRuns: --since keeps untimestamped runs (never silently blinded) but excludes KNOWN older ones', () => {
  withHome((home) => {
    seedRuns(home, 'actions', 'windowed', [
      { success: false, ts: '2026-01-01T00:00:00Z' }, // before the window — excluded
      { success: false, ts: '2026-08-01T00:00:00Z' }, // inside the window — kept
      { success: false }, // no ts at all — kept (can't confidently exclude it)
    ]);
    const [ev] = mineRuns(home, { module: 'actions', sinceTs: '2026-07-01T00:00:00Z' });
    assert.equal(ev.totalRuns, 2, 'the pre-window dated run is excluded; the undated one is not');
  });
});

test('mineRuns: ignores non-run events (query) that also live in runs.jsonl', () => {
  withHome((home) => {
    seedRuns(home, 'actions', 'noisy', [false, false, false]);
    append(home, 'actions', { event: 'query', ts: null, note: 'noisy', actor: 'agent' });
    const [ev] = mineRuns(home, { module: 'actions' });
    assert.equal(ev.totalRuns, 3, 'the query event never counts as a run');
  });
});

test('mineRuns: with no module given, mines across every module the Project has', () => {
  withHome((home) => {
    ensureModuleManifest(home, 'actions');
    ensureModuleManifest(home, 'crm');
    seedRuns(home, 'actions', 'a1', [false, false, false]);
    seedRuns(home, 'crm', 'c1', [false, false, false]);
    const addrs = mineRuns(home).map((e) => e.addr).sort();
    assert.deepEqual(addrs, ['actions:a1', 'crm:c1']);
  });
});

// ── needsAttention: threshold boundaries ──────────────────────────────────────────

test('needsAttention: flags AT the consecutive-failure threshold, not one below it', () => {
  assert.equal(needsAttention({ consecutiveFailureStreak: CONSECUTIVE_FAILURE_THRESHOLD, totalRuns: CONSECUTIVE_FAILURE_THRESHOLD, failureRate: 1 }), true);
  assert.equal(needsAttention({ consecutiveFailureStreak: CONSECUTIVE_FAILURE_THRESHOLD - 1, totalRuns: CONSECUTIVE_FAILURE_THRESHOLD - 1, failureRate: 1 }), false);
});

test('needsAttention: flags AT ≥50% over ≥4 runs; a high rate under minRuns does not flag', () => {
  assert.equal(needsAttention({ consecutiveFailureStreak: 0, totalRuns: FAILURE_RATE_MIN_RUNS, failureRate: FAILURE_RATE_THRESHOLD }), true);
  assert.equal(needsAttention({ consecutiveFailureStreak: 0, totalRuns: FAILURE_RATE_MIN_RUNS - 1, failureRate: 1 }), false, 'not enough runs for the rate rule to trust the signal');
});

test('needsAttention: a rate just under the threshold, with enough runs, does not flag', () => {
  assert.equal(needsAttention({ consecutiveFailureStreak: 0, totalRuns: 9, failureRate: 4 / 9 }), false);
  assert.equal(needsAttention({ consecutiveFailureStreak: 0, totalRuns: 9, failureRate: 5 / 9 }), true);
});

test('mineRuns → needsAttention: an end-to-end boundary case with real seeded runs', () => {
  withHome((home) => {
    // 2 failures / 4 runs = 50%, but not consecutive (streak stays low) — rate rule alone must fire.
    seedRuns(home, 'actions', 'rate-only', [false, true, false, true]);
    const [ev] = mineRuns(home, { module: 'actions' });
    assert.equal(ev.consecutiveFailureStreak < CONSECUTIVE_FAILURE_THRESHOLD, true);
    assert.equal(needsAttention(ev), true, 'rate rule fires even without a streak');

    // scattered failures below both thresholds
    seedRuns(home, 'actions', 'below-both', [false, true, false]);
    const below = mineRuns(home, { module: 'actions' }).find((e) => e.note === 'below-both');
    assert.equal(needsAttention(below), false);
  });
});

// ── observeRuns: aggregation, idempotency, dry-run, staging shape ────────────────

test('observeRuns: 10 failed runs on ONE note synthesize exactly ONE proposal (never one per failure)', () => {
  withHome((home) => {
    seedRuns(home, 'actions', 'hot-mess', Array(10).fill(false));
    const r = observeRuns(home, { module: 'actions' });
    assert.equal(r.flagged, 1);
    assert.equal(r.proposed, 1);
    assert.equal(r.staged.length, 1);
    assert.equal(listStaged(home, 'actions').length, 1);
  });
});

test('observeRuns: the staged proposal shape — an `update` setting health, never status, evidence + rationale attached', () => {
  withHome((home) => {
    seedRuns(home, 'actions', 'broken', [false, false, false]);
    observeRuns(home, { module: 'actions' });
    const [p] = listStaged(home, 'actions');
    assert.equal(p.op, 'update');
    assert.equal(p.target, 'broken');
    assert.deepEqual(p.change, { health: HEALTH_NEEDS_ATTENTION });
    assert.equal('status' in p.change, false, 'the miner never asserts the note lifecycle status');
    assert.match(p.rationale, /broken.*3\/3 runs/);
    assert.equal(p.evidence[0].kind, 'run-failures');
    assert.equal(p.evidence[0].consecutiveFailureStreak, 3);
    assert.equal(p.source.producer, 'runs-miner');
  });
});

test('observeRuns: idempotent — running twice on the same unresolved evidence stages exactly once', () => {
  withHome((home) => {
    seedRuns(home, 'actions', 'repeat-offender', [false, false, false]);
    const first = observeRuns(home, { module: 'actions' });
    assert.equal(first.proposed, 1);
    const second = observeRuns(home, { module: 'actions' });
    assert.equal(second.proposed, 0, 'the pending proposal already covers this note');
    assert.equal(listStaged(home, 'actions').length, 1, 'still exactly one staged row');
  });
});

test('observeRuns: idempotent even as MORE failures accrue (still one row, not a growing pile)', () => {
  withHome((home) => {
    seedRuns(home, 'actions', 'still-broken', [false, false, false]);
    observeRuns(home, { module: 'actions' });
    seedRuns(home, 'actions', 'still-broken', [false, false]); // 5 failures now
    const r = observeRuns(home, { module: 'actions' });
    assert.equal(r.proposed, 0);
    assert.equal(listStaged(home, 'actions').length, 1);
  });
});

test('observeRuns: --dry-run computes candidates but stages nothing', () => {
  withHome((home) => {
    seedRuns(home, 'actions', 'preview-only', [false, false, false]);
    const r = observeRuns(home, { module: 'actions', dryRun: true });
    assert.equal(r.flagged, 1);
    assert.equal(r.candidates.length, 1);
    assert.equal(r.candidates[0].target, 'preview-only');
    assert.equal(r.proposed, 0);
    assert.equal(r.staged.length, 0);
    assert.equal(listStaged(home, 'actions').length, 0, 'nothing actually written to disk');
  });
});

test('observeRuns: a healthy note (no streak, low rate) proposes nothing', () => {
  withHome((home) => {
    seedRuns(home, 'actions', 'reliable', [true, true, true, false, true, true]);
    const r = observeRuns(home, { module: 'actions' });
    assert.equal(r.flagged, 0);
    assert.equal(r.proposed, 0);
    assert.equal(listStaged(home, 'actions').length, 0);
  });
});

test('observeRuns: an unrelated PENDING proposal on the same note (a different producer) does not block the miner', () => {
  withHome((home) => {
    ensureModuleManifest(home, 'actions');
    // stage a proposal on the SAME note id from a DIFFERENT producer first (e.g. a
    // human `zz stage`, or `observe`'s session-mined route) — the idempotency guard
    // is scoped to `source.producer === 'runs-miner'`, so this must not block it.
    stageChange(home, 'actions', {
      op: 'update', target: 'shared', change: { title: 'renamed by a human' },
      source: { producer: 'human' },
    });
    seedRuns(home, 'actions', 'shared', [false, false, false]);
    const r1 = observeRuns(home, { module: 'actions' });
    assert.equal(r1.proposed, 1, 'the miner still stages its own aggregate proposal');
    assert.equal(listStaged(home, 'actions').length, 2, 'both proposals coexist, pending review');
  });
});

// ── redaction: secrets never surface through mined evidence ──────────────────────

test('redaction: a secret-shaped run input stays redacted in runs.jsonl AND never surfaces via mineRuns/observeRuns', () => {
  withHome((home) => {
    const secret = 'sk-live-do-not-leak-this';
    for (let i = 0; i < 3; i++) {
      logRun(home, 'actions', 'leaky', { inputs: { api_key: secret }, exitCode: 1, success: false, actor: 'agent' });
    }
    // the raw log already redacts at write time (notes/log.mjs) — confirm the fixture
    // itself proves it, then confirm the miner surfaces nothing that could leak it.
    const raw = read(home, 'actions', 'runs');
    assert.ok(raw.every((e) => e.inputs?.api_key !== secret), 'runs.jsonl itself never carries the raw secret');

    const evidence = mineRuns(home, { module: 'actions' });
    assert.ok(!JSON.stringify(evidence).includes(secret), 'mined evidence never surfaces the raw secret');

    const r = observeRuns(home, { module: 'actions' });
    assert.ok(!JSON.stringify(r.staged).includes(secret), 'a staged proposal never surfaces the raw secret');
    assert.ok(!JSON.stringify(r.candidates).includes(secret), 'a dry-run candidate never surfaces the raw secret either');
  });
});

// The CLI verb (`zz observe-runs`) is a thin door over `observeRuns` above — its own
// argv/JSON-emit plumbing is covered separately in tests/unit/cli-observe-runs.test.mjs.
