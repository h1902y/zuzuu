// The Project manifest — `project.md` (type: project), the top of the hierarchy
// (note › module › Project). init plants it; readProject reads it; digest consumes
// its title. Every container declares itself with an envelope (note · module.md ·
// project.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { initHome } from '../../src/cli/init.mjs';
import { readProject } from '../../src/notes/project.mjs';
import { parse } from '../../src/notes/note.mjs';
import { digestText } from '../../src/serve/digest.mjs';

const withRepo = (fn) => {
  const cwd = mkdtempSync(join(tmpdir(), 'zz-project-'));
  try { return fn(cwd); } finally { rmSync(cwd, { recursive: true, force: true }); }
};

test('init plants a project.md manifest (type: project, title = repo dir, format)', () => {
  withRepo((cwd) => {
    initHome(cwd);
    const path = join(cwd, '.zuzuu', 'project.md');
    assert.ok(existsSync(path), 'project.md exists');
    const { ok, note } = parse(readFileSync(path, 'utf8'), { id: 'project' });
    assert.equal(ok, true);
    assert.equal(note.type, 'project');
    assert.equal(note.title, basename(cwd));
    assert.equal(note.format, 'zuzuu/v2');
    assert.match(note.body, /note › module › Project/);
  });
});

test('readProject reads the manifest; fail-soft when absent', () => {
  withRepo((cwd) => {
    initHome(cwd);
    const home = join(cwd, '.zuzuu');
    const p = readProject(home);
    assert.equal(p.type, 'project');
    assert.equal(p.title, basename(cwd));
    assert.equal(p.format, 'zuzuu/v2');
    // absent → minimal default, never throws
    const empty = mkdtempSync(join(tmpdir(), 'zz-empty-'));
    try { assert.equal(readProject(join(empty, '.zuzuu')).title, null); }
    finally { rmSync(empty, { recursive: true, force: true }); }
  });
});

test('digest uses the Project title from the manifest', () => {
  withRepo((cwd) => {
    initHome(cwd); // guardrails module exists → digest renders
    const out = digestText(cwd);
    assert.match(out, new RegExp(`# ${basename(cwd)} — session brief`), 'brief titled by the Project manifest');
  });
});

test('a custom Project title surfaces in the digest', () => {
  withRepo((cwd) => {
    initHome(cwd);
    // overwrite the manifest title (a user renamed their Project)
    const home = join(cwd, '.zuzuu');
    mkdirSync(home, { recursive: true });
    writeFileSync(join(home, 'project.md'), '---\ntype: project\ntitle: My Deck Game\nformat: zuzuu/v2\n---\nhi\n');
    assert.equal(readProject(home).title, 'My Deck Game');
    assert.match(digestText(cwd), /# My Deck Game — session brief/);
  });
});
