// grow/edit.mjs — the operator lane: direct row create/delete/batch (Phase 1 of
// the personal-app roadmap). Instant CRUD for the human, still through commit()
// (validated + logged + minted); the agent's channel stays stage→review.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { serialize, parse } from '../../src/notes/note.mjs';
import { createNote, deleteNote, createNotes, coerceForField } from '../../src/grow/edit.mjs';
import { readText } from '../../src/metal/fs.mjs';

// a real git repo (commit mints generations = git commits)
function withRepo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zuzuu-oplane-'));
  execSync('git init -q && git -c user.email=t@t -c user.name=t commit -q --allow-empty -m init', { cwd: root });
  const home = join(root, '.zuzuu');
  const dir = join(home, 'crm', 'items');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(home, 'crm', 'module.md'), serialize({
    type: 'module', id: 'crm', title: 'CRM',
    fields: [
      { name: 'tier', type: 'number', default: 3 },
      { name: 'stage', type: 'select', options: ['lead', 'won', 'lost'], default: 'lead', label: 'Deal stage' },
      { name: 'company', type: 'text', required: true },
    ],
  }));
  try { return fn(home, root); } finally { rmSync(root, { recursive: true, force: true }); }
}

const noteAt = (home, m, id) => parse(readText(join(home, m, 'items', `${id}.md`)), { id }).note;

test('createNote: direct create, schema defaults fill absent columns', () => {
  withRepo((home) => {
    const r = createNote(home, 'crm', 'acme', { type: 'account', company: 'Acme Corp' });
    assert.equal(r.ok, true, r.error);
    const n = noteAt(home, 'crm', 'acme');
    assert.equal(n.company, 'Acme Corp');
    assert.equal(n.tier, 3, 'number default fills');
    assert.equal(n.stage, 'lead', 'select default fills');
  });
});

test('createNote: refuses an existing id without --force; --force replaces', () => {
  withRepo((home) => {
    assert.equal(createNote(home, 'crm', 'acme', { type: 'account', company: 'A' }).ok, true);
    const dup = createNote(home, 'crm', 'acme', { type: 'account', company: 'B' });
    assert.equal(dup.ok, false);
    assert.match(dup.error, /already exists/);
    const forced = createNote(home, 'crm', 'acme', { type: 'account', company: 'B' }, { force: true });
    assert.equal(forced.ok, true, forced.error);
    assert.equal(noteAt(home, 'crm', 'acme').company, 'B');
  });
});

test('createNote: schema validation still guards the lane (required column)', () => {
  withRepo((home) => {
    const r = createNote(home, 'crm', 'bad', { type: 'account' }); // company missing
    assert.equal(r.ok, false);
    assert.match(r.error, /company/);
    assert.equal(existsSync(join(home, 'crm', 'items', 'bad.md')), false, 'nothing landed');
  });
});

test('createNote: the agent is refused (the moat holds on the operator lane)', () => {
  withRepo((home) => {
    const r = createNote(home, 'crm', 'sneaky', { type: 'account', company: 'X' }, { actor: 'agent' });
    assert.equal(r.ok, false);
    assert.match(r.error, /operator/);
  });
});

test('deleteNote: direct delete; missing id errors', () => {
  withRepo((home) => {
    createNote(home, 'crm', 'acme', { type: 'account', company: 'A' });
    const r = deleteNote(home, 'crm', 'acme');
    assert.equal(r.ok, true, r.error);
    assert.equal(existsSync(join(home, 'crm', 'items', 'acme.md')), false);
    assert.equal(deleteNote(home, 'crm', 'acme').ok, false);
  });
});

test('createNotes: batch is all-or-nothing, one generation', () => {
  withRepo((home) => {
    const r = createNotes(home, 'crm', [
      { id: 'a1', type: 'account', company: 'A1' },
      { id: 'a2', type: 'account', company: 'A2', tier: 1 },
    ]);
    assert.equal(r.ok, true, r.error);
    assert.deepEqual(r.created.sort(), ['a1', 'a2']);
    assert.equal(r.generations.length, 1, 'one generation for the whole batch');
    assert.equal(noteAt(home, 'crm', 'a2').tier, 1);

    // a batch with one invalid row reverts ENTIRELY
    const bad = createNotes(home, 'crm', [
      { id: 'b1', type: 'account', company: 'B1' },
      { id: 'b2', type: 'account' }, // company missing → invalid
    ]);
    assert.equal(bad.ok, false);
    assert.equal(existsSync(join(home, 'crm', 'items', 'b1.md')), false, 'valid sibling reverted too');
  });
});

test('createNote: `default: now` resolves to TODAY\'S ISO date on a date column; a non-date column keeps it as a plain literal', () => {
  withRepo((home) => {
    mkdirSync(join(home, 'events', 'items'), { recursive: true });
    writeFileSync(join(home, 'events', 'module.md'), serialize({
      type: 'module', id: 'events', title: 'Events',
      fields: [
        { name: 'occurred_on', type: 'date', default: 'now' },
        { name: 'kind', type: 'text', default: 'now' }, // non-date: `now` has no magic
      ],
    }));
    const r = createNote(home, 'events', 'e1', { type: 'event' });
    assert.equal(r.ok, true, r.error);
    const n = noteAt(home, 'events', 'e1');
    const today = new Date().toISOString().slice(0, 10);
    assert.equal(n.occurred_on, today, 'the date column resolves the `now` sentinel to today\'s ISO date');
    assert.equal(n.kind, 'now', 'a non-date column treats `now` as a plain literal string — no magic');
    // the manifest itself never rewrites the symbolic default
    const field = parse(readText(join(home, 'events', 'module.md')), { id: 'events' }).note.fields.find((f) => f.name === 'occurred_on');
    assert.equal(field.default, 'now', 'module.md keeps `now` symbolic, never resolved on disk');
  });
});

test('createNote: an EXPLICIT date value wins over the `now` default', () => {
  withRepo((home) => {
    mkdirSync(join(home, 'events', 'items'), { recursive: true });
    writeFileSync(join(home, 'events', 'module.md'), serialize({
      type: 'module', id: 'events', title: 'Events',
      fields: [{ name: 'occurred_on', type: 'date', default: 'now' }],
    }));
    const r = createNote(home, 'events', 'e2', { type: 'event', occurred_on: '2020-01-01' });
    assert.equal(r.ok, true, r.error);
    assert.equal(noteAt(home, 'events', 'e2').occurred_on, '2020-01-01', 'a present value is never overridden by the default');
  });
});

test('coerceForField: declared types win; title stays a string', () => {
  withRepo((home) => {
    assert.equal(coerceForField(home, 'crm', 'tier', '5'), 5);
    assert.equal(coerceForField(home, 'crm', 'company', '5'), '5', 'text column stays a string');
    assert.equal(coerceForField(home, 'crm', 'title', '5'), '5', 'envelope title stays a string');
    assert.equal(coerceForField(home, 'crm', 'custom', '5'), 5, 'undeclared keeps the JSON heuristic');
  });
});
