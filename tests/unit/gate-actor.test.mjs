// Safety floor (§I rung 3), feature 2 — fail-closed guardrails gate for the
// unattended `agent` actor; the interactive `operator` keeps the original
// fail-open + ask-passes contract.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { readManifest } from '../../src/notes/module.mjs';
import { gate, clearCache } from '../../src/guardrails/gate.mjs';
import { act } from '../../src/use/act.mjs';
import { runWorkflow } from '../../src/use/workflow.mjs';

function withHome(setup, fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-actor-'));
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

// ── gate(): malformed rule ───────────────────────────────────────────────────

const seedMalformed = (home) => {
  writeManifest(home, 'instructions', { capabilities: ['gate'] });
  writeZu(home, 'instructions', 'bad', { type: 'rule', action: 'explode', pattern: 'x', reason: 'r' }); // bad action → skipped
};

test('gate: a malformed rule fails OPEN for operator (unchanged), CLOSED for agent', () => {
  clearCache();
  withHome(seedMalformed, (home) => {
    const call = { tool: 'Bash', input: { command: 'anything' } };
    assert.equal(gate({ home }, call), null, 'operator (default): no verdict, fail-open');
    assert.equal(gate({ home, actor: 'operator' }, call), null, 'operator (explicit): unchanged');
    const v = gate({ home, actor: 'agent' }, call);
    assert.equal(v.action, 'deny', 'agent: a broken rule denies rather than silently dropping protection');
  });
});

// ── gate(): an `ask` verdict ──────────────────────────────────────────────────

const seedAsk = (home) => {
  writeManifest(home, 'instructions', { capabilities: ['gate'] });
  writeZu(home, 'instructions', 'confirm', { type: 'rule', action: 'ask', tool: 'Bash', pattern: 'risky', reason: 'needs a human' });
};

test("gate: an 'ask' verdict passes through for operator (unchanged), denies for agent", () => {
  clearCache();
  withHome(seedAsk, (home) => {
    const call = { tool: 'Bash', input: { command: 'risky-thing' } };
    const opVerdict = gate({ home, actor: 'operator' }, call);
    assert.equal(opVerdict.action, 'ask', 'operator: ask verdict returned as-is — a human can see/decide');
    const agentVerdict = gate({ home, actor: 'agent' }, call);
    assert.equal(agentVerdict.action, 'deny', "agent: nobody present to answer 'ask', so it denies");
  });
});

// ── gate(): an engine error (an unsafe module segment throws inside itemsDir) ──

test('gate: an engine error fails OPEN for operator (unchanged), CLOSED for agent', () => {
  clearCache();
  withHome(() => {}, (home) => {
    const call = { tool: 'Bash', input: { command: 'anything' } };
    // an explicit module with a path-traversal-shaped id trips store.mjs's segment
    // guard (throws), which is exactly the "engine error" case the gate must survive.
    assert.equal(gate({ home, module: '../evil' }, call), null, 'operator: fail-open, unchanged');
    const v = gate({ home, module: '../evil', actor: 'agent' }, call);
    assert.equal(v.action, 'deny', 'agent: an engine error denies rather than silently allowing');
  });
});

// ── act(): the agent actor turns an ask-rule action into an actual deny ────────

test('act: an agent-actor run is denied by an ask-rule that an operator run would pass', () => {
  withHome((home) => {
    writeManifest(home, 'instructions', { capabilities: ['gate'] });
    writeZu(home, 'instructions', 'confirm', { type: 'rule', action: 'ask', tool: 'Bash', pattern: 'echo', reason: 'confirm first' });
    writeManifest(home, 'actions', { note_type: 'action' });
    writeZu(home, 'actions', 'hello', { type: 'action', title: 'say hi', run: 'echo hello-world' });
  }, (home) => {
    clearCache();
    const manifest = readManifest(home, 'actions');
    const opResult = act({ home, module: 'actions', manifest, actor: 'operator' }, 'hello');
    assert.equal(opResult.ok, true, 'operator: the ask verdict does not block runGated');

    const agentResult = act({ home, module: 'actions', manifest, actor: 'agent' }, 'hello');
    assert.equal(agentResult.ok, false);
    assert.equal(agentResult.denied, true);
    assert.match(agentResult.error, /ask verdict denied/);
  });
});

// ── runWorkflow(): the actor threads into every step ────────────────────────

test('workflow: an agent-actor run is denied by an ask-rule; operator unaffected', () => {
  withHome((home) => {
    writeManifest(home, 'instructions', { capabilities: ['gate'] });
    writeZu(home, 'instructions', 'confirm', { type: 'rule', action: 'ask', tool: 'Bash', pattern: 'true', reason: 'confirm first' });
    writeZu(home, 'actions', 'flow', { type: 'workflow', title: 'w', steps: [{ id: 'a', run: 'true' }] });
  }, (home) => {
    clearCache();
    const opResult = runWorkflow(home, 'actions', 'flow', {}, 'operator');
    assert.equal(opResult.ok, true, 'operator: unaffected');

    const agentResult = runWorkflow(home, 'actions', 'flow', {}, 'agent');
    assert.equal(agentResult.ok, false);
    assert.equal(agentResult.failedStep, 'a');
    assert.match(agentResult.error, /ask verdict denied/);
  });
});
