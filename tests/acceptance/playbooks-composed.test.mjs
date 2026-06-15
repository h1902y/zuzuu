// ACCEPTANCE (the v1 proof, decision 6): a user-authored `playbooks` module
// defined by module.json + schema.json with ZERO module code flows end-to-end:
// mine → propose → approve → version → recall → run. If this passes, "a module
// is a declaration, not a code change" is real.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as registry from '../../zuzuu/module/registry.mjs';
import { approve } from '../../zuzuu/module/gate.mjs';
import { listProposals, readArchived } from '../../zuzuu/module/proposal.mjs';
import { mintModuleGeneration } from '../../zuzuu/module/generation/write.mjs';
import { parseEnvelope } from '../../zuzuu/module/envelope.mjs';
import { itemPathFor } from '../../zuzuu/module/items.mjs';

/** Build a home containing ONLY the playbooks manifest + schema — no code. */
function home() {
  const dir = mkdtempSync(join(tmpdir(), 'zz-accept-'));
  mkdirSync(join(dir, 'playbooks'), { recursive: true });
  writeFileSync(join(dir, 'playbooks', 'module.json'), JSON.stringify({
    id: 'playbooks',
    title: 'Playbooks',
    capabilities: {
      'items.collection': {},
      'query.structured': {},
      'query.semantic': {},
      'exec.script': {},
      mine: { signal: 'commands', kind: 'play' },
    },
  }, null, 2));
  writeFileSync(join(dir, 'playbooks', 'schema.json'), JSON.stringify({ kinds: ['play'], required: ['body'] }, null, 2));
  return dir;
}

/** Recursively assert no .mjs exists under <home>/playbooks/. */
function noModuleCode(dir) {
  const root = join(dir, 'playbooks');
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else assert.ok(!name.endsWith('.mjs'), `unexpected module code: ${p}`);
    }
  };
  walk(root);
}

test('playbooks composed module: mine → propose → approve → version → recall → run, zero code', () => {
  const dir = home();

  // The synthesized module is reached exactly as the spine reaches it.
  const entry = registry.modulesOf(dir).find((e) => e.id === 'playbooks');
  assert.ok(entry?.module, 'module synthesized from manifest');
  const mod = entry.module;

  // ── mine ── two sessions, one command 3× across 2 sessions (clears defaults).
  const sessions = [
    { sessionId: 's1', commands: [{ cmd: 'npm test', failed: false }, { cmd: 'npm test', failed: false }], files: [], failures: [] },
    { sessionId: 's2', commands: [{ cmd: 'npm test', failed: false }], files: [], failures: [] },
  ];
  const aggregated = mod.miner.aggregate(sessions);
  assert.ok(aggregated.length >= 1, 'aggregate produced a candidate');
  const filed = mod.miner.propose(dir, aggregated);
  assert.ok(filed >= 1, 'at least one proposal filed');

  // ── propose (assert pending on disk) ──
  const pending = listProposals(dir, 'playbooks');
  assert.ok(pending.length >= 1, 'pending proposal present');
  const pid = pending[0].id;

  // ── approve (through the generic gate, which finds the composed adapter) ──
  const r = approve(dir, 'playbooks', pid);
  assert.equal(r.ok, true, 'approve succeeded');
  assert.equal(r.action, 'created');
  const itemId = r.itemIds[0];

  const itemPath = itemPathFor(dir, 'playbooks', itemId);
  assert.ok(existsSync(itemPath), 'item written under playbooks/items/');
  const { ok: parsed, item } = parseEnvelope(readFileSync(itemPath, 'utf8'));
  assert.equal(parsed, true, 'item is a valid envelope');
  assert.equal(item.module, 'playbooks');
  assert.equal(item.kind, 'play');

  // proposal archived as approved
  assert.equal(readArchived(dir, 'playbooks', pid)?.status, 'approved');

  // ── version ── mint a generation; the lockfile pins the new item.
  const lock = mintModuleGeneration(dir, 'playbooks');
  assert.ok(lock.items.some((i) => i.id === itemId), 'generation pins the item');

  // ── recall ── the synthesized query finds it.
  const hits = mod.recall(dir, 'npm test');
  assert.ok(hits.some((h) => h.id === itemId), 'recall returns the item');

  // ── run ── exec.script is composed in: run dispatches to the Actions runner.
  // (Full action execution is the Actions module's own tested surface; here we
  // prove the capability is wired and dispatches fail-soft.)
  assert.equal(typeof mod.run, 'function', 'run wired');
  const ran = mod.run(dir, 'nonexistent-action', {});
  assert.equal(ran.ok, false);
  assert.equal(ran.error, 'not_found');

  // ── the core claim: zero module code, the whole way through. ──
  noModuleCode(dir);
});
