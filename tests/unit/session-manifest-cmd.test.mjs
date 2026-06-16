// Wave C C4: the `zuzuu session manifest|restore` CLI seam. Thin print/dispatch
// over the (separately-tested) session-manifest.mjs module; here we characterize
// dispatch, --json output, --write, and exit codes. Hermetic tmp repo + chdir.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sessionManifest, sessionRestore } from '../../zuzuu/commands/session-manifest.mjs';
import { sessionBranchName } from '../../zuzuu/sessions/session-git.mjs';

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}
function tmpRepo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-mancmd-'));
  git(['init', '-q', '-b', 'main'], root);
  git(['config', 'user.email', 'test@zuzuu.dev'], root);
  git(['config', 'user.name', 'zuzuu test'], root);
  git(['config', 'commit.gpgsign', 'false'], root);
  writeFileSync(join(root, 'a.txt'), 'one\n');
  git(['add', '-A'], root);
  git(['commit', '-q', '-m', 'init'], root);
  const prev = process.cwd();
  process.chdir(root);
  try { return fn(root); } finally { process.chdir(prev); rmSync(root, { recursive: true, force: true }); }
}
function seedIndex(root, records) {
  mkdirSync(join(root, '.zuzuu'), { recursive: true });
  writeFileSync(join(root, '.zuzuu', 'sessions.json'), JSON.stringify({ version: 1, sessions: records }, null, 2));
}
function run(fn, args) {
  const out = [];
  const err = [];
  const oL = console.log, oE = console.error, oX = process.exit;
  let exitCode = null;
  console.log = (...a) => out.push(a.join(' '));
  console.error = (...a) => err.push(a.join(' '));
  process.exit = (c) => { exitCode = c ?? 0; throw new Error(`__exit_${exitCode}`); };
  try { fn(args); } catch (e) { if (!String(e.message).startsWith('__exit_')) throw e; }
  finally { console.log = oL; console.error = oE; process.exit = oX; }
  return { out: out.join('\n'), err: err.join('\n'), exitCode };
}

test('manifest --json prints the built manifest', () => {
  tmpRepo((root) => {
    const id = 'cmd-man-1';
    seedIndex(root, [{ id, host: 'claude-code', status: 'completed', git: { commit: 'abc123', branch: sessionBranchName(id) } }]);
    const r = run(sessionManifest, { _: [id], json: true });
    assert.equal(r.exitCode, null);
    const m = JSON.parse(r.out);
    assert.equal(m.sessionId, id);
    assert.match(m.contentHash, /^[0-9a-f]{64}$/);
  });
});

test('manifest --write persists the file and reports its path', () => {
  tmpRepo((root) => {
    const id = 'cmd-man-2';
    seedIndex(root, [{ id, host: 'codex', status: 'active', git: { commit: null, branch: sessionBranchName(id) } }]);
    const r = run(sessionManifest, { _: [id], write: true, json: true });
    assert.equal(JSON.parse(r.out).ok, true);
    assert.ok(existsSync(join(root, '.zuzuu', 'manifests', `${id}.json`)));
  });
});

test('manifest without an id exits non-zero with usage', () => {
  tmpRepo(() => {
    const r = run(sessionManifest, { _: [] });
    assert.equal(r.exitCode, 1);
    assert.match(r.err, /usage/);
  });
});

test('manifest for an unknown id exits non-zero', () => {
  tmpRepo((root) => {
    seedIndex(root, []);
    const r = run(sessionManifest, { _: ['ghost'] });
    assert.equal(r.exitCode, 1);
    assert.match(r.err, /no recorded session/);
  });
});

test('restore --json reconstitutes the worktree and reports ok', () => {
  tmpRepo((root) => {
    const id = 'cmd-res-1';
    const branch = sessionBranchName(id);
    git(['branch', branch, 'main'], root); // a live/leftover session branch to resume
    seedIndex(root, [{ id, host: 'claude-code', status: 'completed', git: { commit: null, branch } }]);
    const r = run(sessionRestore, { _: [id], json: true });
    const d = JSON.parse(r.out);
    assert.equal(d.ok, true);
    assert.equal(existsSync(d.worktree), true);
  });
});

test('restore for an unresolvable session exits non-zero', () => {
  tmpRepo((root) => {
    const id = 'cmd-res-2';
    seedIndex(root, [{ id, host: 'claude-code', status: 'completed', git: { commit: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', branch: sessionBranchName(id) } }]);
    const r = run(sessionRestore, { _: [id], json: true });
    assert.equal(r.exitCode, 1);
    assert.equal(JSON.parse(r.out).ok, false);
  });
});
