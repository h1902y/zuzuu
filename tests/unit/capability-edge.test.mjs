// Edge-case regressions for the capability engine (from the adversarial review).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeManifest } from '../../zuzuu/module/module.mjs';
import { synthesizeModule } from '../../zuzuu/module/capabilities.mjs';
import * as registry from '../../zuzuu/module/registry.mjs';
import { approve } from '../../zuzuu/module/gate.mjs';
import { makeProposal, writeProposal } from '../../zuzuu/module/proposal.mjs';
import { moduleItemFiles } from '../../zuzuu/module/generation/read.mjs';
import { parseEnvelope } from '../../zuzuu/module/envelope.mjs';

function home(manifest, schema) {
  const dir = mkdtempSync(join(tmpdir(), 'zz-edge-'));
  mkdirSync(join(dir, manifest.id), { recursive: true });
  writeFileSync(join(dir, manifest.id, 'module.json'), JSON.stringify(manifest));
  if (schema) writeFileSync(join(dir, manifest.id, 'schema.json'), JSON.stringify(schema));
  return dir;
}

// #1 — a composed module declaring mine/query but NOT items.collection has no
// apply path; approving a filed proposal must fail-soft, never throw.
test('approve fails soft when a composed module has no apply path', () => {
  const dir = home({ id: 'noapply', title: 'NoApply', capabilities: { mine: { kind: 'x' }, 'query.structured': {} } });
  const prop = makeProposal({ module: 'noapply', kind: 'item', source: 'distill', payload: { id: 'a', type: 'x', body: 'b' } });
  writeProposal(dir, prop);
  let r;
  assert.doesNotThrow(() => { r = approve(dir, 'noapply', prop.id); });
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /no apply path|items\.collection/);
});

// #2 — a custom itemsDir must be honored by WRITE (apply), READ (recall/list),
// and generation enumeration alike — no write/read divergence.
test('custom itemsDir: apply, recall, and generation agree', () => {
  const manifest = normalizeManifest({ id: 'cards', title: 'Cards', itemsDir: 'cards', capabilities: { 'items.collection': {}, 'query.structured': {} } }, 'cards');
  const dir = home({ id: 'cards', title: 'Cards', itemsDir: 'cards', capabilities: { 'items.collection': {}, 'query.structured': {} } }, { kinds: ['card'], required: ['body'] });
  const mod = synthesizeModule(dir, manifest);
  const r = mod.adapter.apply(dir, { payload: { id: 'c1', type: 'card', body: 'hello world' } });
  assert.equal(r.ok, true);
  // written under the custom dir, not <module>/items/
  assert.ok(existsSync(join(dir, 'cards', 'cards', 'c1.md')), 'item under custom itemsDir');
  assert.ok(!existsSync(join(dir, 'cards', 'items', 'c1.md')), 'NOT under default items/');
  // recall finds it
  assert.equal(mod.recall(dir, 'hello').length, 1);
  // generation enumerator pins it from the custom dir
  const files = moduleItemFiles(dir, 'cards');
  assert.ok(files.some((f) => f.id === 'c1'), 'generation enumerator honors itemsDir');
  // and it round-trips as an envelope
  const { ok } = parseEnvelope(readFileSync(join(dir, 'cards', 'cards', 'c1.md'), 'utf8'));
  assert.equal(ok, true);
});

// fail-soft skip — an unknown capability is recorded as a note, the rest still synthesize.
test('unknown capability is skipped with a note, others still build', () => {
  const manifest = normalizeManifest({ id: 'mix', title: 'Mix', capabilities: { 'items.collection': {}, 'totally.bogus': {} } }, 'mix');
  const mod = synthesizeModule('/tmp', manifest, { loadSchema: () => ({}) });
  assert.ok(mod, 'still synthesizes');
  assert.equal(typeof mod.adapter.apply, 'function', 'real capability still wired');
  assert.ok(mod.capabilityNotes.some((n) => n.includes('totally.bogus')), 'note recorded');
});
