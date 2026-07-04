// Regression: a `zz stage <m> --op create --field k=v …` with NO `type` used to stage
// fine and only fail at `zz review approve` — `type` is the ONLY required note field
// (notes/validate.mjs), but nothing defaulted it for a create before it reached that
// check, so the note never landed and the proposal sat pending forever (found live,
// 04-07-2026 — 17 real proposals stuck this way). Fix: `withDefaultType` (grow/commit.mjs,
// reused by grow/stage.mjs) defaults a typeless CREATE's projected note to `type: 'note'`
// — at stage time (so the staged record is self-describing before anyone reviews it) AND
// at the commit/approve boundary (so an already-staged record from before this fix, or any
// other path into `commit()`, lands too — not just a freshly staged one). If this file
// fails, the propose→approve→land loop is broken again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initHome } from '../../src/cli/init.mjs';
import { stageChange, listStaged } from '../../src/grow/stage.mjs';
import { approve } from '../../src/grow/review.mjs';
import { withDefaultType } from '../../src/grow/commit.mjs';
import { itemPath, writeJson } from '../../src/notes/store.mjs';

function withHome(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zz-typedefault-'));
  initHome(cwd);
  const home = join(cwd, '.zuzuu');
  try { return fn({ cwd, home }); } finally { rmSync(cwd, { recursive: true, force: true }); }
}

test('THE BUG: a create staged without type lands with type: note end-to-end (stage → approve → on disk)', () => {
  withHome(({ home }) => {
    const p = stageChange(home, 'companies', { op: 'create', target: 'anthropic', change: { title: 'Anthropic', status: 'researching' } });
    assert.ok(p.id, 'staged successfully (the staging half of the bug never failed)');
    // the staged record itself is already self-describing — defaulted at stage time
    assert.equal(p.change.type, 'note', 'the staged proposal carries type:note before anyone reviews it');
    const r = approve(home, 'companies', p.id);
    assert.equal(r.ok, true, `approve must land the note, not fail on missing type (got: ${r.error})`);
    const note = readFileSync(itemPath(home, 'companies', 'anthropic'), 'utf8');
    assert.match(note, /^type: note$/m, 'the landed note carries the defaulted type');
    assert.equal(listStaged(home, 'companies').length, 0, 'consumed — archived off the pending queue');
  });
});

test('an already-staged record from BEFORE this fix (no type baked into the JSON) still lands on approve', () => {
  // simulate the exact stuck-proposal shape: hand-write a staged JSON with a typeless
  // change, bypassing stageChange's own defaulting entirely — this is what the 17 live
  // stuck proposals looked like, and only the commit-time default (in commit.mjs's
  // projectChange) can heal a record that predates this fix.
  withHome(({ home }) => {
    const dir = join(home, 'companies', 'staged');
    mkdirSync(dir, { recursive: true });
    const rec = {
      id: 'stg-legacy1', op: 'create', module: 'companies', target: 'stuck-co',
      change: { title: 'Stuck Co', status: 'researching' }, // no type — pre-fix shape
      rationale: '', evidence: [], confidence: null, score: 0, source: null, status: 'pending',
    };
    writeJson(join(dir, 'stg-legacy1.json'), rec);
    const r = approve(home, 'companies', 'stg-legacy1');
    assert.equal(r.ok, true, `a pre-fix stuck proposal must now land too (got: ${r.error})`);
    const note = readFileSync(itemPath(home, 'companies', 'stuck-co'), 'utf8');
    assert.match(note, /^type: note$/m);
  });
});

test("an explicit type on a create is preserved — the default never overrides a caller's own type", () => {
  withHome(({ home }) => {
    const p = stageChange(home, 'knowledge', { op: 'create', target: 'gpu-scaling', change: { type: 'concept', title: 'GPU scaling', status: 'active' } });
    assert.equal(p.change.type, 'concept', 'the explicit type rides through stage untouched');
    const r = approve(home, 'knowledge', p.id);
    assert.equal(r.ok, true);
    const note = readFileSync(itemPath(home, 'knowledge', 'gpu-scaling'), 'utf8');
    assert.match(note, /^type: concept$/m, 'the richer, agent-supplied type wins over the note default');
  });
});

test("the missing-type protection still holds for a path that genuinely can't get a default: an update whose target does not exist", () => {
  withHome(({ home }) => {
    // update/delete/relate/unrelate/deprecate are untouched by the fix — they edit or
    // reference an EXISTING note, so there's no sane note to default a type onto when
    // the target is missing. This must keep failing exactly as before.
    const p = stageChange(home, 'companies', { op: 'update', target: 'ghost-co', change: { title: 'Ghost Co' } });
    assert.ok(p.id);
    const r = approve(home, 'companies', p.id);
    assert.equal(r.ok, false, 'an update on a nonexistent target with no type must still fail');
    assert.match(r.error, /missing required field: type/);
  });
});

test('withDefaultType: pure unit behavior — only a typeless create is touched', () => {
  assert.deepEqual(withDefaultType('create', {}), { type: 'note' });
  assert.deepEqual(withDefaultType('create', { title: 'x' }), { title: 'x', type: 'note' });
  assert.deepEqual(withDefaultType('create', { type: 'concept', title: 'x' }), { type: 'concept', title: 'x' });
  assert.deepEqual(withDefaultType('create', { type: '  ' }), { type: 'note' }, 'a blank/whitespace-only type counts as missing');
  assert.deepEqual(withDefaultType('update', {}), {}, 'non-create ops are never defaulted');
  assert.deepEqual(withDefaultType('create', undefined), { type: 'note' }, 'a nullish change is treated as empty, not a crash');
});
