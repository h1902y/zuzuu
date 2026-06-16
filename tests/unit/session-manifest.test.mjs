// Wave C (L4): the portable, content-addressed SESSION MANIFEST — the durable
// definition of a session (host, branch/commit, trace pointer, worktree,
// counts). Foundation for restore-from-manifest + cross-machine portability.
// Hermetic tmp repos + a seeded index; never touches the zuzuu repo itself.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import {
  buildSessionManifest,
  writeSessionManifest,
  readSessionManifest,
  listSessionManifests,
  restoreSession,
} from '../../zuzuu/sessions/session-manifest.mjs';
import { sessionBranchName } from '../../zuzuu/sessions/session-git.mjs';
import { openSessionWorktree, worktreePath } from '../../zuzuu/sessions/session-worktree.mjs';

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}
function tmpRepo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-manifest-'));
  git(['init', '-q', '-b', 'main'], root);
  git(['config', 'user.email', 'test@zuzuu.dev'], root);
  git(['config', 'user.name', 'zuzuu test'], root);
  git(['config', 'commit.gpgsign', 'false'], root);
  writeFileSync(join(root, 'a.txt'), 'one\n');
  git(['add', '-A'], root);
  git(['commit', '-q', '-m', 'init'], root);
  try { return fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
}
function seedIndex(root, records) {
  mkdirSync(join(root, '.zuzuu'), { recursive: true });
  writeFileSync(join(root, '.zuzuu', 'sessions.json'), JSON.stringify({ version: 1, sessions: records }, null, 2));
}

test('buildSessionManifest gathers host/state/git/trace/counts from the record', () => {
  tmpRepo((root) => {
    const id = 'manifest-abc123';
    const branch = sessionBranchName(id);
    seedIndex(root, [{
      id, host: 'claude-code', status: 'completed',
      startedAt: '2026-06-16T10:00:00.000Z', endedAt: '2026-06-16T10:05:00.000Z', durationMs: 300000,
      counts: { turns: 4, tools: 9, errors: 1 }, generation: 'gen_002',
      git: { commit: 'abc1234def', branch }, traceRef: 'trace-ref-1',
    }]);
    const m = buildSessionManifest(root, id);
    assert.equal(m.version, 1);
    assert.equal(m.sessionId, id);
    assert.equal(m.host, 'claude-code');
    assert.equal(m.state, 'completed');
    assert.equal(m.git.branch, branch);
    assert.equal(m.git.commit, 'abc1234def');
    assert.equal(m.git.base, 'main');
    assert.equal(m.trace.ref, 'trace-ref-1');
    assert.deepEqual(m.counts, { turns: 4, tools: 9, errors: 1 });
    assert.equal(m.generation, 'gen_002');
    assert.match(m.contentHash, /^[0-9a-f]{64}$/);
  });
});

test('buildSessionManifest uses a user label as the title when set', () => {
  tmpRepo((root) => {
    const id = 'labeled-1';
    seedIndex(root, [{ id, host: 'codex', status: 'active', git: { commit: null, branch: sessionBranchName(id) } }]);
    writeFileSync(join(root, '.zuzuu', 'session-labels.json'), JSON.stringify({ [id]: 'Fix the login bug' }));
    const m = buildSessionManifest(root, id);
    assert.equal(m.title, 'Fix the login bug');
  });
});

test('contentHash is deterministic for the same session state, and changes when the definition changes', () => {
  tmpRepo((root) => {
    const id = 'hash-1';
    const rec = { id, host: 'claude-code', status: 'completed', git: { commit: 'c0ffee', branch: sessionBranchName(id) }, counts: { turns: 1, tools: 2, errors: 0 } };
    seedIndex(root, [rec]);
    const h1 = buildSessionManifest(root, id).contentHash;
    const h2 = buildSessionManifest(root, id).contentHash; // same state
    assert.equal(h1, h2, 'stable hash for unchanged state');
    seedIndex(root, [{ ...rec, counts: { turns: 99, tools: 2, errors: 0 } }]); // definition changed
    const h3 = buildSessionManifest(root, id).contentHash;
    assert.notEqual(h1, h3, 'hash flips when the definition changes');
  });
});

