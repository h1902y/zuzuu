// tests/unit/session-diff.test.mjs — sessionDiffData / sessionFileDiffData
// ("what changed" for a session). Hermetic tmp repos only; never touches the
// zuzuu repo itself. Mirrors session-git.test.mjs setup.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sessionDiffData, sessionFileDiffData } from '../../zuzuu/commands/sessions.mjs';
import { sessionBranchName } from '../../zuzuu/sessions/session-git.mjs';

function git(args, cwd, input) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', input });
  assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

function tmpRepo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-sdiff-'));
  git(['init', '-q', '-b', 'main'], root);
  git(['config', 'user.email', 'test@zuzuu.dev'], root);
  git(['config', 'user.name', 'zuzuu test'], root);
  git(['config', 'commit.gpgsign', 'false'], root);
  writeFileSync(join(root, 'a.txt'), 'one\n');
  git(['add', '-A'], root);
  git(['commit', '-q', '-m', 'init'], root);
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function seedIndex(root, records) {
  mkdirSync(join(root, '.zuzuu'), { recursive: true });
  writeFileSync(join(root, '.zuzuu', 'sessions.json'), JSON.stringify({ version: 1, sessions: records }, null, 2));
}

test('live session branch: diff = mainBranch...branch (what the session introduced)', () => {
  tmpRepo((root) => {
    const id = 'diffsess1234';
    const branch = sessionBranchName(id); // zz/session-diffsess

    // a session branch that edits a.txt (+1) and adds b.txt (+1), then back to main
    git(['checkout', '-q', '-b', branch], root);
    writeFileSync(join(root, 'a.txt'), 'one\ntwo\n');
    writeFileSync(join(root, 'b.txt'), 'new\n');
    git(['add', '-A'], root);
    git(['commit', '-q', '-m', 'zz: checkpoint 1'], root);
    git(['checkout', '-q', 'main'], root);

    // seed AFTER the branch ops so sessions.json stays untracked on main (a
    // git add -A on the branch would otherwise commit it and the main checkout
    // would remove it)
    seedIndex(root, [{ id, host: 'claude', status: 'active', git: { commit: null, branch } }]);

    const d = sessionDiffData(root, id);
    assert.equal(d.available, true);
    assert.equal(d.totals.files, 2);
    assert.equal(d.totals.additions, 2);
    assert.equal(d.totals.deletions, 0);
    const paths = d.files.map((f) => f.path).sort();
    assert.deepEqual(paths, ['a.txt', 'b.txt']);
    const b = d.files.find((f) => f.path === 'b.txt');
    assert.equal(b.status, 'A'); // added
    assert.equal(b.additions, 1);

    // per-file unified diff carries the new content
    const fd = sessionFileDiffData(root, id, 'b.txt');
    assert.match(fd.diff, /\+new/);
  });
});

test('a session branch with no net changes → available, empty files', () => {
  tmpRepo((root) => {
    const id = 'emptysess99';
    const branch = sessionBranchName(id);
    seedIndex(root, [{ id, host: 'claude', status: 'active', git: { commit: null, branch } }]);
    // branch with a commit that reverts itself → no net change vs main
    git(['checkout', '-q', '-b', branch], root);
    writeFileSync(join(root, 'a.txt'), 'changed\n');
    git(['commit', '-qam', 'zz: checkpoint 1'], root);
    writeFileSync(join(root, 'a.txt'), 'one\n'); // revert
    git(['commit', '-qam', 'zz: checkpoint 2'], root);
    git(['checkout', '-q', 'main'], root);

    const d = sessionDiffData(root, id);
    assert.equal(d.available, true);
    assert.equal(d.totals.files, 0);
    assert.deepEqual(d.files, []);
  });
});

test('merged/past session (no branch): best-effort diff from recorded commit', () => {
  tmpRepo((root) => {
    // a real commit on main that changed a.txt; no zz branch exists
    writeFileSync(join(root, 'a.txt'), 'one\ntwo\nthree\n');
    git(['commit', '-qam', 'session: did work'], root);
    const sha = git(['rev-parse', 'HEAD'], root);
    const id = 'mergedone55';
    seedIndex(root, [{ id, host: 'codex', status: 'completed', git: { commit: sha, branch: null } }]);

    const d = sessionDiffData(root, id);
    assert.equal(d.available, true);
    assert.ok(d.files.some((f) => f.path === 'a.txt'));
    assert.ok(d.totals.additions >= 2);
  });
});

test('no diff resolvable (no branch, no commit) → available:false', () => {
  tmpRepo((root) => {
    const id = 'ghostsess00';
    seedIndex(root, [{ id, host: 'claude', status: 'completed', git: { commit: null, branch: null } }]);
    const d = sessionDiffData(root, id);
    assert.equal(d.available, false);
    assert.deepEqual(d.files, []);
  });
});

test('unknown id → null', () => {
  tmpRepo((root) => {
    seedIndex(root, []);
    assert.equal(sessionDiffData(root, 'nope'), null);
    assert.equal(sessionFileDiffData(root, 'nope', 'a.txt'), null);
  });
});
