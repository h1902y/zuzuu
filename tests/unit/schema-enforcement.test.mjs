// Rung 6 — the manifest validates its items: typed columns, enforced at the write
// boundary. A module's `module.md` `fields` schema is a TABLE's columns; every row
// (note) must COMPLY. Absent schema ⇒ schemaless (back-compat). The alter-table ops
// (add/alter/drop-column) mutate the schema + mint a generation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize, parse } from '../../src/notes/note.mjs';
import { manifestFor } from '../../src/notes/module-templates.mjs';
import { commit } from '../../src/grow/commit.mjs';
import { readManifest } from '../../src/notes/module.mjs';
import { generations } from '../../src/notes/generation.mjs';
import { open } from '../../src/serve/api.mjs';

function withRepo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-schema-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: root });
  try { return fn(join(root, '.zuzuu'), root); } finally { rmSync(root, { recursive: true, force: true }); }
}
// plant a module.md carrying a typed-column schema (the table's definition).
function schemaModule(home, module, fields, note_type = 'task') {
  mkdirSync(join(home, module, 'items'), { recursive: true });
  writeFileSync(join(home, module, 'module.md'), serialize({ id: module, type: 'module', title: module, note_type, fields }));
}
const itemPath = (home, m, id) => join(home, m, 'items', `${id}.md`);
// the `fields` block the standard template would mint for a module id ([] when schemaless)
const parseFields = (id) => parse(manifestFor(id)).note.fields ?? [];

const TASK_FIELDS = [
  { name: 'title', type: 'text', required: true },
  { name: 'priority', type: 'select', options: ['low', 'high'] },
  { name: 'effort', type: 'number' },
];

test('commit REJECTS a write that violates the schema — missing a required column (no write, reverted)', () => {
  withRepo((home) => {
    schemaModule(home, 'tasks', TASK_FIELDS);
    const r = commit(home, { actor: 'operator' }, [
      { module: 'tasks', op: 'create', target: 't1', change: { type: 'task', priority: 'low' }, id: 'op-1' },
    ]);
    assert.equal(r.ok, false, 'the batch is refused');
    assert.equal(r.reverted, true, 'the transaction reverted');
    assert.match(r.error, /field 'title' is required/);
    assert.equal(existsSync(itemPath(home, 'tasks', 't1')), false, 'nothing landed');
    assert.equal(generations(home, 'tasks').active, null, 'no generation minted');
  });
});

test('commit REJECTS a select value outside the declared options', () => {
  withRepo((home) => {
    schemaModule(home, 'tasks', TASK_FIELDS);
    const r = commit(home, { actor: 'operator' }, [
      { module: 'tasks', op: 'create', target: 't1', change: { type: 'task', title: 'A', priority: 'urgent' }, id: 'op-1' },
    ]);
    assert.equal(r.ok, false);
    assert.match(r.error, /field 'priority' must be one of: low, high/);
    assert.equal(existsSync(itemPath(home, 'tasks', 't1')), false);
  });
});

test('commit REJECTS a value that will not coerce to its column type (number)', () => {
  withRepo((home) => {
    schemaModule(home, 'tasks', TASK_FIELDS);
    const r = commit(home, { actor: 'operator' }, [
      { module: 'tasks', op: 'create', target: 't1', change: { type: 'task', title: 'A', effort: 'lots' }, id: 'op-1' },
    ]);
    assert.equal(r.ok, false);
    assert.match(r.error, /field 'effort' must be a number/);
  });
});

test('a COMPLIANT write to a schema\'d module lands + mints (unknown extra columns are tolerated)', () => {
  withRepo((home) => {
    schemaModule(home, 'tasks', TASK_FIELDS);
    const r = commit(home, { actor: 'operator' }, [
      // `owner` is undeclared — still allowed (schema validates declared columns, doesn't forbid others)
      { module: 'tasks', op: 'create', target: 't1', change: { type: 'task', title: 'A', priority: 'high', effort: 3, owner: 'me' }, id: 'op-1' },
    ]);
    assert.equal(r.ok, true);
    assert.equal(existsSync(itemPath(home, 'tasks', 't1')), true);
    assert.equal(generations(home, 'tasks').active, 1);
  });
});

