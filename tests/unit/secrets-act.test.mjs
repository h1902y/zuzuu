// §J.3 — the placeholder-injection wiring in use/act.mjs: a tool's `secrets: [name]`
// list resolves into the CHILD's env, gated by scope+actor, and NEVER lands in
// runs.jsonl or the run's own inputs/return value. Adversarial-review focus: prove
// the DENY paths refuse the whole run (fail-closed), not a partial/degraded one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { readManifest } from '../../src/notes/module.mjs';
import { act } from '../../src/use/act.mjs';
import { read } from '../../src/notes/log.mjs';
import { SECRETS_MODULE } from '../../src/use/secrets.mjs';

function withHome(setup, fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-secrets-act-'));
  const home = join(root, '.zuzuu');
  setup(home);
  const saved = { ...process.env };
  try { return fn(home); } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    rmSync(root, { recursive: true, force: true });
  }
}
const writeZu = (home, module, id, note) => {
  mkdirSync(join(home, module, 'items'), { recursive: true });
  writeFileSync(join(home, module, 'items', `${id}.md`), serialize({ id, ...note }));
};
const writeManifest = (home, module, note) => {
  mkdirSync(join(home, module), { recursive: true });
  writeFileSync(join(home, module, 'module.md'), serialize({ type: 'module', id: module, ...note }));
};
const writeDecl = (home, id, note) => writeZu(home, SECRETS_MODULE, id, { type: 'secret', ...note });

test('act: a shell tool with secrets: [name] gets the REAL value injected into ZZ_<NAME> — never via inputs', () => {
  withHome((home) => {
    writeManifest(home, 'actions', { note_type: 'action' });
    writeDecl(home, 'clearbit', { name: 'CLEARBIT_KEY', scope: ['module:actions'], actor: 'agent-allowed' });
    writeZu(home, 'actions', 'enrich', { type: 'action', title: 'enrich', run: 'printenv ZZ_CLEARBIT_KEY', secrets: ['CLEARBIT_KEY'] });
  }, (home) => {
    process.env.CLEARBIT_KEY = 'sk-real-clearbit-value';
    const ctx = { home, module: 'actions', manifest: readManifest(home, 'actions'), actor: 'agent' };
    const r = act(ctx, 'enrich', { unrelated: 'x' });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.match(r.stdout, /sk-real-clearbit-value/, 'the child got the real secret value');
    assert.deepEqual(r.secretsResolved, ['CLEARBIT_KEY'], 'the return value carries the NAME, never the value');
    // the return value as a whole never carries the secret value outside stdout
    const { stdout, ...rest } = r;
    assert.doesNotMatch(JSON.stringify(rest), /sk-real-clearbit-value/, 'no field OTHER than the child\'s own stdout carries the value');
    delete process.env.CLEARBIT_KEY;
  });
});

test("act: the resolved secret's value NEVER lands in runs.jsonl's inputs, even under an innocuous key", () => {
  withHome((home) => {
    writeManifest(home, 'actions', { note_type: 'action' });
    writeDecl(home, 'stripe', { name: 'STRIPE_KEY', scope: ['module:actions'], actor: 'agent-allowed' });
    writeZu(home, 'actions', 'charge', { type: 'action', title: 'charge', run: 'printenv ZZ_STRIPE_KEY', secrets: ['STRIPE_KEY'] });
  }, (home) => {
    process.env.STRIPE_KEY = 'sk-live-do-not-log-me';
    const ctx = { home, module: 'actions', manifest: readManifest(home, 'actions'), actor: 'agent' };
    // an innocuous input HAPPENS to carry the same string — must still be caught
    const r = act(ctx, 'charge', { note: 'sk-live-do-not-log-me' });
    assert.equal(r.ok, true);
    const logged = read(home, 'actions', 'runs')[0];
    assert.notEqual(logged.inputs.note, 'sk-live-do-not-log-me', 'the value never survives into runs.jsonl');
    assert.doesNotMatch(JSON.stringify(logged), /sk-live-do-not-log-me/, 'the whole logged event is clean');
    delete process.env.STRIPE_KEY;
  });
});

