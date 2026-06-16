import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeManifest } from '../../zuzuu/module/module.mjs';
import { synthesizeModule } from '../../zuzuu/module/capabilities.mjs';
import { parseEnvelope } from '../../zuzuu/module/envelope.mjs';
import { itemPathFor } from '../../zuzuu/module/items.mjs';
import { readFileSync } from 'node:fs';

const makeManifest = () => normalizeManifest({
  id: 'playbooks',
  title: 'Playbooks',
  capabilities: {
    'items.collection': {},
    'query.structured': {},
    'query.semantic': {},
    'exec.script': {},
    mine: { signal: 'commands', kind: 'play' },
  },
}, 'playbooks');

const SCHEMA = { kinds: ['play'], required: ['body'] };
const opts = { loadSchema: () => SCHEMA };

test('synthesizes a module-shaped hook set from declared capabilities', () => {
  const home = mkdtempSync(join(tmpdir(), 'zz-cap-'));
  const mod = synthesizeModule(home, makeManifest(), opts);
  assert.ok(mod, 'module synthesized');
  assert.equal(mod.adapter.name, 'playbooks');
  assert.equal(typeof mod.adapter.validate, 'function');
  assert.equal(typeof mod.adapter.apply, 'function');
  assert.equal(typeof mod.miner.propose, 'function');
  assert.equal(typeof mod.recall, 'function');
  assert.equal(typeof mod.run, 'function');
  assert.equal(typeof mod.digestSection, 'function');
});

test('no capabilities → null', () => {
  const mod = synthesizeModule('/tmp', normalizeManifest({ id: 'plain' }, 'plain'), opts);
  assert.equal(mod, null);
});

test('validate honors the loaded schema', () => {
  const mod = synthesizeModule('/tmp', makeManifest(), opts);
  assert.equal(mod.adapter.validate('/tmp', { type: 'play', body: 'x' }).ok, true);
  assert.equal(mod.adapter.validate('/tmp', { type: 'play' }).ok, false); // missing body
  assert.equal(mod.adapter.validate('/tmp', { type: 'bogus', body: 'x' }).ok, false); // bad kind
});

test('apply writes a parseable envelope under <module>/items/', () => {
  const home = mkdtempSync(join(tmpdir(), 'zz-cap-'));
  const mod = synthesizeModule(home, makeManifest(), opts);
  const r = mod.adapter.apply(home, { payload: { id: 'p1', type: 'play', body: 'do the thing' } });
  assert.equal(r.ok, true);
  assert.deepEqual(r.itemIds, ['p1']);
  const path = itemPathFor(home, 'playbooks', 'p1');
  const { ok, item } = parseEnvelope(readFileSync(path, 'utf8'));
  assert.equal(ok, true);
  assert.equal(item.module, 'playbooks');
  assert.equal(item.kind, 'play');
  assert.equal(item.body, 'do the thing');
});

test('recall finds an applied item by lexical match', () => {
  const home = mkdtempSync(join(tmpdir(), 'zz-cap-'));
  const mod = synthesizeModule(home, makeManifest(), opts);
  mod.adapter.apply(home, { payload: { id: 'p1', type: 'play', body: 'deploy the rocket' } });
  const hits = mod.recall(home, 'rocket');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, 'p1');
  assert.equal(mod.recall(home, 'nonexistent').length, 0);
});
