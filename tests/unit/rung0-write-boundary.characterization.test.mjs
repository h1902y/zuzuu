// tests/unit/rung0-write-boundary.characterization.test.mjs
//
// CHARACTERIZATION (Rung 0 of the write-boundary refactor). These tests do NOT
// drive new behavior — they PIN the CURRENT behavior of zuzuu's write paths, the
// session git contract, and the guardrails gate, so that later rungs (rewrite the
// write boundary, centralize the git metal, add schema enforcement at every writer)
// fail LOUDLY here the moment they shift a byte. Goldens are PASTED FROM A REAL RUN.
//
// Where existing suites already lock an invariant (loop.test, plan.test,
// refactor.test, edit-view.test, brain-protection.test, act-gate.test,
// e2e-gate.test, session-git-single-branch.characterization.test), this file does
// NOT duplicate them — it adds the refactor-sensitive goldens those suites leave
// open: the EXACT serialized note bytes after each write op, the full effect triple
// (mint count + mutation-log kind + bytes), the fact that grow/refactor currently
// writes WITHOUT a validate pass (the "before" a later rung deliberately changes),
// the raw session git() {ok,code,out,err} contract distinguishing 0/1/128, and the
// exact gate rule ids + the documented shell-protection gap.
//
// Hermetic: isolated tmp repos only — nothing here may ever touch the zuzuu repo's
// own .git/ or .zuzuu/.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { serialize, parse } from '../../src/notes/note.mjs';
import { stageChange, readStaged } from '../../src/grow/stage.mjs';
import { evolve } from '../../src/grow/evolve.mjs';
import { patchNote, appendNote } from '../../src/grow/edit.mjs';
import { renameNote, refactorField } from '../../src/grow/refactor.mjs';
import { generations } from '../../src/notes/generation.mjs';
import { read as readLog } from '../../src/notes/log.mjs';
import { validateNote } from '../../src/notes/validate.mjs';
import { git } from '../../src/sessions/git.mjs';
import { initHome } from '../../src/cli/init.mjs';
import { gate, clearCache } from '../../src/guardrails/gate.mjs';

// ── helpers ──────────────────────────────────────────────────────────────────

// A hermetic git repo (generations are git commits, so the home needs a real repo).
function withRepo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-rung0-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: root });
  const home = join(root, '.zuzuu');
  try { return fn(home, root); } finally { rmSync(root, { recursive: true, force: true }); }
}
const itemsFile = (home, m, id) => join(home, m, 'items', `${id}.md`);
const bytes = (home, m, id) => readFileSync(itemsFile(home, m, id), 'utf8');
const put = (home, m, id, note) => {
  mkdirSync(join(home, m, 'items'), { recursive: true });
  writeFileSync(itemsFile(home, m, id), serialize({ id, ...note }));
};
const readNote = (home, m, id) => parse(readFileSync(itemsFile(home, m, id), 'utf8'), { id }).note;
// stage + evolve in one shot (the single-change write path). Returns the evolve result.
const evolveOp = (home, m, p) => evolve(home, m, readStaged(home, m, stageChange(home, m, p).id));

// ════════════════════════════════════════════════════════════════════════════
// 1. WRITE PATHS — the effect triple {mint count, mutation-log kind, note bytes}
// ════════════════════════════════════════════════════════════════════════════

test('evolve(create): mints 1, logs `create`, lands the EXACT bytes', () => {
  withRepo((home) => {
    const r = evolveOp(home, 'knowledge', { op: 'create', target: 'fact', change: { type: 'knowledge', title: 'Hello', body: 'world' } });
    assert.equal(r.ok, true);
    assert.equal(generations(home, 'knowledge').active, 1, 'one generation minted');
    assert.deepEqual(readLog(home, 'knowledge', 'mutations'),
      [{ event: 'create', ts: null, note: 'fact', actor: 'human', proposal: 'stg-30e6e1a4' }],
      'the mutation log records exactly one create with the staged-change provenance');
    assert.equal(bytes(home, 'knowledge', 'fact'),
      '---\ntype: knowledge\ntitle: Hello\n---\nworld\n',
      'serialized note bytes — frontmatter then body, exact');
  });
});

test('evolve(update): mints +1, logs `update`, MERGES onto current (bytes exact)', () => {
  withRepo((home) => {
    evolveOp(home, 'knowledge', { op: 'create', target: 'fact', change: { type: 'knowledge', title: 'old', tags: ['x'] } });
    assert.equal(generations(home, 'knowledge').active, 1);
    const r = evolveOp(home, 'knowledge', { op: 'update', target: 'fact', change: { title: 'new' } });
    assert.equal(r.ok, true);
    assert.equal(generations(home, 'knowledge').active, 2, 'update mints a second generation');
    assert.equal(readLog(home, 'knowledge', 'mutations').at(-1).event, 'update');
    assert.equal(readLog(home, 'knowledge', 'mutations').at(-1).proposal, 'stg-74e71453');
    assert.equal(bytes(home, 'knowledge', 'fact'),
      '---\ntype: knowledge\ntitle: new\ntags:\n  - x\n---\n',
      'title changed, tags merged through (one-level merge keeps siblings)');
  });
});

