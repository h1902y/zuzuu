// notes/registry.mjs — the PROJECT registry substrate (distinct from the capability
// registry in serve/dispatch.mjs): project-refs, remote normalization, the library,
// and `role` surfacing. Hermetic (temp home, no git).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  normalizeRemote, readProjectRefs, writeProjectRef, removeProjectRef,
  findRefByRemote, findRefByPath, readLibraryModules,
} from '../../src/notes/registry.mjs';
import { readProject } from '../../src/notes/project.mjs';

const home = () => mkdtempSync(join(tmpdir(), 'zz-reg-'));

// ── remote normalization (the dedupe key, KTD-3) ──────────────────────────────

test('normalizeRemote: scp + https + .git + userinfo collapse to one key', () => {
  const k = 'github.com/me/x';
  assert.equal(normalizeRemote('git@github.com:me/x.git'), k);
  assert.equal(normalizeRemote('https://github.com/me/x'), k);
  assert.equal(normalizeRemote('https://user@github.com/me/x.git/'), k);
  assert.equal(normalizeRemote('GIT@GitHub.com:Me/X.git'), 'github.com/me/x');
  assert.equal(normalizeRemote(''), '');
  assert.equal(normalizeRemote(null), '');
});

// ── project-ref round-trip + type filtering ───────────────────────────────────

test('writeProjectRef → readProjectRefs round-trips all fields; handle = filename', () => {
  const h = home();
  writeProjectRef(h, {
    handle: 'cards-game', remote: 'github.com/me/cards', path: '/abs/cards',
    tracked: 'pinned', groups: ['games', 'oss'], portable: true,
    health: { modules: 2, notes: 9, pending: 1, guarded: true, lastActivityMs: 123, capturedAt: 456 },
  });
  const refs = readProjectRefs(h);
  assert.equal(refs.length, 1);
  const r = refs[0];
  assert.equal(r.id, 'cards-game'); // id = filename stem
  assert.equal(r.handle, 'cards-game');
  assert.equal(r.type, 'project-ref');
  assert.equal(r.remote, 'github.com/me/cards');
  assert.equal(r.tracked, 'pinned');
  assert.deepEqual(r.groups, ['games', 'oss']);
  assert.equal(r.portable, true);
  assert.equal(r.health.notes, 9);
  assert.equal(r.health.guarded, true);
  rmSync(h, { recursive: true, force: true });
});

test('readProjectRefs ignores non-ref notes + missing dir; never throws', () => {
  const h = home();
  assert.deepEqual(readProjectRefs(h), []); // no refs dir yet
  mkdirSync(join(h, 'refs'), { recursive: true });
  writeFileSync(join(h, 'refs', 'stray.md'), '---\ntype: knowledge\n---\nnot a ref');
  writeProjectRef(h, { handle: 'real', remote: 'github.com/me/real' });
  assert.deepEqual(readProjectRefs(h).map((r) => r.id), ['real']);
  rmSync(h, { recursive: true, force: true });
});

test('removeProjectRef drops the ref; absent → no-op', () => {
  const h = home();
  writeProjectRef(h, { handle: 'gone', remote: 'github.com/me/gone' });
  removeProjectRef(h, 'gone');
  assert.deepEqual(readProjectRefs(h), []);
  removeProjectRef(h, 'never'); // no throw
  rmSync(h, { recursive: true, force: true });
});

// ── dedupe lookups ────────────────────────────────────────────────────────────

test('findRefByRemote matches on normalized remote; findRefByPath on local-only path', () => {
  const refs = [
    { id: 'a', remote: 'github.com/me/a', path: '/p/a' },
    { id: 'b', path: '/p/b' }, // local-only (no remote)
  ];
  assert.equal(findRefByRemote(refs, 'git@github.com:me/a.git').id, 'a');
  assert.equal(findRefByRemote(refs, 'github.com/me/zzz'), null);
  assert.equal(findRefByRemote(refs, ''), null);
  assert.equal(findRefByPath(refs, '/p/b').id, 'b');
  assert.equal(findRefByPath(refs, '/p/a'), null); // /p/a has a remote → not local-only
});

// ── library = the registry's modules; refs/ is never a module ─────────────────

test('readLibraryModules lists module dirs only (refs/ excluded)', () => {
  const h = home();
  mkdirSync(join(h, 'house-style'), { recursive: true });
  writeFileSync(join(h, 'house-style', 'module.md'), '---\ntype: module\nid: house-style\ntitle: House Style\n---\n');
  writeProjectRef(h, { handle: 'p1', remote: 'github.com/me/p1' }); // creates refs/
  const mods = readLibraryModules(h).map((m) => m.id);
  assert.deepEqual(mods, ['house-style']);
  rmSync(h, { recursive: true, force: true });
});

// ── role surfacing (project.mjs) ──────────────────────────────────────────────

test('readProject surfaces role: registry; ordinary project → role null', () => {
  const h = home();
  writeFileSync(join(h, 'project.md'), '---\ntype: project\ntitle: My Registry\nrole: registry\n---\nThe registry.');
  assert.equal(readProject(h).role, 'registry');
  const h2 = home();
  writeFileSync(join(h2, 'project.md'), '---\ntype: project\ntitle: Plain\n---\nx');
  assert.equal(readProject(h2).role, null);
  rmSync(h, { recursive: true, force: true });
  rmSync(h2, { recursive: true, force: true });
});
