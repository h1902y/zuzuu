// tests/unit/json-outputs.test.mjs
// The --json outputs the zuzuu-web daemon consumes (status/inbox/generation/digest).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { statusData } from '../../zuzuu/commands/status.mjs';

function withHome(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zjson-'));
  const dir = join(root, 'agent');
  mkdirSync(join(dir, 'knowledge', 'proposals'), { recursive: true });
  try { return fn(dir); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('statusData reports home, generation, pending map, drift', () => {
  withHome((dir) => {
    const d = statusData(dir);
    assert.equal(d.home, true);
    assert.equal(d.activeGeneration, null);          // none minted
    assert.equal(typeof d.pending, 'object');
    assert.equal(d.pending.knowledge, 0);
    assert.equal(d.drift.dirty, false);
  });
});
