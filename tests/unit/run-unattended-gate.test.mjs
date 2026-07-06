// tests/unit/run-unattended-gate.test.mjs — KTD2 (docs/plans/2026-07-06-001-feat-
// wake-source-tick-plan.md), the wake-source rung's SECURITY-CRITICAL decoupling:
// write-authorization (`actor`, operator-only — `commit`/`startRun`/`advanceRun`
// refuse any non-operator caller) is now SEPARATE from gate-posture (fail-open for an
// interactive operator vs. fail-closed for nobody-present). A run stamped unattended
// at `startRun` (`{unattended:true}` → `gate_actor:'agent'` on the note) still WRITES
// through the operator door, but its STEPS now gate fail-closed.
//
// STRUCTURE — characterization-first (the plan's own execution note): Part 1 PINS
// TODAY'S attended-run behavior (fail-open, unchanged) — written and confirmed green
// BEFORE the gate.mjs/run.mjs decoupling landed, and it must STILL be green after,
// proving the decoupling left manual/attended runs byte-for-byte alone. Part 2 proves
// the NEW unattended fail-closed behavior. Part 3 proves the write door itself is
// untouched by any of this. Part 4 proves the decoupling MECHANISM directly at
// gate()'s own level (actor and gateActor disagreeing) — the single most direct test
// of KTD2. Part 5 proves needsHost still structurally blocks any agent spawn.
//
// Companion suites that MUST stay green (the invariant templates this file follows,
// per the plan): tests/unit/gate-actor.test.mjs (actor-only posture, untouched — every
// assertion there still passes because `ctx.gateActor` defaults to undefined and falls
// back to `ctx.actor` exactly as before) and tests/unit/rung0-write-boundary
// .characterization.test.mjs (the write-door/session-git/gate-rule goldens, unrelated
// to this axis and untouched by this change).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { createNote } from '../../src/grow/edit.mjs';
import { readNote } from '../../src/notes/repo.mjs';
import { gate, clearCache } from '../../src/guardrails/gate.mjs';
import { startRun, advanceRun, advanceAll, RUNS_MODULE } from '../../src/grow/run.mjs';

// A durable run's generation pin is git-backed (noteAsOf reads via `git show`), so
// every test needs a REAL repo — mirrors tests/unit/run.test.mjs's `withRepo`.
function withRepo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-run-unattended-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: root });
  const home = join(root, '.zuzuu');
  try { return fn(home, root); } finally { rmSync(root, { recursive: true, force: true }); }
}

// Workflow notes MUST land through the real write door (mirrors run.test.mjs).
function putWorkflow(home, module, id, steps, extra = {}) {
  const r = createNote(home, module, id, { type: 'workflow', title: id, steps, ...extra });
  assert.equal(r.ok, true, `fixture workflow '${id}' committed: ${r.error}`);
  return r;
}

// Rule notes are read RAW by the gate (loadRulesDetailed reads the items dir directly,
// no generation/commit involved) — mirrors gate-actor.test.mjs's own `writeZu`/
// `writeManifest` helpers exactly.
const writeRule = (home, module, id, note) => {
  mkdirSync(join(home, module, 'items'), { recursive: true });
  writeFileSync(join(home, module, 'items', `${id}.md`), serialize({ id, ...note }));
};
const writeManifest = (home, module, note) => {
  mkdirSync(join(home, module), { recursive: true });
  writeFileSync(join(home, module, 'module.md'), serialize({ type: 'module', id: module, ...note }));
};
const seedAskRule = (home) => {
  writeManifest(home, 'instructions', { capabilities: ['gate'] });
  writeRule(home, 'instructions', 'confirm', { type: 'rule', action: 'ask', tool: 'Bash', pattern: 'risky', reason: 'needs a human' });
};
const seedMalformedRule = (home) => {
  writeManifest(home, 'instructions', { capabilities: ['gate'] });
  writeRule(home, 'instructions', 'bad', { type: 'rule', action: 'explode', pattern: 'x', reason: 'r' }); // bad action → compile() returns null
};

// ════════════════════════════════════════════════════════════════════════════
// PART 1 — CHARACTERIZATION: today's ATTENDED-run behavior (fail-open), PINNED
// before the decoupling and asserted to still hold after it.
// ════════════════════════════════════════════════════════════════════════════

