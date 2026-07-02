// THE ENVELOPE FLOOR (02-07-2026): title · module · type · status are never null
// on notes that land through the write boundary — filled, never overwritten; a
// verbatim move preserves bytes; `zz module backfill` heals legacy history.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { serialize, parse, titleFromId, fillFloor } from '../../src/notes/note.mjs';
import { validateNote } from '../../src/notes/validate.mjs';
import { createNote } from '../../src/grow/edit.mjs';
import { renameNote } from '../../src/grow/refactor.mjs';
import { backfillFloor, floorWorklist } from '../../src/grow/backfill.mjs';
import { commit } from '../../src/grow/commit.mjs';
import { read as readLog } from '../../src/notes/log.mjs';

function withRepo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zuzuu-floor-'));
  execSync('git init -q && git -c user.email=t@t -c user.name=t commit -q --allow-empty -m init', { cwd: root });
  const home = join(root, '.zuzuu');
  mkdirSync(join(home, 'k', 'items'), { recursive: true });
  writeFileSync(join(home, 'k', 'module.md'), serialize({ type: 'module', id: 'k', title: 'K' }));
  try { return fn(home); } finally { rmSync(root, { recursive: true, force: true }); }
}
const noteAt = (home, m, id) => parse(readFileSync(join(home, m, 'items', `${id}.md`), 'utf8'), { id }).note;

test('titleFromId: slugs humanize, dates stay verbatim', () => {
  assert.equal(titleFromId('twitter-profile-growth'), 'Twitter Profile Growth');
  assert.equal(titleFromId('agent_execution_loop'), 'Agent Execution Loop');
  assert.equal(titleFromId('2026-07-02'), '2026-07-02');
  assert.equal(titleFromId('2026-W27'), '2026-W27');
  assert.equal(titleFromId('2026-Q3'), '2026-Q3');
  assert.equal(titleFromId('2026-07'), '2026-07');
  assert.equal(titleFromId('2026'), '2026');
  assert.equal(titleFromId(''), 'Untitled');
});

test('fillFloor: fills absent, never overwrites present', () => {
  const filled = fillFloor({ type: 'concept', body: 'First line wins\nmore' }, 'my-id');
  assert.equal(filled.status, 'active');
  assert.equal(filled.title, 'First line wins');
  const bodyless = fillFloor({ type: 'concept', body: '' }, 'my-id');
  assert.equal(bodyless.title, 'My Id');
  const explicit = fillFloor({ type: 'concept', title: 'Kept', status: 'seed' }, 'x');
  assert.equal(explicit.title, 'Kept');
  assert.equal(explicit.status, 'seed');
});

test('the write boundary lands the floor on create', () => {
  withRepo((home) => {
    const r = createNote(home, 'k', 'vector-clocks', { type: 'concept', body: 'Lamport ordering, decentralized' });
    assert.equal(r.ok, true, r.error);
    const n = noteAt(home, 'k', 'vector-clocks');
    assert.equal(n.status, 'active');
    assert.equal(n.title, 'Lamport ordering, decentralized');
  });
});

test('validateNote surfaces floor violations (legacy notes on disk)', () => {
  const v = validateNote({ type: 'concept' });
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.includes("'title'")));
  assert.ok(v.errors.some((e) => e.includes("'status'")));
});

test('a move (rename) preserves legacy bytes verbatim — backfill heals, moves do not', () => {
  withRepo((home) => {
    writeFileSync(join(home, 'k', 'items', 'legacy.md'), serialize({ type: 'concept', body: '' })); // below the floor
    const r = renameNote(home, 'k', 'legacy', 'legacy-two');
    assert.equal(r.ok, true, r.error);
    const n = noteAt(home, 'k', 'legacy-two');
    assert.equal(n.title, undefined, 'move never stamps a derived title over unchanged bytes');
  });
});

test('commit refuses an op without a module (module is structural)', () => {
  withRepo((home) => {
    const r = commit(home, {}, [{ op: 'create', target: 'x', change: { type: 'concept' } }]);
    assert.equal(r.ok, false);
    assert.match(r.error, /missing module/);
  });
});

test('backfill: dry-run lists, apply heals through the one door, idempotent', () => {
  withRepo((home) => {
    writeFileSync(join(home, 'k', 'items', 'old-note.md'), serialize({ type: 'concept', body: 'Old wisdom here' }));
    writeFileSync(join(home, 'k', 'items', '2026-01-01.md'), serialize({ type: 'journal-daily', status: 'active', body: '' }));
    writeFileSync(join(home, 'k', 'items', 'fine.md'), serialize({ type: 'concept', title: 'Fine', status: 'seed', body: '' }));

    const dry = backfillFloor(home, { dryRun: true });
    assert.equal(dry.count, 2);
    assert.deepEqual(dry.notes.sort(), ['k:2026-01-01', 'k:old-note']);

    const run = backfillFloor(home);
    assert.equal(run.ok, true, run.error);
    assert.equal(run.count, 2);
    assert.equal(run.generations.length, 1, 'one generation for the module');

    assert.equal(noteAt(home, 'k', 'old-note').title, 'Old wisdom here');
    assert.equal(noteAt(home, 'k', 'old-note').status, 'active');
    assert.equal(noteAt(home, 'k', '2026-01-01').title, '2026-01-01', 'date ids stay dates');
    assert.equal(noteAt(home, 'k', 'fine').status, 'seed', 'compliant notes untouched');

    // provenance: the heal is logged with the backfill marker
    const logged = readLog(home, 'k', 'mutations').filter((e) => e.backfill === 'envelope-floor');
    assert.equal(logged.length, 2);

    // idempotent
    assert.equal(floorWorklist(home).length, 0);
    assert.equal(backfillFloor(home).count, 0);
  });
});
