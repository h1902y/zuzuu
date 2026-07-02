// §I rung 1 — workflow COMPOSITION: a step may reference another runnable note
// (`note: 'module:id'`) instead of an inline `run:` string. Covers: note-ref
// success (leaf action + nested workflow), both/neither validation, direct +
// transitive cycles, the depth cap, nested compensation ORDER, composed gating
// (actor threading), composed lock refusal, and the runs.jsonl `via` marker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { runWorkflow, workflowStaleAfterMs, MAX_COMPOSITION_DEPTH } from '../../src/use/workflow.mjs';
import { acquireRunLock } from '../../src/use/run-lock.mjs';
import { read } from '../../src/notes/log.mjs';
import { clearCache } from '../../src/guardrails/gate.mjs';

function withHome(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-compose-'));
  const home = join(root, '.zuzuu');
  try { return fn(home, root); } finally { rmSync(root, { recursive: true, force: true }); }
}
const put = (home, module, id, note) => {
  mkdirSync(join(home, module, 'items'), { recursive: true });
  writeFileSync(join(home, module, 'items', `${id}.md`), serialize({ id, ...note }));
};
const writeManifest = (home, module, note) => {
  mkdirSync(join(home, module), { recursive: true });
  writeFileSync(join(home, module, 'module.md'), serialize({ type: 'module', id: module, ...note }));
};

// ── note-ref success: a leaf action note ────────────────────────────────────

test('workflow-compose: a note-ref step invokes an action note via act(), same module', () => {
  withHome((home) => {
    put(home, 'actions', 'leaf', { type: 'action', title: 'leaf', run: 'echo leaf-ran' });
    put(home, 'actions', 'flow', { type: 'workflow', title: 'w', steps: [{ id: 's', note: 'actions:leaf' }] });
    const r = runWorkflow(home, 'actions', 'flow');
    assert.equal(r.ok, true);
    assert.equal(r.steps.length, 1);
    assert.equal(r.steps[0].success, true);
    assert.equal(r.steps[0].note, 'actions:leaf');
  });
});

test('workflow-compose: a note-ref step invokes an action note in a DIFFERENT module', () => {
  withHome((home) => {
    put(home, 'ops', 'cleanup', { type: 'action', title: 'cleanup', run: 'true' });
    put(home, 'actions', 'flow', { type: 'workflow', title: 'w', steps: [{ id: 's', note: 'ops:cleanup' }] });
    const r = runWorkflow(home, 'actions', 'flow');
    assert.equal(r.ok, true, r.error);
    assert.equal(r.steps[0].note, 'ops:cleanup');
    // the leaf's own run got logged under ITS OWN module (ops), not the workflow's
    assert.equal(read(home, 'ops', 'runs').length, 1);
    assert.equal(read(home, 'actions', 'runs').length, 1); // the workflow's own summary event
  });
});

test('workflow-compose: a note-ref step invokes ANOTHER workflow note (recursion)', () => {
  withHome((home) => {
    put(home, 'actions', 'inner', { type: 'workflow', title: 'inner', steps: [{ id: 'a', run: 'true' }] });
    put(home, 'actions', 'outer', { type: 'workflow', title: 'outer', steps: [{ id: 's', note: 'actions:inner' }] });
    const r = runWorkflow(home, 'actions', 'outer');
    assert.equal(r.ok, true, r.error);
    assert.equal(r.steps[0].success, true);
  });
});

test('workflow-compose: inputs — a step\'s own inputs win; absent, the parent\'s pass through', () => {
  withHome((home) => {
    // the leaf echoes its ZZ_MSG env var — proves inputs actually rode the composed call
    put(home, 'actions', 'echoer', { type: 'action', title: 'echoer', run: 'node -e process.stdout.write(process.env.ZZ_MSG||"none")' });
    put(home, 'actions', 'flow', {
      type: 'workflow', title: 'w',
      steps: [
        { id: 'own', note: 'actions:echoer', inputs: { msg: 'own-input' } },
        { id: 'inherited', note: 'actions:echoer' },
      ],
    });
    const r = runWorkflow(home, 'actions', 'flow', { msg: 'parent-input' });
    assert.equal(r.ok, true, r.error);
  });
});

