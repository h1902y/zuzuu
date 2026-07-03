// root-mode — the repo root IS the Project. The marker is a root `project.md`
// with `type: project` + `format: zuzuu/…`; content modules are visible dirs,
// ephemera (worktrees, sessions) stay tucked in `.zuzuu/` like `.git`. Hermetic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { homeDir, ephemeraDir } from '../../src/notes/store.mjs';
import { initHome } from '../../src/cli/init.mjs';
import { serialize } from '../../src/notes/note.mjs';
import { count, search } from '../../src/notes/index.mjs';
import { mint, generations, notesAsOf } from '../../src/notes/generation.mjs';
import { gate, clearCache } from '../../src/guardrails/gate.mjs';

const ROOT_MARKER = serialize({ type: 'project', title: 't', format: 'zuzuu/v2', body: 'root-mode' });
const tmp = () => mkdtempSync(join(tmpdir(), 'zz-root-'));
const putNote = (root, module, id, note) => {
  mkdirSync(join(root, module, 'items'), { recursive: true });
  writeFileSync(join(root, module, 'items', `${id}.md`), serialize({ id, ...note }));
};

test('homeDir: classic without the marker; root-mode with a root project.md; ephemera stay hidden', () => {
  const a = tmp();
  try {
    assert.equal(homeDir(a), join(a, '.zuzuu'), 'no marker → classic hidden home');
  } finally { rmSync(a, { recursive: true, force: true }); }

  const b = tmp();
  try {
    writeFileSync(join(b, 'project.md'), ROOT_MARKER);
    assert.equal(homeDir(b), b, 'the marker puts the home at the root');
    assert.equal(ephemeraDir(b), join(b, '.zuzuu'), 'ephemera dir is .zuzuu in both modes');
  } finally { rmSync(b, { recursive: true, force: true }); }
});

test('homeDir: a non-zuzuu project.md at root does NOT trigger root-mode', () => {
  const root = tmp();
  try {
    writeFileSync(join(root, 'project.md'), '# just a doc\n\nnot an envelope');
    assert.equal(homeDir(root), join(root, '.zuzuu'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('index: root-mode scans only module-shaped dirs (module.md or items/), never src/-likes', () => {
  const root = tmp();
  try {
    writeFileSync(join(root, 'project.md'), ROOT_MARKER);
    putNote(root, 'knowledge', 'a', { type: 'knowledge', title: 'A' });
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'main.mjs'), '// code, not a module');
    mkdirSync(join(root, 'docs'), { recursive: true });
    writeFileSync(join(root, 'docs', 'readme.md'), '# not items');
    const home = homeDir(root);
    assert.equal(home, root);
    assert.equal(count(home), 1, 'only the module note is indexed');
    const rows = [].concat(search(home, {}) ?? []);
    assert.ok(JSON.stringify(rows).includes('knowledge:a'), 'the note is addressable as knowledge:a');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('init --root: project.md at root, generic safety floor only, scoped gitignore', () => {
  const root = tmp();
  try {
    const r = initHome(root, { atRoot: true });
    assert.equal(r.ok, true);
    assert.equal(r.home, root, 'the home IS the root');
    assert.match(readFileSync(join(root, 'project.md'), 'utf8'), /format: zuzuu\/v2/);
    assert.ok(existsSync(join(root, 'instructions', 'module.md')), 'instructions module at root');
    // the two .zuzuu/-PATH-scoped moat rules don't transplant to root-mode (gating is
    // opt-in there) — but protect-brain-exec is NOT path-scoped (it denies shelling a
    // `zz` write verb, a hazard in root-mode too) and DOES ship (SHOULD-FIX 1, audit
    // 2026-07-03-triggers-review.md — root-mode used to skip it, leaving every write
    // verb unenforced for an agent shelling `zz` there).
    assert.ok(!existsSync(join(root, 'instructions', 'items', 'protect-brain-writes.md')));
    assert.ok(!existsSync(join(root, 'instructions', 'items', 'protect-brain-shell.md')));
    assert.ok(existsSync(join(root, 'instructions', 'items', 'protect-brain-exec.md')), 'the exec-gate rule ships in root-mode too');
    assert.match(readFileSync(join(root, 'instructions', 'items', 'protect-brain-exec.md'), 'utf8'), /trigger/, 'the current write-verb pattern is seeded, not a stale one');
    assert.ok(existsSync(join(root, 'instructions', 'items', 'no-root-wipe.md')), 'generic floor ships');
    const gi = readFileSync(join(root, '.gitignore'), 'utf8');
    assert.match(gi, /^\.zuzuu\/$/m, 'ephemera dir ignored');
    assert.match(gi, /^instructions\/runs\.jsonl$/m, 'telemetry ignored per module, not by broad glob');
    assert.ok(!gi.split('\n').some((l) => l.trim() === '*/runs.jsonl'), 'no dangerous root-wide glob');
    // and the marker now flips resolution for this root
    assert.equal(homeDir(root), root);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// SHOULD-FIX 1 (docs/audits/2026-07-03-triggers-review.md): before this fix, root-mode
// NEVER seeded protect-brain-exec, so a root-mode Project (like the personal vault) had
// NO exec-gate rule at all — every `zz` write verb, including `zz trigger fire`, was
// unenforced against an agent shelling it via Bash. Drives the REAL gate() against the
// REAL seeded rule note (not the live-computed regex trigger-cli.test.mjs exercises) —
// proof the stored pattern, not just the generator function, denies in root-mode too.
test('init --root: the seeded protect-brain-exec rule denies a shelled write verb (incl. `zz trigger fire`)', () => {
  const root = tmp();
  try {
    const { home } = initHome(root, { atRoot: true });
    clearCache();
    const decide = (command) => gate({ home }, { tool: 'Bash', input: { command } });

    for (const command of ['zz trigger fire actions:t1', 'zz trigger enable actions:t1', 'zz note set knowledge x title y']) {
      const v = decide(command);
      assert.equal(v?.action, 'deny', `denied in root-mode: ${command}`);
      assert.equal(v.rule, 'protect-brain-exec');
    }
    // reads stay open to the agent
    assert.equal(decide('zz trigger list'), null);
    assert.equal(decide('zz query knowledge foo'), null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('generations: mint + notesAsOf use root pathspecs (no .zuzuu/ prefix) in root-mode', () => {
  const root = tmp();
  try {
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
    execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: root });
    writeFileSync(join(root, 'project.md'), ROOT_MARKER);
    putNote(root, 'knowledge', 'a', { type: 'knowledge', title: 'A' });
    const home = homeDir(root);
    assert.equal(home, root);
    const e = mint(home, 'knowledge', { label: 'seed' });
    assert.equal(e.n, 1);
    assert.equal(generations(home, 'knowledge').active, 1);
    const asOf = notesAsOf(home, 'knowledge', 1);
    assert.equal(asOf.ok, true, `notesAsOf resolves the gen commit: ${asOf.error ?? ''}`);
    assert.deepEqual(asOf.notes.map((n) => n.addr), ['knowledge:a']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