test('evolve(relate): mints +1 and logs the edge add as kind `update` (the relate→update mapping)', () => {
  withRepo((home) => {
    evolveOp(home, 'knowledge', { op: 'create', target: 'fact', change: { type: 'knowledge', title: 'F' } });
    evolveOp(home, 'knowledge', { op: 'create', target: 'other', change: { type: 'knowledge', title: 'O' } });
    const r = evolveOp(home, 'knowledge', { op: 'relate', change: { from: 'fact', type: 'related-to', to: 'other' } });
    assert.equal(r.ok, true);
    assert.equal(generations(home, 'knowledge').active, 3);
    const last = readLog(home, 'knowledge', 'mutations').at(-1);
    assert.equal(last.event, 'update', 'relate is logged as an `update` of the `from` note, NOT a `relate` kind');
    assert.equal(last.note, 'fact');
    assert.equal(last.relation, 'related-to', 'the relation type is recorded as extra context');
    assert.equal(bytes(home, 'knowledge', 'fact'),
      '---\ntype: knowledge\ntitle: F\nrelations:\n  related-to: other\n---\n');
  });
});

test('evolve(delete): mints +1, logs `delete`, removes the file', () => {
  withRepo((home) => {
    evolveOp(home, 'knowledge', { op: 'create', target: 'gone', change: { type: 'knowledge', title: 'G' } });
    const r = evolveOp(home, 'knowledge', { op: 'delete', target: 'gone' });
    assert.equal(r.ok, true);
    assert.equal(existsSync(itemsFile(home, 'knowledge', 'gone')), false, 'file removed');
    assert.equal(generations(home, 'knowledge').active, 2);
    assert.deepEqual(readLog(home, 'knowledge', 'mutations').map((e) => e.event), ['create', 'delete']);
    assert.deepEqual(readLog(home, 'knowledge', 'mutations').at(-1),
      { event: 'delete', ts: null, note: 'gone', actor: 'human', proposal: 'stg-0e2061e1' });
  });
});

test('evolve(deprecate): mints +1, logs `deprecate`, flips status and KEEPS the file (bytes exact)', () => {
  withRepo((home) => {
    evolveOp(home, 'knowledge', { op: 'create', target: 'old', change: { type: 'knowledge', title: 'stale', status: 'active' } });
    const r = evolveOp(home, 'knowledge', { op: 'deprecate', target: 'old' });
    assert.equal(r.ok, true);
    assert.equal(existsSync(itemsFile(home, 'knowledge', 'old')), true, 'deprecate keeps the file');
    assert.equal(generations(home, 'knowledge').active, 2);
    assert.deepEqual(readLog(home, 'knowledge', 'mutations').at(-1),
      { event: 'deprecate', ts: null, note: 'old', actor: 'human', proposal: 'stg-ca59f6fd' });
    assert.equal(bytes(home, 'knowledge', 'old'),
      '---\ntype: knowledge\ntitle: stale\nstatus: deprecated\n---\n');
  });
});

// ── patch / append (grow/edit → evolve): each mints ONE, logs `update` ────────

test('patch: mints exactly ONE generation and logs an `update` (proposal `patch-<id>`)', () => {
  withRepo((home) => {
    evolveOp(home, 'knowledge', { op: 'create', target: 'a', change: { type: 'knowledge', title: 'A', body: 'b' } });
    assert.equal(generations(home, 'knowledge').active, 1);
    assert.equal(patchNote(home, 'knowledge', 'a', 'status', 'active').ok, true);
    assert.equal(generations(home, 'knowledge').active, 2, 'patch is one generation');
    assert.deepEqual(readLog(home, 'knowledge', 'mutations').at(-1),
      { event: 'update', ts: null, note: 'a', actor: 'human', proposal: 'patch-a' });
  });
});

test('append: mints exactly ONE generation and logs an `update` (proposal `append-<id>`)', () => {
  withRepo((home) => {
    evolveOp(home, 'knowledge', { op: 'create', target: 'a', change: { type: 'knowledge', title: 'A', body: 'b' } });
    assert.equal(appendNote(home, 'knowledge', 'a', 'line2').ok, true);
    assert.equal(generations(home, 'knowledge').active, 2, 'append is one generation');
    assert.deepEqual(readLog(home, 'knowledge', 'mutations').at(-1),
      { event: 'update', ts: null, note: 'a', actor: 'human', proposal: 'append-a' });
    assert.equal(readNote(home, 'knowledge', 'a').body, 'b\nline2');
  });
});

