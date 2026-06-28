// Regression tests for the adversarial-review findings on the write boundary:
//   • Critical 1 — commit()'s failure-revert must restore ONLY the files the transaction
//     touched, never blanket-`git clean` the items dir (which DELETED untracked siblings —
//     incl. the seeded, not-yet-committed brain rules → silent data loss + loss of the moat).
//   • Critical 4 — a rollback whose batch FAILS must leave module.md UNCHANGED (the manifest
//     rolls back atomically with the rows, not half-applied).
//   • Functional 8 — a pure `move` (rename) carries existing bytes; it must NOT re-validate
//     against a since-stricter schema (a legacy note can still be RENAMED), while a content
//     edit still validates.
//
// Hermetic: isolated tmp git repos only — nothing here touches the real .git/ or .zuzuu/.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commit, rollback } from '../../src/grow/commit.mjs';
import { addColumn, dropColumn } from '../../src/grow/schema.mjs';
import { renameNote } from '../../src/grow/refactor.mjs';
import { patchNote } from '../../src/grow/edit.mjs';
import { generations } from '../../src/notes/generation.mjs';
import { serialize } from '../../src/notes/note.mjs';
import { initHome } from '../../src/cli/init.mjs';

function withRepo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-revert-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: root });
  const home = join(root, '.zuzuu');
  try { return fn(home, root); } finally { rmSync(root, { recursive: true, force: true }); }
}
const itemPath = (home, m, id) => join(home, m, 'items', `${id}.md`);
const manifestPath = (home, m) => join(home, m, 'module.md');
const putModule = (home, m) => { mkdirSync(join(home, m), { recursive: true }); writeFileSync(manifestPath(home, m), serialize({ type: 'module', title: m })); };

// ── Critical 1: the surgical revert preserves untracked siblings ──────────────

test('Critical 1: a mid-batch failure restores only the touched files — an UNTRACKED sibling SURVIVES', () => {
  withRepo((home) => {
    // a seeded-but-uncommitted note (exactly the post-`zz init` state — written, not git-committed)
    mkdirSync(join(home, 'knowledge', 'items'), { recursive: true });
    writeFileSync(itemPath(home, 'knowledge', 'seed'), serialize({ type: 'knowledge', title: 'Seed' }));

    // a batch that writes a NEW note (op-good) then fails validation (op-bad has no run)
    const res = commit(home, { actor: 'operator' }, [
      { module: 'knowledge', op: 'create', target: 'good', change: { type: 'knowledge', title: 'Good' }, id: 'op-good' },
      { module: 'knowledge', op: 'create', target: 'bad', change: { type: 'action' }, id: 'op-bad' },
    ]);
    assert.equal(res.ok, false);
    assert.equal(res.reverted, true);

    // the untracked sibling MUST survive (the bug: `git clean -fdq` nuked it)
    assert.equal(existsSync(itemPath(home, 'knowledge', 'seed')), true, 'the untracked seed note survives the revert');
    assert.equal(readFileSync(itemPath(home, 'knowledge', 'seed'), 'utf8'), serialize({ type: 'knowledge', title: 'Seed' }), 'its bytes are untouched');
    // the transaction's own writes are still rolled back (atomicity preserved)
    assert.equal(existsSync(itemPath(home, 'knowledge', 'good')), false, "the transaction's successful write was reverted");
    assert.equal(existsSync(itemPath(home, 'knowledge', 'bad')), false, 'the failing write never landed');
  });
});

