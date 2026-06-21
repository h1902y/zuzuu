// rung 5 — the enhance loop: snapshot · propose · review · enhance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize, parse } from '../../src/kernel/item.mjs';
import { mint, generations, rollback, mintCheckpoint, rollbackCheckpoint } from '../../src/kernel/snapshot.mjs';
import { createProposal, listProposals, readProposal } from '../../src/capabilities/propose.mjs';
import { approve, reject } from '../../src/capabilities/review.mjs';
import { enhance } from '../../src/capabilities/enhance.mjs';
import { logRun, read } from '../../src/kernel/log.mjs';

function withHome(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zuzuu-r5-'));
  const home = join(root, '.zuzuu');
  try { return fn(home); } finally { rmSync(root, { recursive: true, force: true }); }
}
const writeZu = (home, module, id, item) => {
  mkdirSync(join(home, module, 'items'), { recursive: true });
  writeFileSync(join(home, module, 'items', `${id}.md`), serialize({ id, ...item }));
};
const readZu = (home, module, id) => parse(readFileSync(join(home, module, 'items', `${id}.md`), 'utf8'), { id }).item;

// ── snapshot ────────────────────────────────────────────────────────────────

test('snapshot: mint pins items; rollback restores them (pointer-flip)', () => {
  withHome((home) => {
    writeZu(home, 'knowledge', 'fact', { type: 'knowledge', title: 'v1' });
    const g1 = mint(home, 'knowledge');
    assert.equal(g1.n, 1);
    assert.equal(generations(home, 'knowledge').active, 1);

    writeZu(home, 'knowledge', 'fact', { type: 'knowledge', title: 'v2 — changed' });
    mint(home, 'knowledge');
    assert.equal(readZu(home, 'knowledge', 'fact').title, 'v2 — changed');

    const r = rollback(home, 'knowledge', 1);
    assert.equal(r.ok, true);
    assert.equal(readZu(home, 'knowledge', 'fact').title, 'v1', 'restored to gen 1');
    assert.equal(generations(home, 'knowledge').active, 1);
  });
});

test('snapshot: content store dedups identical bytes', () => {
  withHome((home) => {
    writeZu(home, 'knowledge', 'a', { type: 'knowledge', title: 'same' });
    writeZu(home, 'knowledge', 'b', { type: 'knowledge', title: 'same' });
    const g = mint(home, 'knowledge');
    assert.equal(g.items.a, g.items.b, 'identical content → one blob hash');
  });
});

test('snapshot: whole-brain checkpoint pins + rolls back every module', () => {
  withHome((home) => {
    writeZu(home, 'knowledge', 'k', { type: 'knowledge', title: 'k1' });
    writeZu(home, 'actions', 'a', { type: 'action', title: 'a1' });
    mint(home, 'knowledge'); mint(home, 'actions');
    const cp = mintCheckpoint(home, ['knowledge', 'actions'], { label: 'before' });
    // change both, mint, then roll the whole brain back
    writeZu(home, 'knowledge', 'k', { type: 'knowledge', title: 'k2' });
    writeZu(home, 'actions', 'a', { type: 'action', title: 'a2' });
    mint(home, 'knowledge'); mint(home, 'actions');
    rollbackCheckpoint(home, cp.id);
    assert.equal(readZu(home, 'knowledge', 'k').title, 'k1');
    assert.equal(readZu(home, 'actions', 'a').title, 'a1');
  });
});

// ── propose + review (the gate) ─────────────────────────────────────────────

test('propose: stage, rank by score, dedup re-proposals', () => {
  withHome((home) => {
    const p1 = createProposal(home, 'knowledge', { op: 'create', change: { type: 'knowledge', title: 'A' }, score: 5 });
    const p2 = createProposal(home, 'knowledge', { op: 'create', change: { type: 'knowledge', title: 'B' }, score: 9 });
    assert.equal(listProposals(home, 'knowledge')[0].id, p2.id, 'higher score ranks first');
    const dup = createProposal(home, 'knowledge', { op: 'create', change: { type: 'knowledge', title: 'A' }, score: 5 });
    assert.equal(dup.duplicate, true);
    assert.equal(listProposals(home, 'knowledge').length, 2);
  });
});