// ── validation: EITHER run OR note, never both/neither ─────────────────────

test('workflow-compose: a step with BOTH run and note is refused', () => {
  withHome((home) => {
    put(home, 'actions', 'flow', { type: 'workflow', title: 'w', steps: [{ id: 's', run: 'true', note: 'actions:leaf' }] });
    const r = runWorkflow(home, 'actions', 'flow');
    assert.equal(r.ok, false);
    assert.match(r.error, /both run and note/);
  });
});

test('workflow-compose: a step with NEITHER run nor note is refused', () => {
  withHome((home) => {
    put(home, 'actions', 'flow', { type: 'workflow', title: 'w', steps: [{ id: 's' }] });
    const r = runWorkflow(home, 'actions', 'flow');
    assert.equal(r.ok, false);
    assert.match(r.error, /needs either run or note/);
  });
});

test('workflow-compose: a malformed note ref (not module:id) is refused', () => {
  withHome((home) => {
    put(home, 'actions', 'flow', { type: 'workflow', title: 'w', steps: [{ id: 's', note: 'no-colon-here' }] });
    const r = runWorkflow(home, 'actions', 'flow');
    assert.equal(r.ok, false);
    assert.match(r.error, /must be 'module:id'/);
  });
});

// ── cycles ───────────────────────────────────────────────────────────────

test('workflow-compose: a DIRECT self-reference is refused as a named cycle', () => {
  withHome((home) => {
    put(home, 'actions', 'a', { type: 'workflow', title: 'a', steps: [{ id: 's', note: 'actions:a' }] });
    const r = runWorkflow(home, 'actions', 'a');
    assert.equal(r.ok, false);
    assert.match(r.error, /workflow cycle: actions:a→actions:a/);
  });
});

test('workflow-compose: a TRANSITIVE cycle (a→b→a) is refused, chain named in order', () => {
  withHome((home) => {
    put(home, 'actions', 'a', { type: 'workflow', title: 'a', steps: [{ id: 's', note: 'actions:b' }] });
    put(home, 'actions', 'b', { type: 'workflow', title: 'b', steps: [{ id: 's', note: 'actions:a' }] });
    const r = runWorkflow(home, 'actions', 'a');
    assert.equal(r.ok, false);
    assert.equal(r.failedStep, 's');
    assert.match(r.error, /workflow cycle: actions:a→actions:b→actions:a/);
  });
});

test('workflow-compose: a longer transitive cycle (a→b→c→a) is refused', () => {
  withHome((home) => {
    put(home, 'actions', 'a', { type: 'workflow', title: 'a', steps: [{ id: 's', note: 'actions:b' }] });
    put(home, 'actions', 'b', { type: 'workflow', title: 'b', steps: [{ id: 's', note: 'actions:c' }] });
    put(home, 'actions', 'c', { type: 'workflow', title: 'c', steps: [{ id: 's', note: 'actions:a' }] });
    const r = runWorkflow(home, 'actions', 'a');
    assert.equal(r.ok, false);
    assert.match(r.error, /workflow cycle: actions:a→actions:b→actions:c→actions:a/);
  });
});

test('workflow-compose: two SEPARATE (non-overlapping) note-refs to the same workflow are NOT a cycle', () => {
  // 'shared' is referenced twice from sibling branches — not an ancestor of itself,
  // so this must succeed (a diamond, not a cycle).
  withHome((home) => {
    put(home, 'actions', 'shared', { type: 'workflow', title: 'shared', steps: [{ id: 'x', run: 'true' }] });
    put(home, 'actions', 'left', { type: 'workflow', title: 'left', steps: [{ id: 's', note: 'actions:shared' }] });
    put(home, 'actions', 'right', { type: 'workflow', title: 'right', steps: [{ id: 's', note: 'actions:shared' }] });
    put(home, 'actions', 'top', {
      type: 'workflow', title: 'top',
      steps: [{ id: 'l', note: 'actions:left' }, { id: 'r', note: 'actions:right' }],
    });
    const r = runWorkflow(home, 'actions', 'top');
    assert.equal(r.ok, true, r.error);
  });
});