test('characterization: an ATTENDED (unmarked) run — an `ask` verdict PASSES, the step succeeds (fail-open, unchanged)', () => {
  clearCache();
  withRepo((home) => {
    seedAskRule(home);
    putWorkflow(home, 'actions', 'flow', [{ id: 'a', run: 'echo risky-thing' }]);
    const { runId, run } = startRun(home, 'actions', 'flow'); // no opts → attended
    assert.equal(run.gate_actor, null, 'an attended run carries NO gate_actor marker');
    const r = advanceRun(home, runId);
    assert.deepEqual([r.ok, r.status, r.step], [true, 'done', 'a'], 'the ask verdict did not block an operator-actor run');
  });
});

test('characterization: an ATTENDED (unmarked) run — a MALFORMED rule is silently skipped (fail-open, unchanged)', () => {
  clearCache();
  withRepo((home) => {
    seedMalformedRule(home);
    putWorkflow(home, 'actions', 'flow', [{ id: 'a', run: 'true' }]);
    const { runId } = startRun(home, 'actions', 'flow');
    const r = advanceRun(home, runId);
    assert.deepEqual([r.ok, r.status, r.step], [true, 'done', 'a'], 'the malformed rule was skipped, not a denial');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PART 2 — NEW: an UNATTENDED (stamped) run gates fail-CLOSED on every uncertainty.
// ════════════════════════════════════════════════════════════════════════════

test('unattended run: an `ask` verdict DENIES the step (fail-closed) — the run fails', () => {
  clearCache();
  withRepo((home) => {
    seedAskRule(home);
    putWorkflow(home, 'actions', 'flow', [{ id: 'a', run: 'echo risky-thing' }]);
    const { runId, run } = startRun(home, 'actions', 'flow', {}, 'operator', { unattended: true });
    assert.equal(run.gate_actor, 'agent', 'the unattended stamp lands on the note');
    const r = advanceRun(home, runId);
    assert.equal(r.ok, false);
    assert.equal(r.status, 'failed');
    assert.equal(r.failedStep, 'a');
    assert.match(r.error, /ask verdict denied.*unattended agent actor/);
  });
});

test('unattended run: a MALFORMED rule DENIES the step (fail-closed) — the run fails', () => {
  clearCache();
  withRepo((home) => {
    seedMalformedRule(home);
    putWorkflow(home, 'actions', 'flow', [{ id: 'a', run: 'true' }]);
    const { runId } = startRun(home, 'actions', 'flow', {}, 'operator', { unattended: true });
    const r = advanceRun(home, runId);
    assert.equal(r.ok, false);
    assert.equal(r.status, 'failed');
    assert.match(r.error, /guardrail rule failed to compile.*unattended agent actor/);
  });
});

test('unattended run: a note-ref step to a LEAF ACTION is gated the same fail-closed way (composition carries the posture)', () => {
  clearCache();
  withRepo((home) => {
    seedAskRule(home);
    createNote(home, 'actions', 'leaf', { type: 'action', run: 'echo risky-thing' });
    putWorkflow(home, 'actions', 'flow', [{ id: 'call', note: 'actions:leaf' }]);
    const { runId } = startRun(home, 'actions', 'flow', {}, 'operator', { unattended: true });
    const r = advanceRun(home, runId);
    assert.equal(r.status, 'failed');
    assert.match(r.error, /ask verdict denied/);
  });
});

test('unattended run: a note-ref step to a NESTED WORKFLOW keeps the fail-closed posture through composition', () => {
  clearCache();
  withRepo((home) => {
    seedAskRule(home);
    createNote(home, 'actions', 'inner', { type: 'workflow', title: 'inner', steps: [{ id: 'x', run: 'echo risky-thing' }] });
    putWorkflow(home, 'actions', 'outer', [{ id: 'call', note: 'actions:inner' }]);
    const { runId } = startRun(home, 'actions', 'outer', {}, 'operator', { unattended: true });
    const r = advanceRun(home, runId);
    assert.equal(r.status, 'failed', 'the NESTED Tier-0 workflow also denied the ask-rule step — the posture rode through runWorkflow, not just a bare leaf step');
  });
});

test('unattended run: a compensate command is ALSO gated fail-closed (rollback is unattended too)', () => {
  clearCache();
  withRepo((home) => {
    seedAskRule(home);
    putWorkflow(home, 'actions', 'flow', [
      { id: 'a', run: 'true', compensate: 'echo risky-thing' },
      { id: 'b', run: 'false', 'depends-on': 'a' }, // fails → triggers the saga over 'a'
    ]);
    const { runId } = startRun(home, 'actions', 'flow', {}, 'operator', { unattended: true });
    const r = advanceAll(home, runId);
    assert.equal(r.status, 'failed');
    assert.equal(r.failedStep, 'b');
    assert.deepEqual(r.compensations, [{ id: 'a', success: false }], 'the compensate command itself was denied (fail-closed), so its own success is false');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PART 3 — THE WRITE DOOR IS UNTOUCHED: an unattended run's note WRITE still lands
// through the operator door; a non-operator actor is STILL refused, regardless of the
// note's gate_actor marker.
// ════════════════════════════════════════════════════════════════════════════

test('write door: an unattended run\'s note WRITE still succeeds through the operator door (the deny above is a STEP outcome, not a refused write)', () => {
  clearCache();
  withRepo((home) => {
    seedAskRule(home);
    putWorkflow(home, 'actions', 'flow', [{ id: 'a', run: 'echo risky-thing' }]);
    const { runId } = startRun(home, 'actions', 'flow', {}, 'operator', { unattended: true });
    const before = readNote(home, RUNS_MODULE, runId);
    assert.equal(before.status, 'running');
    const r = advanceRun(home, runId); // default actor: 'operator' — the write succeeds
    assert.equal(r.ok, false, 'the STEP was denied');
    assert.equal(r.refused, undefined, 'this is NOT a write refusal — writeRun/evolve/commit succeeded');
    const after = readNote(home, RUNS_MODULE, runId);
    assert.equal(after.status, 'failed', 'the note WAS updated — the write door worked');
    assert.equal(after.steps[0].status, 'failed');
    assert.notEqual(after.updated_at, before.updated_at ?? null, 'a real write landed');
  });
});

test('write door: `startRun` with unattended:true is STILL refused for a non-operator actor (the write authorization check runs BEFORE the marker is even considered)', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [{ id: 'a', run: 'true' }]);
    const r = startRun(home, 'actions', 'flow', {}, 'agent', { unattended: true });
    assert.equal(r.ok, false);
    assert.equal(r.refused, true);
  });
});

test('write door: `advanceRun` on an UNATTENDED run is STILL refused for a non-operator actor (gate_actor never relaxes write authorization)', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow', [{ id: 'a', run: 'true' }]);
    const { runId } = startRun(home, 'actions', 'flow', {}, 'operator', { unattended: true });
    const r = advanceRun(home, runId, 'agent');
    assert.equal(r.ok, false);
    assert.equal(r.refused, true);
    assert.equal(readNote(home, RUNS_MODULE, runId).steps[0].status, 'pending', 'the refused caller never executed or advanced anything');
  });
});

test('startRun: omitting the opts argument entirely is identical to `{unattended:false}` (positional-callers-unaffected contract)', () => {
  withRepo((home) => {
    putWorkflow(home, 'actions', 'flow1', [{ id: 'a', run: 'true' }]);
    const r1 = startRun(home, 'actions', 'flow1'); // 3 required args only, exactly like every pre-existing caller
    assert.equal(r1.run.gate_actor, null);
    putWorkflow(home, 'actions', 'flow2', [{ id: 'a', run: 'true' }]);
    const r2 = startRun(home, 'actions', 'flow2', {}, 'operator'); // 5 positional args (actor, no opts)
    assert.equal(r2.run.gate_actor, null, 'also unaffected');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PART 4 — THE DECOUPLING MECHANISM ITSELF, at gate()'s own level: `ctx.gateActor`
// governs strictness INDEPENDENT of `ctx.actor` — the literal proof of KTD2, and the
// same level tests/unit/gate-actor.test.mjs already tests the actor-only baseline at
// (mirroring its own "engine error" trigger, since neither runGated nor act() ever
// exposes a `module` override that could reach it — this is the right altitude).
// ════════════════════════════════════════════════════════════════════════════

test('gate(): `ctx.gateActor` OVERRIDES `ctx.actor` for the fail-open/fail-closed posture — an operator-actor call still denies when gateActor is agent', () => {
  clearCache();
  withRepo((home) => {
    seedAskRule(home);
    const call = { tool: 'Bash', input: { command: 'risky-thing' } };
    // actor alone (no gateActor) — unchanged baseline, operator fail-open
    assert.equal(gate({ home, actor: 'operator' }, call).action, 'ask', 'baseline: operator + no gateActor ⇒ ask passes through');
    // the decoupling: actor stays 'operator' (as grow/run.mjs's writes always are) but
    // gateActor is 'agent' — the posture MUST derive from gateActor, not actor.
    const decoupled = gate({ home, actor: 'operator', gateActor: 'agent' }, call);
    assert.equal(decoupled.action, 'deny', 'gateActor governs strictness even though actor says operator');
  });
});

test('gate(): a MALFORMED rule — `ctx.gateActor:\'agent\'` denies even under `ctx.actor:\'operator\'`', () => {
  clearCache();
  withRepo((home) => {
    seedMalformedRule(home);
    const call = { tool: 'Bash', input: { command: 'anything' } };
    assert.equal(gate({ home, actor: 'operator' }, call), null, 'baseline unaffected');
    const v = gate({ home, actor: 'operator', gateActor: 'agent' }, call);
    assert.equal(v.action, 'deny');
  });
});

test('gate(): an ENGINE ERROR — `ctx.gateActor:\'agent\'` denies even under `ctx.actor:\'operator\'` (mirrors gate-actor.test.mjs\'s own trigger)', () => {
  clearCache();
  withRepo((home) => {
    const call = { tool: 'Bash', input: { command: 'anything' } };
    // an explicit module with a path-traversal-shaped id trips store.mjs's segment
    // guard (throws) — the SAME "engine error" trigger gate-actor.test.mjs uses.
    assert.equal(gate({ home, module: '../evil', actor: 'operator' }, call), null, 'baseline: operator alone stays fail-open');
    const v = gate({ home, module: '../evil', actor: 'operator', gateActor: 'agent' }, call);
    assert.equal(v.action, 'deny', 'gateActor still denies on an engine error, independent of actor');
  });
});

test('gate(): `ctx.gateActor` absent falls back to `ctx.actor` exactly as before (backward-compatible default)', () => {
  clearCache();
  withRepo((home) => {
    seedAskRule(home);
    const call = { tool: 'Bash', input: { command: 'risky-thing' } };
    assert.equal(gate({ home, actor: 'agent' }, call).action, 'deny', 'agent actor alone, no gateActor ⇒ still fail-closed, unchanged');
    assert.equal(gate({ home, actor: 'operator' }, call).action, 'ask', 'operator actor alone, no gateActor ⇒ still fail-open, unchanged');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PART 5 — needsHost still structurally blocks any agent spawn, inside an unattended
// run — the fail-closed gate change above never touches binding dispatch, which
// short-circuits BEFORE the gate is ever reached.
// ════════════════════════════════════════════════════════════════════════════

test('unattended run: an agent-binding note-ref step returns needsHost and fails the step cleanly — no host agent is spawned', () => {
  clearCache();
  withRepo((home) => {
    createNote(home, 'actions', 'enrich', { type: 'action', title: 'enrich lead', binding: 'agent', prompt: 'use your browser tool to …' });
    putWorkflow(home, 'actions', 'flow', [{ id: 'call', note: 'actions:enrich' }]);
    const { runId } = startRun(home, 'actions', 'flow', {}, 'operator', { unattended: true });
    const r = advanceRun(home, runId);
    assert.equal(r.status, 'failed');
    assert.match(r.error, /host session/, 'the CLI-side needsHost stub, not a spawned agent');
    assert.doesNotMatch(r.error, /not runnable/, 'binding dispatch fired (not a misleading "not runnable")');
    // Structural guarantee (act.mjs): the agent-binding branch returns BEFORE the run
    // lock, the gate, or runGated are ever reached — there is no code path in this CLI
    // process that spawns a host agent session, unattended or not (ACP is daemon-only,
    // see act.mjs's header comment). Nothing further to assert programmatically beyond
    // the clean failure above; this comment records WHY that is sufficient.
  });
});

test('unattended run: an mcp-binding note-ref step returns the clean stub too, unaffected by gate posture', () => {
  clearCache();
  withRepo((home) => {
    createNote(home, 'actions', 'send', { type: 'action', title: 'send email', binding: 'mcp', mcp: { server: 'gmail', tool: 'send' } });
    putWorkflow(home, 'actions', 'flow', [{ id: 'call', note: 'actions:send' }]);
    const { runId } = startRun(home, 'actions', 'flow', {}, 'operator', { unattended: true });
    const r = advanceRun(home, runId);
    assert.equal(r.status, 'failed');
    assert.match(r.error, /mcp binding.*not yet implemented/);
  });
});
