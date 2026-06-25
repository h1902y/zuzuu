// Brain-sync correctness: the durable brain round-trips across machines via git.
// Generations are git-native — a generation is an approve-commit, and the per-module
// `generations.json` ledger travels in git — so rollback works after a clone with
// ZERO special-cased blob transport (the old `.generations/.store/` is gone; git's
// own objects hold every past note version). Verified against REAL git.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initHome } from '../../src/cli/init.mjs';
import { mint, rollback, generations } from '../../src/notes/generation.mjs';
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

test('brain-sync: generations are git-native — .zuzuu/ is 100% durable, no blob store', () => {
  const cwd = freshRepo();
  initHome(cwd);
  const home = join(cwd, '.zuzuu');
  // grow a knowledge note, then mint a generation → an approve-commit
  mkdirSync(join(home, 'knowledge', 'items'), { recursive: true });
  writeFileSync(join(home, 'knowledge', 'items', 'fact.md'), note('v1'));
  assert.equal(mint(home, 'knowledge').n, 1);

  // worktrees/ is the ONE in-repo machine-local entry — gitignored. Cache + run-state
  // no longer live in .zuzuu/ at all (they moved to XDG dirs).
  mkdirSync(join(home, 'worktrees', 'abc123'), { recursive: true });
  writeFileSync(join(home, 'worktrees', 'abc123', 'scratch.txt'), 'ephemeral');

  git(['add', '-A'], cwd);
  const tracked = git(['ls-files'], cwd).split('\n').filter(Boolean);

  // the durable brain travels — the ledger + the note (git history holds past bytes)
  assert.ok(tracked.includes('.zuzuu/knowledge/generations.json'), 'the generation ledger travels');
  assert.ok(tracked.includes('.zuzuu/knowledge/items/fact.md'), 'the note travels');
  assert.ok(tracked.includes('.zuzuu/guardrails/module.md'), 'the guardrails floor travels');
  // the old parallel content store is GONE — no .generations/.store/ in the tree
  assert.ok(!tracked.some((f) => f.startsWith('.zuzuu/.generations/')), 'no parallel blob store');
  // the one in-repo machine-local entry does NOT travel
  assert.ok(!tracked.some((f) => f.startsWith('.zuzuu/worktrees/')), 'worktrees/ is ignored');
});

test('brain-sync: rollback round-trips after a clone (git holds every version)', () => {
  const cwd = freshRepo();
  initHome(cwd);
  const home = join(cwd, '.zuzuu');
  mkdirSync(join(home, 'knowledge', 'items'), { recursive: true });
  writeFileSync(join(home, 'knowledge', 'items', 'fact.md'), note('v1'));
  mint(home, 'knowledge'); // gen 1 = v1
  writeFileSync(join(home, 'knowledge', 'items', 'fact.md'), note('v2'));
  mint(home, 'knowledge'); // gen 2 = v2

  // clone to a second machine — only git travels, nothing special-cased
  const clone = mkdtempSync(join(tmpdir(), 'zz-clone-'));
  git(['clone', '-q', cwd, clone], tmpdir());
  git(['config', 'user.email', 't@example.com'], clone);
  git(['config', 'user.name', 'test'], clone);
  const cloneHome = join(clone, '.zuzuu');

  // the ledger arrived intact
  assert.deepEqual(generations(cloneHome, 'knowledge').generations.map((g) => g.n), [1, 2]);
  // rollback to gen 1 restores v1 from git history alone (no blob transport)
  const r = rollback(cloneHome, 'knowledge', 1);
  assert.equal(r.ok, true);
  assert.match(readFileSync(join(cloneHome, 'knowledge', 'items', 'fact.md'), 'utf8'), /title: v1/);
});
