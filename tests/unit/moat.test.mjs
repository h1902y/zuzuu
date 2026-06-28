// Rung 8 — THE MOAT as an in-process invariant. The trust context (`actor`) is stamped
// at the entry boundary (CLI = operator, host hook = agent) and threaded to `commit`, the
// sole writer, which REFUSES a non-operator. Plus the registry is complete: flow·view·
// validate ride `invoke`; a write-permission capability is denied under an agent; and
// `review` (the human gate) is NEVER a capability — an agent can't approve its own work.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { open } from '../../src/serve/api.mjs';
import { register, invoke, list } from '../../src/serve/dispatch.mjs';
import { registerAll, resetCapabilities } from '../../src/serve/wire.mjs';
import { generations } from '../../src/notes/generation.mjs';

function withHome(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zuzuu-moat-'));
  const home = join(root, '.zuzuu');
  const manifest = (m, caps, extra = {}) => {
    mkdirSync(join(home, m, 'items'), { recursive: true });
    writeFileSync(join(home, m, 'module.md'), serialize({ id: m, type: 'module', title: m, capabilities: caps, ...extra }));
  };
  const note = (m, id, n) => writeFileSync(join(home, m, 'items', `${id}.md`), serialize({ id, ...n }));
  manifest('knowledge', ['query', 'check'], { note_type: 'knowledge' });
  manifest('actions', ['query', 'check', 'act'], { note_type: 'action' });
  note('knowledge', 'big', { type: 'knowledge', title: 'Big', body: 'l1\nl2\nl3' });
  note('actions', 'flow1', { type: 'workflow', title: 'a flow', steps: [{ id: 's1', run: 'true' }] });
  resetCapabilities();
  registerAll();
  try { return fn({ root, home }); } finally { rmSync(root, { recursive: true, force: true }); resetCapabilities(); }
}

test('moat: an operator approve lands + mints; an AGENT approve is REFUSED (no note, no mint)', () => {
  withHome(({ root, home }) => {
    // stage is the agent's sanctioned channel — it writes staged JSON, not a note, so it
    // is NOT gated by the actor check (works for either actor).
    const p = open(root, { actor: 'agent' }).stage('knowledge', {
      op: 'create', target: 'learned', change: { type: 'knowledge', title: 'learned', body: 'x' },
    });
    // …but the agent cannot APPROVE its own proposal in-process: commit refuses it.
    const refused = open(root, { actor: 'agent' }).approve('knowledge', p.id);
    assert.equal(refused.ok, false);
    assert.equal(refused.refused, true, 'the agent approve is refused');
    assert.equal(existsSync(join(home, 'knowledge', 'items', 'learned.md')), false, 'no note written');
    assert.equal(generations(home, 'knowledge').active, null, 'no generation minted');
    // the operator approves the SAME staged change → it lands + mints (unchanged behavior).
    const ok = open(root, { actor: 'operator' }).approve('knowledge', p.id);
    assert.equal(ok.ok, true);
    assert.equal(existsSync(join(home, 'knowledge', 'items', 'learned.md')), true, 'the note landed');
    assert.equal(generations(home, 'knowledge').active, 1, 'one generation minted');
  });
});

test('moat: the default actor (a bare CLI open) is operator — writes land', () => {
  withHome(({ root, home }) => {
    const p = open(root).stage('knowledge', { op: 'create', target: 'd', change: { type: 'knowledge', title: 'D', body: 'y' } });
    assert.equal(open(root).approve('knowledge', p.id).ok, true);
    assert.equal(existsSync(join(home, 'knowledge', 'items', 'd.md')), true);
  });
});

test('moat: flow · view · validate ride the ONE registry (registered set complete, behavior-neutral)', () => {
  withHome(({ root }) => {
    // the registered capability set — every `use/` verb that targets a module
    assert.deepEqual(list(), ['act', 'check', 'flow', 'query', 'validate', 'view']);
    const zz = open(root);
    // view → the windowed-read result, UNWRAPPED (the raw verb result, not a {ok,value} envelope)
    const v = zz.view('knowledge', 'big', { offset: 0, limit: 2 });
    assert.equal(v.ok, true);
    assert.equal(v.total, 3);
    assert.equal(v.shown, 2);
    // flow → runs the workflow note's gated steps
    const f = zz.flow('actions', 'flow1');
    assert.equal(f.ok, true);
    assert.equal(f.steps[0].success, true);
    // validate (project-wide, module '') → the failures list (empty here)
    assert.deepEqual(zz.validate(''), []);
  });
});

test('moat: invoke refuses a WRITE-permission capability under an agent; allows it under an operator', () => {
  withHome(({ home }) => {
    register('wtest', () => 'wrote', { permission: 'write' }); // synthetic — no real verb is `write`
    // expose it on a module so the manifest gate passes — the ACTOR gate is what we test
    mkdirSync(join(home, 'wmod', 'items'), { recursive: true });
    writeFileSync(join(home, 'wmod', 'module.md'), serialize({ id: 'wmod', type: 'module', title: 'wmod', capabilities: ['wtest'] }));
    const denied = invoke(home, 'wmod', 'wtest', { actor: 'agent' });
    assert.equal(denied.ok, false);
    assert.equal(denied.denied, true, 'a write capability is denied under an agent');
    const allowed = invoke(home, 'wmod', 'wtest', { actor: 'operator' });
    assert.equal(allowed.ok, true);
    assert.equal(allowed.value, 'wrote');
  });
});

test('moat: review is NEVER a registered capability — the human gate has no agent-invokable handler', () => {
  withHome(({ home }) => {
    assert.ok(!list().includes('review'), 'review is not registered');
    assert.equal(invoke(home, 'knowledge', 'review').missing, true, 'invoking review through the registry is missing');
  });
});
