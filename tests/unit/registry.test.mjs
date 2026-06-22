// serve/dispatch.mjs (the capability registry) + notes/module.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { readManifest, capabilitiesOf, listModules, moduleHas } from '../../src/notes/module.mjs';
import { register, list, clear, invoke } from '../../src/serve/dispatch.mjs';

function withHome(manifests, fn) {
  const root = mkdtempSync(join(tmpdir(), 'zuzuu-cap-'));
  const home = join(root, '.zuzuu');
  for (const [module, note] of Object.entries(manifests)) {
    mkdirSync(join(home, module, 'items'), { recursive: true });
    writeFileSync(join(home, module, 'module.md'), serialize({ type: 'module', id: module, ...note }));
  }
  try { return fn(home); } finally { rmSync(root, { recursive: true, force: true }); }
}

// ── module manifest ─────────────────────────────────────────────────────────

test('readManifest: parses module.md (the same envelope as a note)', () => {
  withHome({ actions: { title: 'Actions', note_type: 'action', enhance: { goal: 'capture procedures' }, policy: { tier: 'contained' } } }, (home) => {
    const m = readManifest(home, 'actions');
    assert.equal(m.id, 'actions');
    assert.equal(m.note_type, 'action');
    assert.equal(m.enhance.goal, 'capture procedures');
    assert.equal(m.policy.tier, 'contained');
  });
});

test('readManifest: missing manifest → minimal fallback, never throws', () => {
  withHome({}, (home) => {
    const m = readManifest(home, 'ghost');
    assert.equal(m.id, 'ghost');
    assert.deepEqual(m.capabilities, ['query', 'check']);
  });
});

test('capabilitiesOf: explicit list wins; else derived from nature', () => {
  assert.deepEqual(capabilitiesOf({ capabilities: ['act'] }).sort(), ['act', 'check', 'query']);
  // derived: a policy → act
  assert.ok(capabilitiesOf({ policy: { run: { allow: ['echo'] } } }).includes('act'));
  assert.deepEqual(capabilitiesOf({}).sort(), ['check', 'query']);
});

test('listModules: only dirs with a module.md', () => {
  withHome({ knowledge: { title: 'K' }, actions: { title: 'A', policy: { tier: 'contained' } } }, (home) => {
    const mods = listModules(home).map((m) => m.id).sort();
    assert.deepEqual(mods, ['actions', 'knowledge']);
  });
});

test('moduleHas: capability membership', () => {
  withHome({ actions: { policy: { tier: 'contained' } } }, (home) => {
    assert.equal(moduleHas(home, 'actions', 'act'), true);
    assert.equal(moduleHas(home, 'actions', 'query'), true);
    assert.equal(moduleHas(home, 'actions', 'gate'), false);
  });
});

// ── capability registry ─────────────────────────────────────────────────────

test('register / list', () => {
  clear();
  register('query', () => 'q');
  register('act', () => 'a', { permission: 'run' });
  assert.deepEqual(list(), ['act', 'query']);
  clear();
});

test('invoke: dispatches with module context, one declaration + one dispatch', () => {
  clear();
  register('query', (ctx) => `queried ${ctx.module} (${ctx.manifest.note_type})`);
  withHome({ knowledge: { note_type: 'knowledge' } }, (home) => {
    const r = invoke(home, 'knowledge', 'query');
    assert.equal(r.ok, true);
    assert.equal(r.value, 'queried knowledge (knowledge)');
  });
  clear();
});

test('invoke: fail-soft — missing capability, not-exposed, broken handler', () => {
  clear();
  register('gate', () => { throw new Error('boom'); });
  withHome({ knowledge: { note_type: 'knowledge' } }, (home) => {
    assert.equal(invoke(home, 'knowledge', 'enhance').missing, true);   // not registered
    assert.equal(invoke(home, 'knowledge', 'gate').denied, true);       // not exposed by the module
    // expose gate, then the handler throws → caught
    register('gate2', () => { throw new Error('boom'); });
  });
  withHome({ guard: { capabilities: ['gate2'] } }, (home) => {
    const r = invoke(home, 'guard', 'gate2');
    assert.equal(r.ok, false);
    assert.equal(r.error, 'boom');
  });
  clear();
});
