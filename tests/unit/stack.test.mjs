// rung 5+ — the whole v2 stack, end to end, through the ONE registry.
// Builds a real home (module.md manifests + notes), then drives every verb the
// way a host would: registerAll() → invoke(home, module, verb, …).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { invoke } from '../../src/serve/dispatch.mjs';
import { registerAll, resetCapabilities } from '../../src/serve/wire.mjs';
import { gate } from '../../src/guardrails/gate.mjs';
import { createProposal } from '../../src/grow/propose.mjs';
import { approve } from '../../src/grow/review.mjs';
import { generations } from '../../src/grow/snapshot.mjs';

function withStack(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zuzuu-stack-'));
  const home = join(root, '.zuzuu');
  const manifest = (m, caps, extra = {}) => {
    mkdirSync(join(home, m, 'items'), { recursive: true });
    writeFileSync(join(home, m, 'module.md'), serialize({ id: m, type: 'module', title: m, capabilities: caps, ...extra }));
  };
  const note = (m, id, note) => {
    mkdirSync(join(home, m, 'items'), { recursive: true });
    writeFileSync(join(home, m, 'items', `${id}.md`), serialize({ id, ...note }));
  };
  // a small but representative zuzuu
  manifest('knowledge', ['query', 'check'], { note_type: 'knowledge' });
  manifest('actions', ['query', 'check', 'act'], { note_type: 'action' });
  manifest('guardrails', ['check'], { note_type: 'rule' });
  note('knowledge', 'acme-blue', { type: 'knowledge', title: 'Acme prefers blue decks', tags: ['acme', 'design'], body: 'They reject warm palettes.' });
  note('actions', 'greet', { type: 'action', title: 'greet', run: 'echo hello', policy: { tier: 'advisory' } });
  note('guardrails', 'no-rm-root', { type: 'rule', title: 'block rm -rf /', tool: 'Bash', action: 'deny', pattern: 'rm -rf /(?![\\w/])', reason: 'never wipe root' });

  resetCapabilities();
  registerAll();
  try { return fn({ home, note }); } finally { rmSync(root, { recursive: true, force: true }); resetCapabilities(); }
}

test('stack: query finds a note through the registry (universal verb)', () => {
  withStack(({ home }) => {
    const r = invoke(home, 'knowledge', 'query', { text: 'blue' });
    assert.equal(r.ok, true);
    assert.equal(r.value.kind, 'search');
    assert.ok(r.value.rows.some((x) => x.addr === 'knowledge:acme-blue'), 'found the note by FTS');
  });
});

test('stack: a module that does not expose a verb is denied (manifest-gated)', () => {
  withStack(({ home }) => {
    const r = invoke(home, 'knowledge', 'act', 'acme-blue'); // knowledge has no `act`
    assert.equal(r.ok, false);
    assert.equal(r.denied, true);
  });
});

test('stack: act runs a note and reports success', () => {
  withStack(({ home }) => {
    const r = invoke(home, 'actions', 'act', 'greet');
    assert.equal(r.ok, true);
    assert.equal(r.value.ran, true);
    assert.equal(r.value.success, true);
    assert.match(r.value.stdout, /hello/);
  });
});

test('stack: the gate blocks a denied tool call; allows an innocuous one', () => {
  withStack(({ home }) => {
    // the gate is called directly (by act + the hook), not dispatched as a verb
    const blocked = gate({ home, module: 'guardrails' }, { tool: 'Bash', input: { command: 'rm -rf /' } });
    assert.equal(blocked?.action, 'deny');
    const fine = gate({ home, module: 'guardrails' }, { tool: 'Bash', input: { command: 'ls -la' } });
    assert.ok(!fine, 'innocuous call defers to the host (no verdict)');
  });
});

test('stack: check surfaces a broken link', () => {
  withStack(({ home, note }) => {
    note('knowledge', 'dangling', { type: 'knowledge', title: 'points nowhere', relations: { 'related-to': 'knowledge:ghost' } });
    const r = invoke(home, 'knowledge', 'check');
    assert.equal(r.ok, true);
    assert.ok(r.value.broken.length >= 1, 'the dangling relation is reported');
  });
});

test('stack: propose → review writes the zuzuu and mints a generation', () => {
  withStack(({ home }) => {
    // a human-staged proposal flows through the gate end to end
    const p = createProposal(home, 'knowledge', {
      op: 'create', target: 'acme-warm-ban',
      change: { type: 'knowledge', title: 'Never pitch Acme warm palettes', body: 'Hard no.' },
    });
    const r = approve(home, 'knowledge', p.id);
    assert.equal(r.ok, true);
    assert.equal(generations(home, 'knowledge').active, 1);
    // and it is now queryable
    const q = invoke(home, 'knowledge', 'query', { text: 'warm' });
    assert.ok(q.value.rows.some((x) => x.addr === 'knowledge:acme-warm-ban'), 'the approved note is indexed + queryable');
  });
});
