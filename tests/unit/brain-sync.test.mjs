// Brain-sync correctness: the durable brain must round-trip across machines via git.
// The load-bearing fact: `rollback` restores note bytes from the content-addressed
// blobs under `.zuzuu/.generations/.store/`, so those blobs MUST travel in git —
// if they're ignored, rollback breaks after a clone/sync. The ephemeral/derived
// files (.live/, .worktrees/, .index.db) must NOT travel. Verified against REAL git
// (its own ignore semantics), not a re-implemented matcher.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initHome } from '../../src/cli/init.mjs';
import { mint, rollback } from '../../src/notes/generation.mjs';
import { serialize } from '../../src/notes/note.mjs';

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8' });
const note = (title) => serialize({ id: 'fact', type: 'knowledge', title, body: title });

function freshRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'zz-sync-'));
  git(['init', '-q'], dir);
  git(['config', 'user.email', 't@example.com'], dir);
  git(['config', 'user.name', 'test'], dir);
  return dir;
}

test('brain-sync: the generation store travels in git; ephemerals do not', () => {
  const cwd = freshRepo();
  initHome(cwd);
  const home = join(cwd, '.zuzuu');
  // grow a knowledge note, then mint a generation → writes .store/ content blobs
  mkdirSync(join(home, 'knowledge', 'items'), { recursive: true });
  writeFileSync(join(home, 'knowledge', 'items', 'fact.md'), note('v1'));
  assert.equal(mint(home, 'knowledge').n, 1);
  // worktrees/ is the ONE in-repo machine-local entry (live session checkouts) — ignored.
  // The cache + run-state no longer live in .zuzuu/ at all (they moved to XDG dirs).
  mkdirSync(join(home, 'worktrees', 'abc123'), { recursive: true });
  writeFileSync(join(home, 'worktrees', 'abc123', 'scratch.txt'), 'ephemeral');

  git(['add', '-A'], cwd);
  const tracked = git(['ls-files'], cwd).split('\n').filter(Boolean);

  // durable brain travels — lineage + the content blobs rollback restores from
  assert.ok(tracked.some((f) => f.startsWith('.zuzuu/.generations/knowledge/')), 'generation lineage tracked');
  assert.ok(tracked.some((f) => f.startsWith('.zuzuu/.generations/.store/')), 'content-store blobs tracked');
  assert.ok(tracked.includes('.zuzuu/knowledge/items/fact.md'), 'the note travels');
  assert.ok(tracked.includes('.zuzuu/guardrails/module.md'), 'the guardrails floor travels');

  // the in-repo machine-local entry does NOT travel
  assert.ok(!tracked.some((f) => f.startsWith('.zuzuu/worktrees/')), 'worktrees/ is ignored');
});

test('brain-sync: rollback works after a fresh clone (the store traveled)', () => {
  const cwd = freshRepo();
  initHome(cwd);
  const home = join(cwd, '.zuzuu');
  mkdirSync(join(home, 'knowledge', 'items'), { recursive: true });
  writeFileSync(join(home, 'knowledge', 'items', 'fact.md'), note('v1'));
  mint(home, 'knowledge'); // gen 1 = v1
  writeFileSync(join(home, 'knowledge', 'items', 'fact.md'), note('v2'));
  mint(home, 'knowledge'); // gen 2 = v2
  git(['add', '-A'], cwd);
  git(['commit', '-qm', 'brain'], cwd);

  // fresh clone — only committed (tracked) files travel
  const clone = mkdtempSync(join(tmpdir(), 'zz-clone-'));
  git(['clone', '-q', cwd, clone], tmpdir());

  // in the clone, roll knowledge back to gen 1 → must restore v1 from the traveled store
  const r = rollback(join(clone, '.zuzuu'), 'knowledge', 1);
  assert.equal(r.ok, true);
  assert.match(readFileSync(join(clone, '.zuzuu', 'knowledge', 'items', 'fact.md'), 'utf8'), /title: v1/);
});
