import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerCapability, getCapability, hasCapability, listCapabilities, clearCapabilities } from '../../zuzuu/module/capability-registry.mjs';

test('register/get/has/list/clear', () => {
  clearCapabilities();
  assert.equal(getCapability('x.y'), null);
  const d = registerCapability('x.y', { category: 'test', grant: { scope: 'self' } });
  assert.equal(d.name, 'x.y');
  assert.equal(hasCapability('x.y'), true);
  assert.deepEqual(getCapability('x.y').grant, { scope: 'self' });
  assert.equal(listCapabilities().length, 1);
  registerCapability('x.y', { category: 'changed' });
  assert.equal(getCapability('x.y').category, 'changed');
  clearCapabilities();
  assert.equal(listCapabilities().length, 0);
});