// ── grow/refactor: mint-per-touched-module + writes WITHOUT a validate pass ───

test('rename: mints ONE generation per touched module and repoints every referrer', () => {
  withRepo((home) => {
    put(home, 'knowledge', 'old', { type: 'knowledge', title: 'Old' });
    put(home, 'knowledge', 'ref', { type: 'knowledge', relations: { uses: 'knowledge:old' } });
    put(home, 'actions', 'cross', { type: 'action', run: 'echo', relations: { 'related-to': 'knowledge:old' } });
    const r = renameNote(home, 'knowledge', 'old', 'new');
    assert.equal(r.ok, true);
    assert.equal(r.refs, 2, 'both inbound referrers repointed');
    // one generation per touched module (the moved module + every module holding a referrer)
    assert.deepEqual(r.generations, [{ module: 'actions', n: 1 }, { module: 'knowledge', n: 1 }],
      'a generation minted for actions (cross-module referrer) and knowledge (the moved note)');
  });
});

test('CHARACTERIZATION (before-state): refactorField writes via raw writeFileSync with NO validate pass', () => {
  // A later rung routes refactor through the validating write boundary. TODAY it does
  // not: refactorField can land a note that validateNote would REJECT. This golden
  // documents that asymmetry so the refactor that closes it fails here on purpose.
  withRepo((home) => {
    put(home, 'guardrails', 'r1', { type: 'rule', action: 'deny', pattern: 'rm', reason: 'x' });
    const r = refactorField(home, 'guardrails', 'action', 'deny', 'bogus');
    assert.equal(r.ok, true, 'refactor reports success');
    assert.equal(r.changed, 1);
    assert.equal(readNote(home, 'guardrails', 'r1').action, 'bogus', 'the invalid value is written to disk');
    assert.equal(validateNote(readNote(home, 'guardrails', 'r1')).ok, false,
      'the landed note FAILS validateNote — refactor bypassed the schema check (current state)');
  });
});

test('CONTRAST: the same invalid change through evolve IS rejected (the validated write path)', () => {
  withRepo((home) => {
    evolveOp(home, 'guardrails', { op: 'create', target: 'r1', change: { type: 'rule', action: 'deny', pattern: 'rm', reason: 'x' } });
    const r = evolve(home, 'guardrails', readStaged(home, 'guardrails', stageChange(home, 'guardrails', { op: 'update', target: 'r1', change: { action: 'bogus' } }).id));
    assert.equal(r.ok, false, 'evolve validates BEFORE the write and refuses the malformed note');
    assert.match(r.error, /invalid note 'guardrails:r1'/);
    assert.equal(readNote(home, 'guardrails', 'r1').action, 'deny', 'the note on disk is untouched');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. SESSION GIT CONTRACT — git() returns {ok,code,out,err}; code 0 / 1 / 128
// ════════════════════════════════════════════════════════════════════════════
// This raw plumbing gets PROMOTED to a metal layer in a later rung and must stay
// byte-identical: `code` is the discriminator a mergeability probe relies on to
// tell a clean merge (0) from a conflict (1) from a fatal error (128). Pin it.

test('git(): a clean invocation returns {ok:true, code:0, out:<sha>, err:""}', () => {
  withRepo((home, root) => {
    writeFileSync(join(root, 'a.txt'), 'one\n');
    execFileSync('git', ['add', '-A'], { cwd: root });
    execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: root });
    const r = git(['rev-parse', 'HEAD'], root);
    assert.equal(r.ok, true);
    assert.equal(r.code, 0, 'clean exit is code 0');
    assert.equal(r.out.length, 40, 'out carries the trimmed 40-char sha');
    assert.equal(r.err, '');
  });
});

test('git(): the merge-tree mergeability probe distinguishes clean(0) from conflict(1)', () => {
  withRepo((home, root) => {
    writeFileSync(join(root, 'a.txt'), 'one\n');
    execFileSync('git', ['add', '-A'], { cwd: root });
    execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: root });

    // a branch that conflicts with main on a.txt
    execFileSync('git', ['checkout', '-q', '-b', 'feat'], { cwd: root });
    writeFileSync(join(root, 'a.txt'), 'feat\n'); execFileSync('git', ['commit', '-qam', 'feat'], { cwd: root });
    execFileSync('git', ['checkout', '-q', 'main'], { cwd: root });
    writeFileSync(join(root, 'a.txt'), 'main\n'); execFileSync('git', ['commit', '-qam', 'main'], { cwd: root });
    const conflict = git(['merge-tree', '--write-tree', '--quiet', 'main', 'feat'], root);
    assert.equal(conflict.ok, false);
    assert.equal(conflict.code, 1, 'a conflicting merge-tree probe exits 1 — a CONFLICT, never reported as an error');

    // a branch that adds an unrelated file — a clean merge
    execFileSync('git', ['checkout', '-q', '-b', 'feat2'], { cwd: root });
    writeFileSync(join(root, 'b.txt'), 'newfile\n'); execFileSync('git', ['add', '-A'], { cwd: root });
    execFileSync('git', ['commit', '-qam', 'b'], { cwd: root });
    execFileSync('git', ['checkout', '-q', 'main'], { cwd: root });
    const ready = git(['merge-tree', '--write-tree', '--quiet', 'main', 'feat2'], root);
    assert.equal(ready.ok, true);
    assert.equal(ready.code, 0, 'a clean merge-tree probe exits 0 — READY');
  });
});