// ── depth cap (a long acyclic chain — the visited-set alone can't catch this) ─

test('workflow-compose: a chain well under the depth cap succeeds', () => {
  withHome((home) => {
    const N = 5;
    for (let i = 0; i < N; i++) {
      put(home, 'actions', `w${i}`, { type: 'workflow', title: `w${i}`, steps: [{ id: 's', note: i + 1 < N ? `actions:w${i + 1}` : undefined, run: i + 1 < N ? undefined : 'true' }] });
    }
    const r = runWorkflow(home, 'actions', 'w0');
    assert.equal(r.ok, true, r.error);
  });
});

test('workflow-compose: a chain past MAX_COMPOSITION_DEPTH is refused (backstop, no cycle involved)', () => {
  withHome((home) => {
    const N = MAX_COMPOSITION_DEPTH + 10; // comfortably past the cap
    for (let i = 0; i < N; i++) {
      const isLast = i === N - 1;
      put(home, 'actions', `chain${i}`, {
        type: 'workflow', title: `chain${i}`,
        steps: [isLast ? { id: 's', run: 'true' } : { id: 's', note: `actions:chain${i + 1}` }],
      });
    }
    const r = runWorkflow(home, 'actions', 'chain0');
    assert.equal(r.ok, false);
    assert.match(r.error, /workflow composition too deep \(depth cap 20\)/);
    assert.doesNotMatch(r.error, /cycle/, 'this is a distinct-address chain, not a cycle');
  });
});

// ── nested compensation ORDER: inner saga fully finishes before the outer's ──

test('workflow-compose: a nested workflow that fails runs ITS OWN compensations BEFORE the parent runs its own', () => {
  withHome((home, root) => {
    const logFile = join(root, 'order.log');
    // a tiny zero-dep appender script (absolute path — spawnSync's cwd is repoRoot(),
    // not this tmp root, so paths passed as args must be absolute)
    const scriptPath = join(root, 'append.mjs');
    writeFileSync(scriptPath, "import{appendFileSync}from'node:fs';appendFileSync(process.argv[3],process.argv[2]+'\\n');");

    put(home, 'actions', 'inner', {
      type: 'workflow', title: 'inner',
      steps: [
        { id: 'inner-setup', run: 'true', compensate: `node ${scriptPath} inner-setup-compensated ${logFile}` },
        { id: 'inner-boom', run: 'false', 'depends-on': 'inner-setup' },
      ],
    });
    put(home, 'actions', 'outer', {
      type: 'workflow', title: 'outer',
      steps: [
        { id: 'outer-setup', run: 'true', compensate: `node ${scriptPath} outer-setup-compensated ${logFile}` },
        { id: 'outer-inner', note: 'actions:inner', 'depends-on': 'outer-setup' },
      ],
    });

    const r = runWorkflow(home, 'actions', 'outer');
    assert.equal(r.ok, false);
    assert.equal(r.failedStep, 'outer-inner', 'the nested workflow\'s overall failure IS this step\'s failure');
    assert.equal(r.compensations.length, 1, 'the parent compensated its own one completed step (outer-setup)');

    const lines = readFileSync(logFile, 'utf8').trim().split('\n');
    assert.deepEqual(lines, ['inner-setup-compensated', 'outer-setup-compensated'],
      'the INNER saga (inner-setup) finished before the OUTER saga (outer-setup) even started');
  });
});

test('workflow-compose: the nested step result carries the inner failure through', () => {
  withHome((home) => {
    put(home, 'actions', 'inner', { type: 'workflow', title: 'inner', steps: [{ id: 'a', run: 'false' }] });
    put(home, 'actions', 'outer', { type: 'workflow', title: 'outer', steps: [{ id: 's', note: 'actions:inner' }] });
    const r = runWorkflow(home, 'actions', 'outer');
    assert.equal(r.ok, false);
    assert.equal(r.failedStep, 's');
    assert.match(r.error, /step 'a' failed/);
  });
});

