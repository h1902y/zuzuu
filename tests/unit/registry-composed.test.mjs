import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as registry from '../../zuzuu/module/registry.mjs';

function composedHome() {
  const home = mkdtempSync(join(tmpdir(), 'zz-reg-'));
  mkdirSync(join(home, 'playbooks'), { recursive: true });
  writeFileSync(join(home, 'playbooks', 'module.json'), JSON.stringify({
    id: 'playbooks',
    title: 'Playbooks',
    capabilities: { 'items.collection': {}, mine: { kind: 'play' }, 'exec.script': {} },
  }));
  writeFileSync(join(home, 'playbooks', 'schema.json'), JSON.stringify({ kinds: ['play'], required: ['body'] }));
  return home;
}

test('modulesOf synthesizes a composed module from its manifest', () => {
  const home = composedHome();
  const entry = registry.modulesOf(home).find((e) => e.id === 'playbooks');
  assert.ok(entry, 'playbooks discovered');
  assert.equal(entry.builtin, false);
  assert.equal(entry.composed, true);
  assert.ok(entry.module, 'module synthesized (not null)');
  assert.equal(entry.module.adapter.name, 'playbooks');
  assert.equal(typeof entry.module.miner.propose, 'function');
});

test('adapterFor reaches a composed module; minersFor includes it', () => {
  const home = composedHome();
  const a = registry.adapterFor(home, 'playbooks');
  assert.ok(a);
  assert.equal(a.name, 'playbooks');
  const miners = registry.minersFor(home);
  assert.ok(miners.some((m) => m.module === 'playbooks'), 'composed miner present');
  // built-ins still present
  assert.ok(miners.some((m) => m.module === 'knowledge'), 'knowledge miner present');
});

test('the 5 built-ins resolve unchanged (adapterFor falls to get)', () => {
  const home = composedHome();
  for (const id of ['knowledge', 'memory', 'actions', 'instructions', 'guardrails']) {
    const a = registry.adapterFor(home, id);
    assert.ok(a, `${id} adapter present`);
    assert.equal(a, registry.get(id), `${id} via adapterFor === get`);
  }
});

test('manifest-only folder without capabilities stays items-only (module null)', () => {
  const home = mkdtempSync(join(tmpdir(), 'zz-reg-'));
  mkdirSync(join(home, 'plain'), { recursive: true });
  writeFileSync(join(home, 'plain', 'module.json'), JSON.stringify({ id: 'plain', title: 'Plain' }));
  const entry = registry.modulesOf(home).find((e) => e.id === 'plain');
  assert.ok(entry);
  assert.equal(entry.composed, false);
  assert.equal(entry.module, null);
});