test('Critical 1 (end-to-end): `zz init` then a schema-violating approve — the seeded brain rules SURVIVE', () => {
  withRepo((home, root) => {
    initHome(root);
    // the moat rules are on disk after init (untracked — init never git-commits)
    assert.equal(existsSync(itemPath(home, 'instructions', 'protect-brain-writes')), true, 'seed present pre-approve');
    assert.equal(existsSync(itemPath(home, 'instructions', 'protect-brain-shell')), true);

    // approve a malformed rule (type:rule, no action/pattern) → commit validates → fails → reverts
    const bad = commit(home, { actor: 'operator' }, [
      { module: 'instructions', op: 'create', target: 'evil', change: { type: 'rule', title: 'evil' }, id: 'op-evil' },
    ]);
    assert.equal(bad.ok, false, 'the invalid rule is refused at the write boundary');

    // the enforced write-protection rules are STILL on disk (the bug nuked every untracked seed)
    assert.equal(existsSync(itemPath(home, 'instructions', 'protect-brain-writes')), true, 'protect-brain-writes survives — the moat holds');
    assert.equal(existsSync(itemPath(home, 'instructions', 'protect-brain-shell')), true, 'protect-brain-shell survives');
    assert.equal(existsSync(itemPath(home, 'instructions', 'no-root-wipe')), true, 'every seeded rule survives');
    assert.equal(existsSync(itemPath(home, 'instructions', 'evil')), false, 'the malformed rule never landed');
  });
});

// ── Critical 4: a failed rollback leaves the manifest UNCHANGED ───────────────

test('Critical 4: a rollback whose batch FAILS leaves module.md unchanged (manifest is atomic with the rows)', () => {
  withRepo((home) => {
    putModule(home, 'k');
    // note A with no `sev` — minted into gen 1 (valid: schema has no fields yet)
    commit(home, { actor: 'operator' }, [{ module: 'k', op: 'create', target: 'a', change: { type: 'knowledge', title: 'A' }, id: 'op-a' }]);
    // add a REQUIRED column AFTER A exists → A now violates the schema, but the alter doesn't
    // re-validate rows, so gen 2's commit pins an inconsistent {manifest requires sev} + {A lacks sev}
    assert.equal(addColumn(home, 'k', 'sev', 'text', { required: true }).ok, true);
    const inconsistentGen = generations(home, 'k').active; // gen 2
    // drop the column → gen 3, manifest no longer requires sev (the current, consistent state)
    assert.equal(dropColumn(home, 'k', 'sev').ok, true);
    const manifestBefore = readFileSync(manifestPath(home, 'k'), 'utf8');
    assert.ok(!manifestBefore.includes('sev'), 'the live manifest has no required sev');

    // roll back to the inconsistent generation → restores manifest(requires sev) + A(no sev),
    // then the commit re-validates A against the restored schema → FAILS
    const r = rollback(home, 'k', inconsistentGen);
    assert.equal(r.ok, false, 'the rollback fails because the restored note violates the restored schema');

    // the manifest must be UNCHANGED (the bug left the gen-2 schema on disk over the un-rolled rows)
    assert.equal(readFileSync(manifestPath(home, 'k'), 'utf8'), manifestBefore, 'module.md is restored to its pre-rollback bytes');
  });
});

// ── Functional 8: a legacy note can be RENAMED, but a content edit still validates ──

test('Functional 8: a note that violates the current schema can still be RENAMED (move skips validation)', () => {
  withRepo((home) => {
    putModule(home, 'k');
    commit(home, { actor: 'operator' }, [{ module: 'k', op: 'create', target: 'old', change: { type: 'knowledge', title: 'Old' }, id: 'op-old' }]);
    // make the schema stricter than the existing note (now `sev` is required, `old` lacks it)
    assert.equal(addColumn(home, 'k', 'sev', 'text', { required: true }).ok, true);

    // a pure move (rename) carries the bytes as-is — it must NOT re-validate against the new schema
    const r = renameNote(home, 'k', 'old', 'fresh');
    assert.equal(r.ok, true, 'the legacy note can still be renamed');
    assert.equal(existsSync(itemPath(home, 'k', 'fresh')), true, 'renamed file present');
    assert.equal(existsSync(itemPath(home, 'k', 'old')), false, 'old file gone');
    assert.ok(!readFileSync(itemPath(home, 'k', 'fresh'), 'utf8').includes('sev'), 'the bytes rode across unchanged (still no sev)');

    // but a CONTENT edit on the same note still validates → refused (the schema gate is intact)
    const edit = patchNote(home, 'k', 'fresh', 'title', 'Renamed');
    assert.equal(edit.ok, false, 'a content edit re-validates and is refused while sev is missing');
    assert.match(edit.error, /sev/, 'the schema violation is reported');
  });
});