// ── composed gating: SAME actor as the parent, never silently 'operator' ────

test('workflow-compose (actor threading): agent-actor composed run denied by an ask-rule; operator passes', () => {
  withHome((home) => {
    writeManifest(home, 'instructions', { capabilities: ['gate'] });
    put(home, 'instructions', 'confirm', { type: 'rule', action: 'ask', tool: 'Bash', pattern: 'echo', reason: 'confirm first' });
    put(home, 'actions', 'hello', { type: 'action', title: 'hello', run: 'echo hi' });
    put(home, 'actions', 'flow', { type: 'workflow', title: 'w', steps: [{ id: 's', note: 'actions:hello' }] });

    clearCache();
    const opResult = runWorkflow(home, 'actions', 'flow', {}, 'operator');
    assert.equal(opResult.ok, true, 'operator: the ask verdict does not block the composed run');

    const agentResult = runWorkflow(home, 'actions', 'flow', {}, 'agent');
    assert.equal(agentResult.ok, false);
    assert.equal(agentResult.failedStep, 's');
    assert.match(agentResult.error, /ask verdict denied/, 'the composed call carried the agent actor, not a silent operator default');
  });
});

test('workflow-compose (actor threading): the SAME agent denial fires through a nested workflow too', () => {
  withHome((home) => {
    writeManifest(home, 'instructions', { capabilities: ['gate'] });
    put(home, 'instructions', 'confirm', { type: 'rule', action: 'ask', tool: 'Bash', pattern: 'true', reason: 'confirm first' });
    put(home, 'actions', 'inner', { type: 'workflow', title: 'inner', steps: [{ id: 'a', run: 'true' }] });
    put(home, 'actions', 'outer', { type: 'workflow', title: 'outer', steps: [{ id: 's', note: 'actions:inner' }] });

    clearCache();
    const agentResult = runWorkflow(home, 'actions', 'outer', {}, 'agent');
    assert.equal(agentResult.ok, false);
    assert.match(agentResult.error, /ask verdict denied|step 'a' failed/);
  });
});

// ── composed lock refusal: a target already running elsewhere is refused ───

test('workflow-compose: a note-ref to an action note ALREADY running elsewhere is refused (its OWN lock)', () => {
  withHome((home) => {
    put(home, 'actions', 'leaf', { type: 'action', title: 'leaf', run: 'true' });
    put(home, 'actions', 'flow', { type: 'workflow', title: 'w', steps: [{ id: 's', note: 'actions:leaf' }] });

    const held = acquireRunLock(home, 'actions', 'leaf', 60_000); // simulate 'leaf' running standalone
    assert.equal(held.ok, true);

    const r = runWorkflow(home, 'actions', 'flow'); // 'flow' itself acquires its OWN lock fine
    assert.equal(r.ok, false);
    assert.equal(r.failedStep, 's');
    assert.match(r.error, /already running/);

    held.release();
    const r2 = runWorkflow(home, 'actions', 'flow');
    assert.equal(r2.ok, true, 'released — the composed run now proceeds');
  });
});

test('workflow-compose: a note-ref to a WORKFLOW already running elsewhere is refused (its OWN lock)', () => {
  withHome((home) => {
    put(home, 'actions', 'inner', { type: 'workflow', title: 'inner', steps: [{ id: 'a', run: 'true' }] });
    put(home, 'actions', 'outer', { type: 'workflow', title: 'outer', steps: [{ id: 's', note: 'actions:inner' }] });

    const held = acquireRunLock(home, 'actions', 'inner', 60_000);
    assert.equal(held.ok, true);

    const r = runWorkflow(home, 'actions', 'outer');
    assert.equal(r.ok, false);
    assert.match(r.error, /already running/);
    held.release();
  });
});

