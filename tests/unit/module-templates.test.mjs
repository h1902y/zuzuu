import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { STANDARD_MODULES, templateFor, manifestFor, ensureModuleManifest } from '../../src/notes/module-templates.mjs';
import { parse } from '../../src/notes/note.mjs';

test('STANDARD_MODULES holds the five module types', () => {
  assert.deepEqual(
    Object.keys(STANDARD_MODULES).sort(),
    ['actions', 'guardrails', 'instructions', 'knowledge', 'memory'],
  );
});

test('templateFor returns the standard template for a known type', () => {
  const k = templateFor('knowledge');
  assert.equal(k.id, 'knowledge');
  assert.equal(k.note_type, 'knowledge');
  assert.deepEqual(k.capabilities, ['query', 'check']);
});

test('templateFor returns a usable generic template for a custom id', () => {
  const c = templateFor('roadmap');
  assert.equal(c.id, 'roadmap');
  assert.equal(c.title, 'Roadmap');
  assert.ok(Array.isArray(c.capabilities) && c.capabilities.length > 0);
});

test('manifestFor produces a parseable type:module envelope', () => {
  const md = manifestFor('guardrails');
  const { ok, note } = parse(md);
  assert.equal(ok, true);
  assert.equal(note.type, 'module');
  assert.equal(note.title, 'Guardrails');
});

test('ensureModuleManifest mints once, then is idempotent', () => {
  const home = mkdtempSync(join(tmpdir(), 'zz-tpl-'));
  const path = join(home, 'knowledge', 'module.md');
  assert.equal(existsSync(path), false);
  assert.equal(ensureModuleManifest(home, 'knowledge'), true);
  assert.equal(existsSync(path), true);
  const before = readFileSync(path, 'utf8');
  assert.equal(ensureModuleManifest(home, 'knowledge'), false); // already present → no-op
  assert.equal(readFileSync(path, 'utf8'), before); // not clobbered
});