test('git(): a fatal/usage error surfaces as code 128 (NEVER conflated with a conflict)', () => {
  const nonRepo = mkdtempSync(join(tmpdir(), 'zz-rung0-nonrepo-'));
  try {
    const r = git(['rev-parse', 'HEAD'], nonRepo);
    assert.equal(r.ok, false);
    assert.equal(r.code, 128, 'git in a non-repo is a fatal 128, distinct from a conflict(1)');
    assert.notEqual(r.err, '', 'stderr carries the fatal message');
  } finally {
    rmSync(nonRepo, { recursive: true, force: true });
  }
  withRepo((home, root) => {
    writeFileSync(join(root, 'a.txt'), 'one\n');
    execFileSync('git', ['add', '-A'], { cwd: root });
    execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: root });
    const bad = git(['cat-file', '-p', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'], root);
    assert.equal(bad.code, 128, 'a bad object ref is also a fatal 128');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. GATE DECISIONS — exact rule ids + the documented shell-protection GAP
// ════════════════════════════════════════════════════════════════════════════
// deny / ask / defer / fail-open are pinned in act-gate.test + e2e-gate.test. This
// adds the brain-write-protection rule IDENTITIES and PINS the shell-rule gap (only
// >, >>, tee, sed -i are caught; cp/mv/zz into .zuzuu/ slip through) so the rung
// that closes the gap fails here and forces an explicit decision.

function withInit(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-rung0-gate-'));
  const { home } = initHome(root);
  clearCache();
  try { return fn(root, home); } finally { rmSync(root, { recursive: true, force: true }); }
}
const decide = (home, tool, input) => gate({ home }, { tool, input });

test('gate: a file-write into .zuzuu/ is denied by rule `protect-brain-writes`', () => withInit((root, home) => {
  const v = decide(home, 'Write', { file_path: join(home, 'instructions', 'items', 'evil.md'), content: 'x' });
  assert.equal(v?.action, 'deny');
  assert.equal(v.rule, 'protect-brain-writes', 'the path-scoped write guard fires');
  // same rule, relative path form
  assert.equal(decide(home, 'Write', { file_path: '.zuzuu/knowledge/items/x.md', content: 'x' }).rule, 'protect-brain-writes');
}));

test('gate: a shell REDIRECT into .zuzuu/ is denied by rule `protect-brain-shell`', () => withInit((root, home) => {
  const v = decide(home, 'Bash', { command: 'echo x > .zuzuu/instructions/items/y.md' });
  assert.equal(v?.action, 'deny');
  assert.equal(v.rule, 'protect-brain-shell');
  // tee is covered too
  assert.equal(decide(home, 'Bash', { command: 'echo x | tee .zuzuu/knowledge/items/x.md' })?.rule, 'protect-brain-shell');
}));

test('CHARACTERIZATION (the gap a later rung closes): non-redirect shell writes into .zuzuu/ are NOT denied', () => withInit((root, home) => {
  // The shell guard only matches >, >>, tee, sed -i. A copy/move into the brain — or
  // any `zz` command — defers (null). `zz` deferring is intended; cp/mv slipping
  // through is the HOLE. Pinned so closing it is a conscious, test-breaking change.
  assert.equal(decide(home, 'Bash', { command: 'zz stage knowledge --op create --target foo' }), null, 'a zz command defers (intended)');
  assert.equal(decide(home, 'Bash', { command: 'cp /etc/hosts .zuzuu/knowledge/items/x.md' }), null, 'GAP: cp into the brain is not caught');
  assert.equal(decide(home, 'Bash', { command: 'mv foo.md .zuzuu/knowledge/items/x.md' }), null, 'GAP: mv into the brain is not caught');
}));