test('review: approve a create → writes the zu + logs + mints a generation', () => {
  withHome((home) => {
    const p = createProposal(home, 'knowledge', { op: 'create', target: 'blue-decks', change: { type: 'knowledge', title: 'Acme likes blue', body: 'blue' } });
    const r = approve(home, 'knowledge', p.id);
    assert.equal(r.ok, true);
    assert.equal(readZu(home, 'knowledge', 'blue-decks').title, 'Acme likes blue');
    assert.equal(read(home, 'knowledge', 'mutations')[0].event, 'create');
    assert.equal(generations(home, 'knowledge').active, 1, 'a generation was minted');
    assert.equal(readProposal(home, 'knowledge', p.id), null, 'archived (no longer pending)');
  });
});

test('review: approve an update merges the edit; approve a relate adds an edge', () => {
  withHome((home) => {
    writeZu(home, 'knowledge', 'fact', { type: 'knowledge', title: 'old', tags: ['x'] });
    writeZu(home, 'knowledge', 'other', { type: 'knowledge', title: 'other' });
    const up = createProposal(home, 'knowledge', { op: 'update', target: 'fact', change: { title: 'new' } });
    approve(home, 'knowledge', up.id);
    const f = readZu(home, 'knowledge', 'fact');
    assert.equal(f.title, 'new');
    assert.deepEqual(f.tags, ['x'], 'merge — kept existing fields');

    const rel = createProposal(home, 'knowledge', { op: 'relate', change: { from: 'fact', type: 'related-to', to: 'other' } });
    approve(home, 'knowledge', rel.id);
    assert.equal(readZu(home, 'knowledge', 'fact').relations['related-to'], 'other');
  });
});

test('review: reject archives, writes nothing', () => {
  withHome((home) => {
    const p = createProposal(home, 'knowledge', { op: 'create', target: 'x', change: { type: 'knowledge', title: 'x' } });
    reject(home, 'knowledge', p.id, 'not useful');
    assert.equal(existsSync(join(home, 'knowledge', 'items', 'x.md')), false);
    assert.equal(readProposal(home, 'knowledge', p.id), null);
  });
});

// ── enhance (the mining) ────────────────────────────────────────────────────

test('enhance: co-invocation across sessions → a relation proposal', () => {
  withHome((home) => {
    writeZu(home, 'actions', 'pull', { type: 'action', title: 'pull data', run: 'echo a' });
    writeZu(home, 'actions', 'render', { type: 'action', title: 'render', run: 'echo b' });
    // run them together in 2 distinct sessions
    for (const ses of ['s1', 's2']) {
      logRun(home, 'actions', 'pull', { session: ses, exitCode: 0, success: true });
      logRun(home, 'actions', 'render', { session: ses, exitCode: 0, success: true });
    }
    const r = enhance({ home, module: 'actions' }, { threshold: 2 });
    assert.equal(r.proposed, 1);
    assert.equal(r.proposals[0].op, 'relate');
    assert.deepEqual(r.proposals[0].change, { from: 'pull', type: 'related-to', to: 'render' });
  });
});

test('enhance: below the corroboration threshold proposes nothing', () => {
  withHome((home) => {
    writeZu(home, 'actions', 'a', { type: 'action', run: 'echo a' });
    writeZu(home, 'actions', 'b', { type: 'action', run: 'echo b' });
    logRun(home, 'actions', 'a', { session: 's1', success: true });
    logRun(home, 'actions', 'b', { session: 's1', success: true }); // only 1 session
    assert.equal(enhance({ home, module: 'actions' }, { threshold: 2 }).proposed, 0);
  });
});
