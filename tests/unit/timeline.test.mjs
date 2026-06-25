// Tier 2.8 — generation maturity: time-travel (as-of) + the evolution timeline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { mint, notesAsOf } from '../../src/notes/generation.mjs';
import { timeline } from '../../src/serve/timeline.mjs';
import { ensureModuleManifest } from '../../src/notes/module-templates.mjs';

function withRepo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-time-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  return fn(join(root, '.zuzuu'), () => rmSync(root, { recursive: true, force: true }));
}
const put = (home, module, id, note) => {
  mkdirSync(join(home, module, 'items'), { recursive: true });
  writeFileSync(join(home, module, 'items', `${id}.md`), serialize({ id, ...note }));
};

test('as-of: reads a module note set as it was at a past generation', () => {
  withRepo((home, done) => {
    put(home, 'knowledge', 'a', { type: 'knowledge', title: 'A' });
    mint(home, 'knowledge'); // gen 1 = {a}
    put(home, 'knowledge', 'b', { type: 'knowledge', title: 'B' });
    mint(home, 'knowledge'); // gen 2 = {a, b}

    const g1 = notesAsOf(home, 'knowledge', 1);
    assert.equal(g1.ok, true);
    assert.deepEqual(g1.notes.map((n) => n.addr).sort(), ['knowledge:a'], 'gen 1 had only a');
    const g2 = notesAsOf(home, 'knowledge', 2);
    assert.deepEqual(g2.notes.map((n) => n.addr).sort(), ['knowledge:a', 'knowledge:b'], 'gen 2 had both');
    assert.equal(notesAsOf(home, 'knowledge', 9).ok, false, 'a missing generation is a fail-soft error');
    done();
  });
});

test('timeline: cross-module generations, newest first', () => {
  withRepo((home, done) => {
    ensureModuleManifest(home, 'knowledge'); ensureModuleManifest(home, 'actions');
    put(home, 'knowledge', 'a', { type: 'knowledge', title: 'A' });
    mint(home, 'knowledge');
    put(home, 'actions', 'r', { type: 'action', title: 'R', run: 'echo' });
    mint(home, 'actions');
    const rows = timeline(home);
    assert.equal(rows.length, 2, 'one generation per module');
    assert.deepEqual(rows.map((r) => r.module).sort(), ['actions', 'knowledge']);
    assert.ok(rows.every((r) => r.gen === 1 && r.active), 'each is its module’s active generation');
    done();
  });
});