test('workflow-compose: the PARENT workflow does not re-lock its own transitive steps (a note-ref to itself-adjacent notes is fine)', () => {
  // 'outer' holds its own lock; a step referencing a DIFFERENT note ('leaf') must not
  // collide with 'outer's own lock scope — this is the base success case, asserting
  // no redundant self-lock contention exists.
  withHome((home) => {
    put(home, 'actions', 'leaf', { type: 'action', title: 'leaf', run: 'true' });
    put(home, 'actions', 'outer', { type: 'workflow', title: 'w', steps: [{ id: 's1', note: 'actions:leaf' }, { id: 's2', run: 'true', 'depends-on': 's1' }] });
    const r = runWorkflow(home, 'actions', 'outer');
    assert.equal(r.ok, true, r.error);
  });
});

// ── runs.jsonl attribution: via marks the IMMEDIATE parent ─────────────────

test('workflow-compose: a leaf action\'s runs.jsonl entry carries via=<parent workflow>', () => {
  withHome((home) => {
    put(home, 'ops', 'cleanup', { type: 'action', title: 'cleanup', run: 'true' });
    put(home, 'actions', 'flow', { type: 'workflow', title: 'w', steps: [{ id: 's', note: 'ops:cleanup' }] });
    const r = runWorkflow(home, 'actions', 'flow');
    assert.equal(r.ok, true, r.error);
    const events = read(home, 'ops', 'runs');
    assert.equal(events.length, 1);
    assert.equal(events[0].via, 'actions:flow');
  });
});

test('workflow-compose: a nested workflow\'s own runs.jsonl entry carries via=<immediate parent>, not the root', () => {
  withHome((home) => {
    put(home, 'actions', 'inner', { type: 'workflow', title: 'inner', steps: [{ id: 'a', run: 'true' }] });
    put(home, 'actions', 'outer', { type: 'workflow', title: 'outer', steps: [{ id: 's', note: 'actions:inner' }] });
    const r = runWorkflow(home, 'actions', 'outer');
    assert.equal(r.ok, true, r.error);
    const events = read(home, 'actions', 'runs'); // both outer's and inner's summary events land in the SAME module here
    const innerEvent = events.find((e) => e.note === 'inner');
    const outerEvent = events.find((e) => e.note === 'outer');
    assert.equal(innerEvent.via, 'actions:outer');
    assert.equal(outerEvent.via, undefined, 'the ROOT (non-composed) run carries no via at all');
  });
});

test('workflow-compose: a top-level (non-composed) run never gets a via marker', () => {
  withHome((home) => {
    put(home, 'actions', 'flow', { type: 'workflow', title: 'w', steps: [{ id: 'a', run: 'true' }] });
    runWorkflow(home, 'actions', 'flow');
    const [event] = read(home, 'actions', 'runs');
    assert.equal('via' in event, false);
  });
});

// ── a note-ref target that is neither runnable nor a workflow ──────────────

test('workflow-compose: a note-ref to a non-runnable, non-workflow note fails cleanly (still triggers the saga)', () => {
  withHome((home, root) => {
    const comp = join(root, 'comp-marker');
    put(home, 'knowledge', 'fact', { type: 'knowledge', title: 'a fact' });
    put(home, 'actions', 'flow', {
      type: 'workflow', title: 'w',
      steps: [
        { id: 'setup', run: 'true', compensate: `touch ${comp}` },
        { id: 'bad', note: 'knowledge:fact', 'depends-on': 'setup' },
      ],
    });
    const r = runWorkflow(home, 'actions', 'flow');
    assert.equal(r.ok, false);
    assert.equal(r.failedStep, 'bad');
    assert.match(r.error, /not runnable.*not a workflow/);
    assert.equal(existsSync(comp), true, 'the parent saga still compensated the completed step');
  });
});

test('workflow-compose: a note-ref to a MISSING note fails cleanly (still triggers the saga)', () => {
  withHome((home, root) => {
    const comp = join(root, 'comp-marker-2');
    put(home, 'actions', 'flow', {
      type: 'workflow', title: 'w',
      steps: [
        { id: 'setup', run: 'true', compensate: `touch ${comp}` },
        { id: 'ghost', note: 'actions:does-not-exist', 'depends-on': 'setup' },
      ],
    });
    const r = runWorkflow(home, 'actions', 'flow');
    assert.equal(r.ok, false);
    assert.match(r.error, /targets missing note/);
    assert.equal(existsSync(comp), true);
  });
});
