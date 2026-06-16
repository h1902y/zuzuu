import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeManifest } from '../../zuzuu/module/module.mjs';

test('legacy hooks still work', () => {
  const m = normalizeManifest({ hooks: { miner: true, digest: true } }, 'k');
  assert.equal(m.hooks.miner, true);
  assert.equal(m.hooks.digest, true);
  assert.deepEqual(m.capabilities, {});
});
test('capabilities desugar to hooks', () => {
  const m = normalizeManifest({ capabilities: { mine: { signal: 'sequences' }, 'harness.gate': {} } }, 'p');
  assert.equal(m.hooks.miner, true);
  assert.equal(m.hooks.gate, true);
  assert.deepEqual(m.capabilities.mine, { signal: 'sequences' });
});
test('neither → empty caps, hooks false', () => {
  const m = normalizeManifest({}, 'x');
  assert.deepEqual(m.capabilities, {});
  assert.equal(m.hooks.miner, false);
  assert.equal(m.hooks.gate, false);
});
test('enabled defaults to true when absent', () => {
  const m = normalizeManifest({}, 'x');
  assert.equal(m.enabled, true);
});
test('enabled:false is preserved', () => {
  const m = normalizeManifest({ enabled: false }, 'x');
  assert.equal(m.enabled, false);
});
test('enabled:true is preserved', () => {
  const m = normalizeManifest({ enabled: true }, 'x');
  assert.equal(m.enabled, true);
});
