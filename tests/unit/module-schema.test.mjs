import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAgainstSchema } from '../../zuzuu/module/schema.mjs';

test('required + kinds', () => {
  const schema = { kinds: ['note', 'decision'], required: ['body'] };
  assert.equal(validateAgainstSchema(schema, { type: 'note', body: 'x' }).ok, true);
  assert.equal(validateAgainstSchema(schema, { type: 'note' }).ok, false); // missing body
  assert.equal(validateAgainstSchema(schema, { type: 'bogus', body: 'x' }).ok, false); // bad kind
  assert.equal(validateAgainstSchema({}, { body: 'x' }).ok, true); // empty schema
});
test('shape', () => {
  const r = validateAgainstSchema({ required: ['body'] }, {});
  assert.equal(Array.isArray(r.errors), true);
  assert.equal(Array.isArray(r.warnings), true);
});