test('a SCHEMALESS module (no `fields`) still accepts any frontmatter — back-compat', () => {
  withRepo((home) => {
    // no module.md at all → readManifest fallback fields:[] → schemaless
    const r = commit(home, { actor: 'operator' }, [
      { module: 'freeform', op: 'create', target: 'x', change: { type: 'whatever', anything: 'goes', n: 1 }, id: 'op-1' },
    ]);
    assert.equal(r.ok, true, 'schemaless: any frontmatter is fine');
    assert.equal(existsSync(itemPath(home, 'freeform', 'x')), true);
  });
});

test('add-column → a write missing the new required column is rejected; schema reflects; rollback restores', () => {
  withRepo((home, root) => {
    const zz = open(root);
    // start with a one-field schema + one compliant note (gen 1)
    schemaModule(home, 'tasks', [{ name: 'title', type: 'text', required: true }]);
    assert.equal(commit(home, { actor: 'operator' }, [
      { module: 'tasks', op: 'create', target: 't1', change: { type: 'task', title: 'A' }, id: 'seed' },
    ]).ok, true);
    const genBefore = generations(home, 'tasks').active;

    // add a REQUIRED column (gen-advancing manifest mutation)
    const added = zz.addColumn('tasks', 'priority', 'select', { required: true, options: ['low', 'high'] });
    assert.equal(added.ok, true);
    assert.deepEqual(readManifest(home, 'tasks').fields.map((f) => f.name), ['title', 'priority'], 'schema reflects the new column');
    assert.ok(added.generation > genBefore, 'the schema change minted a generation');

    // a write that omits the now-required column is rejected
    const bad = commit(home, { actor: 'operator' }, [
      { module: 'tasks', op: 'create', target: 't2', change: { type: 'task', title: 'B' }, id: 'op-bad' },
    ]);
    assert.equal(bad.ok, false);
    assert.match(bad.error, /field 'priority' is required/);

    // rollback to the pre-column generation restores the prior schema
    const rb = zz.rollback('tasks', genBefore);
    assert.equal(rb.ok, true);
    assert.deepEqual(readManifest(home, 'tasks').fields.map((f) => f.name), ['title'], 'rollback restored the prior schema');

    // and the formerly-rejected write now succeeds (priority no longer required)
    const ok = commit(home, { actor: 'operator' }, [
      { module: 'tasks', op: 'create', target: 't2', change: { type: 'task', title: 'B' }, id: 'op-ok' },
    ]);
    assert.equal(ok.ok, true, 'after the schema rolled back, the write complies');
  });
});

test('alter-column tightens the type; drop-column removes the constraint', () => {
  withRepo((home, root) => {
    const zz = open(root);
    schemaModule(home, 'tasks', [{ name: 'title', type: 'text', required: true }, { name: 'effort', type: 'text' }]);
    // text → number: now a non-numeric value is rejected
    assert.equal(zz.alterColumn('tasks', 'effort', { type: 'number' }).ok, true);
    assert.equal(readManifest(home, 'tasks').fields.find((f) => f.name === 'effort').type, 'number');
    assert.equal(commit(home, { actor: 'operator' }, [
      { module: 'tasks', op: 'create', target: 't1', change: { type: 'task', title: 'A', effort: 'lots' }, id: 'op-1' },
    ]).ok, false, 'a non-number is rejected after the alter');
    // drop it: the constraint is gone
    assert.equal(zz.dropColumn('tasks', 'effort').ok, true);
    assert.equal(readManifest(home, 'tasks').fields.map((f) => f.name).includes('effort'), false);
    assert.equal(commit(home, { actor: 'operator' }, [
      { module: 'tasks', op: 'create', target: 't2', change: { type: 'task', title: 'A', effort: 'lots' }, id: 'op-2' },
    ]).ok, true, 'after drop, anything goes for that column');
  });
});

test('the standard modules ship schemas (manifestFor emits fields for instructions + guardrails)', () => {
  // the templates carry typed columns; knowledge/actions/memory stay schemaless
  assert.ok(parseFields('instructions').some((f) => f.name === 'action' && f.type === 'select'));
  assert.ok(parseFields('guardrails').some((f) => f.name === 'action' && f.required));
  assert.deepEqual(parseFields('knowledge'), [], 'knowledge ships schemaless');
});