test('act: an operator-only secret REFUSES the entire run under an agent actor — fail-closed, nothing runs, nothing logs', () => {
  withHome((home) => {
    writeManifest(home, 'actions', { note_type: 'action' });
    writeDecl(home, 'billing', { name: 'BILLING_KEY', scope: ['module:actions'], actor: 'operator-only' });
    writeZu(home, 'actions', 'refund', { type: 'action', title: 'refund', run: 'echo should-never-run', secrets: ['BILLING_KEY'] });
  }, (home) => {
    process.env.BILLING_KEY = 'sk-live-billing';
    const ctx = { home, module: 'actions', manifest: readManifest(home, 'actions'), actor: 'agent' };
    const r = act(ctx, 'refund');
    assert.equal(r.ok, false);
    assert.equal(r.ran, false, 'the run never started — fail-closed, not a partial run');
    assert.match(r.error, /BILLING_KEY/);
    assert.doesNotMatch(JSON.stringify(r), /sk-live-billing/);
    assert.equal(read(home, 'actions', 'runs').length, 0, 'a refused run logs nothing');
    // the SAME tool, run by an operator, succeeds — proves the block is the actor gate
    const asOperator = act({ ...ctx, actor: 'operator' }, 'refund');
    assert.equal(asOperator.ok, true);
    delete process.env.BILLING_KEY;
  });
});

test('act: a scope-denied secret also refuses the whole run (not just skips the var)', () => {
  withHome((home) => {
    writeManifest(home, 'actions', { note_type: 'action' });
    writeDecl(home, 'other', { name: 'OTHER_MODULE_KEY', scope: ['module:library'], actor: 'agent-allowed' });
    writeZu(home, 'actions', 'leaky', { type: 'action', title: 'leaky', run: 'printenv ZZ_OTHER_MODULE_KEY', secrets: ['OTHER_MODULE_KEY'] });
  }, (home) => {
    process.env.OTHER_MODULE_KEY = 'sk-out-of-scope';
    const ctx = { home, module: 'actions', manifest: readManifest(home, 'actions'), actor: 'operator' };
    const r = act(ctx, 'leaky');
    assert.equal(r.ok, false);
    assert.equal(r.ran, false);
    assert.match(r.error, /scope/);
    assert.equal(read(home, 'actions', 'runs').length, 0);
    delete process.env.OTHER_MODULE_KEY;
  });
});

test('act: an undeclared secret name (no declaration at all) refuses the run with a clear error, never crashes', () => {
  withHome((home) => {
    writeManifest(home, 'actions', { note_type: 'action' });
    writeZu(home, 'actions', 'ghost', { type: 'action', title: 'ghost', run: 'echo hi', secrets: ['NEVER_DECLARED_KEY'] });
  }, (home) => {
    const ctx = { home, module: 'actions', manifest: readManifest(home, 'actions'), actor: 'operator' };
    const r = act(ctx, 'ghost');
    assert.equal(r.ok, false);
    assert.match(r.error, /no secret declared/);
  });
});

test('act: a tool with NO secrets: list is unaffected — no secretsResolved key, unchanged behavior', () => {
  withHome((home) => {
    writeManifest(home, 'actions', { note_type: 'action' });
    writeZu(home, 'actions', 'plain', { type: 'action', title: 'plain', run: 'echo hi' });
  }, (home) => {
    const ctx = { home, module: 'actions', manifest: readManifest(home, 'actions'), actor: 'operator' };
    const r = act(ctx, 'plain');
    assert.equal(r.ok, true);
    assert.equal('secretsResolved' in r, false);
  });
});

test('act: multiple declared secrets — ALL must resolve, or the run refuses (no partial injection)', () => {
  withHome((home) => {
    writeManifest(home, 'actions', { note_type: 'action' });
    writeDecl(home, 'ok-one', { name: 'OK_ONE', scope: ['module:actions'], actor: 'agent-allowed' });
    // OK_TWO is declared with a scope that excludes this caller
    writeDecl(home, 'bad-two', { name: 'BAD_TWO', scope: ['module:somewhere-else'], actor: 'agent-allowed' });
    writeZu(home, 'actions', 'multi', { type: 'action', title: 'multi', run: 'echo should-not-run', secrets: ['OK_ONE', 'BAD_TWO'] });
  }, (home) => {
    process.env.OK_ONE = 'v1'; process.env.BAD_TWO = 'v2';
    const ctx = { home, module: 'actions', manifest: readManifest(home, 'actions'), actor: 'agent' };
    const r = act(ctx, 'multi');
    assert.equal(r.ok, false);
    assert.equal(r.ran, false);
    assert.equal(read(home, 'actions', 'runs').length, 0);
    delete process.env.OK_ONE; delete process.env.BAD_TWO;
  });
});