test('contentHash ignores volatile runtime fields (worktree presence does not change it)', () => {
  tmpRepo((root) => {
    const id = 'volatile1';
    // pin a commit so the DEFINITION is fixed — only worktree.present toggles
    seedIndex(root, [{ id, host: 'claude-code', status: 'active', git: { commit: 'deadbeef', branch: sessionBranchName(id) } }]);
    const before = buildSessionManifest(root, id).contentHash;
    // create the worktree → manifest now reports worktree.present, but the hash
    // (the stable DEFINITION) must not move
    openSessionWorktree(root, id);
    const m = buildSessionManifest(root, id);
    assert.equal(m.worktree.present, true);
    assert.equal(m.contentHash, before, 'runtime worktree presence is excluded from the content hash');
  });
});

test('unknown id → null (fail-soft)', () => {
  tmpRepo((root) => {
    seedIndex(root, []);
    assert.equal(buildSessionManifest(root, 'nope'), null);
    assert.equal(buildSessionManifest(root, ''), null);
  });
});

test('write → read round-trips a manifest to a git-tracked file under .zuzuu/manifests', () => {
  tmpRepo((root) => {
    const id = 'persist-1';
    seedIndex(root, [{ id, host: 'claude-code', status: 'completed', git: { commit: 'abc123', branch: sessionBranchName(id) } }]);
    const w = writeSessionManifest(root, id);
    assert.equal(w.ok, true);
    assert.ok(w.path.endsWith(join('.zuzuu', 'manifests', `${id}.json`)));
    assert.ok(existsSync(w.path));
    const onDisk = JSON.parse(readFileSync(w.path, 'utf8'));
    assert.equal(onDisk.sessionId, id);
    assert.equal(onDisk.contentHash, w.contentHash);
    const r = readSessionManifest(root, id);
    assert.equal(r.sessionId, id);
    assert.equal(r.contentHash, w.contentHash);
    assert.deepEqual(listSessionManifests(root), [id]);
  });
});

test('writeSessionManifest on an unknown id is a quiet {ok:false}', () => {
  tmpRepo((root) => {
    seedIndex(root, []);
    assert.equal(writeSessionManifest(root, 'ghost').ok, false);
    assert.equal(readSessionManifest(root, 'ghost'), null);
    assert.deepEqual(listSessionManifests(root), []);
  });
});

test('restoreSession recreates the worktree on an existing branch (resume)', () => {
  tmpRepo((root) => {
    const id = 'restore01';
    seedIndex(root, [{ id, host: 'claude-code', status: 'completed', git: { commit: null, branch: sessionBranchName(id) } }]);
    const wt = worktreePath(root, id);
    openSessionWorktree(root, id);   // branch + worktree exist
    writeSessionManifest(root, id);
    rmSync(wt, { recursive: true, force: true }); // worktree dir gone (e.g. cleaned), branch remains
    const r = restoreSession(root, id);
    assert.equal(r.ok, true);
    assert.equal(r.branch, sessionBranchName(id));
    assert.equal(existsSync(r.worktree), true, 'worktree re-created');
  });
});

test('restoreSession recreates a gone branch from the recorded commit', () => {
  tmpRepo((root) => {
    const id = 'restore02';
    const branch = sessionBranchName(id);
    // build a real commit on the branch, capture its sha, then delete the branch
    git(['checkout', '-q', '-b', branch], root);
    writeFileSync(join(root, 'w.txt'), 'work\n');
    git(['add', '-A'], root);
    git(['commit', '-q', '-m', 'session work'], root);
    const sha = git(['rev-parse', branch], root);
    git(['checkout', '-q', 'main'], root);
    git(['branch', '-D', branch], root); // branch gone; commit still reachable
    seedIndex(root, [{ id, host: 'claude-code', status: 'completed', git: { commit: sha, branch } }]);

    const r = restoreSession(root, id);
    assert.equal(r.ok, true);
    assert.equal(existsSync(join(r.worktree, 'w.txt')), true, 'recorded commit content restored');
    assert.equal(git(['rev-parse', branch], root), sha, 'branch recreated at the recorded commit');
  });
});

test('restoreSession fails soft when neither branch nor commit can be resolved', () => {
  tmpRepo((root) => {
    const id = 'restore03';
    seedIndex(root, [{ id, host: 'claude-code', status: 'completed', git: { commit: 'cafebabecafebabecafebabecafebabecafebabe', branch: sessionBranchName(id) } }]);
    const r = restoreSession(root, id); // commit not in repo, branch absent
    assert.equal(r.ok, false);
  });
});
