// No-prebuilt-modules: the loop mints a module's manifest on first proposal, so a
// grown module is well-formed and enumerable (listModules requires module.md). The
// mint is STRUCTURAL — the item is still gated through review.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stageChange } from '../../src/grow/stage.mjs';
import { manifestPath, itemPath } from '../../src/notes/store.mjs';
import { listModules, readManifest } from '../../src/notes/module.mjs';

const mkHome = () => mkdtempSync(join(tmpdir(), 'zz-mint-'));
const propose = (home, module, target = 'a-fact') =>
  stageChange(home, module, { op: 'create', target, change: { type: 'knowledge', title: 'x', body: 'y' } });

test('stageChange mints a standard module manifest on first use → enumerable', () => {
  const home = mkHome();
  assert.equal(existsSync(manifestPath(home, 'knowledge')), false);
  propose(home, 'knowledge');
  assert.equal(existsSync(manifestPath(home, 'knowledge')), true);
  assert.equal(readManifest(home, 'knowledge').note_type, 'knowledge');
  assert.equal(listModules(home).length, 1, 'the grown module is now enumerable');
});

test('stageChange mints a generic manifest for a custom module', () => {
  const home = mkHome();
  propose(home, 'roadmap');
  assert.equal(existsSync(manifestPath(home, 'roadmap')), true);
  assert.equal(listModules(home).length, 1);
});

test('the mint is structural — the ITEM is not written until review approves', () => {
  const home = mkHome();
  propose(home, 'knowledge', 'pending-fact');
  // manifest exists (structural), but the proposed note does NOT (still gated)
  assert.equal(existsSync(manifestPath(home, 'knowledge')), true);
  assert.equal(existsSync(itemPath(home, 'knowledge', 'pending-fact')), false);
});

test('re-proposing does not re-mint / clobber the manifest', () => {
  const home = mkHome();
  propose(home, 'knowledge');
  const before = readFileSync(manifestPath(home, 'knowledge'), 'utf8');
  propose(home, 'knowledge'); // same content → duplicate, no re-stage, no re-mint
  assert.equal(readFileSync(manifestPath(home, 'knowledge'), 'utf8'), before);
});
