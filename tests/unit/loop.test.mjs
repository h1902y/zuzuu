// rung 5 — the loop: snapshot · propose · review.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize, parse } from '../../src/notes/note.mjs';
import { mint, generations, rollback } from '../../src/grow/snapshot.mjs';
import { createProposal, listProposals, readProposal } from '../../src/grow/propose.mjs';
import { approve, reject } from '../../src/grow/review.mjs';
import { read } from '../../src/grow/log.mjs';

function withHome(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zuzuu-r5-'));
  const home = join(root, '.zuzuu');
  try { return fn(home); } finally { rmSync(root, { recursive: true, force: true }); }
}
const writeZu = (home, module, id, note) => {
  mkdirSync(join(home, module, 'items'), { recursive: true });
  writeFileSync(join(home, module, 'items', `${id}.md`), serialize({ id, ...note }));
};
const readZu = (home, module, id) => parse(readFileSync(join(home, module, 'items', `${id}.md`), 'utf8'), { id }).note;

// ── gate re-entrancy + fail-soft branch coverage (loop audit gaps) ───────────

test('review: approving twice is idempotent — the second finds no proposal, no double-mint', () => {
  withHome((home) => {
    const p = createProposal(home, 'knowledge', { op: 'create', target: 'fact', change: { type: 'knowledge', title: 'A' } });
    assert.equal(approve(home, 'knowledge', p.id).ok, true);
    // the atomic post-condition of one approve: note + log + a generation + archived proposal
    assert.equal(readZu(home, 'knowledge', 'fact').title, 'A');
    assert.equal(read(home, 'knowledge', 'mutations')[0].event, 'create');
    assert.equal(generations(home, 'knowledge').active, 1);
    assert.equal(readProposal(home, 'knowledge', p.id), null, 'proposal archived');
    // the second approve is a no-op: the proposal is gone → ok:false, generation still 1
    assert.equal(approve(home, 'knowledge', p.id).ok, false);
    assert.equal(generations(home, 'knowledge').active, 1, 'no double-mint');
  });
});

test('propose: a malformed op never reaches the queue (and mints no manifest)', () => {
  withHome((home) => {
    assert.equal(createProposal(home, 'knowledge', { op: 'frobnicate', change: {} }), null);
    assert.equal(listProposals(home, 'knowledge').length, 0, 'nothing staged');
    assert.equal(existsSync(join(home, 'knowledge', 'module.md')), false, 'no manifest minted for a bad op');
  });
});

test('propose: a corrupt proposal file is skipped, not fatal', () => {
  withHome((home) => {
    const p = createProposal(home, 'knowledge', { op: 'create', target: 'x', change: { type: 'knowledge', title: 'x' } });
    writeFileSync(join(home, 'knowledge', 'proposals', 'garbage.json'), '{ not json');
    const list = listProposals(home, 'knowledge');
    assert.equal(list.length, 1, 'the valid proposal survives; the corrupt file is skipped');
    assert.equal(list[0].id, p.id);
  });
});

test('log: read skips a bad line and keeps the rest', () => {
  withHome((home) => {
    mkdirSync(join(home, 'knowledge'), { recursive: true });
    const f = join(home, 'knowledge', 'log.jsonl');
    appendFileSync(f, JSON.stringify({ event: 'create', target: 'a' }) + '\n');
    appendFileSync(f, 'not-json\n');
    appendFileSync(f, JSON.stringify({ event: 'update', target: 'b' }) + '\n');
    assert.deepEqual(read(home, 'knowledge', 'mutations').map((e) => e.event), ['create', 'update']);
  });
});

test('snapshot: the merkle root is deterministic and content-sensitive', () => {
  withHome((home) => {
    writeZu(home, 'knowledge', 'a', { type: 'knowledge', title: 'one' });
    writeZu(home, 'knowledge', 'b', { type: 'knowledge', title: 'two' });
    const g1 = mint(home, 'knowledge');
    const g2 = mint(home, 'knowledge'); // no change between mints
    assert.equal(g1.root, g2.root, 'same items → same root (iteration-order independent)');
    writeZu(home, 'knowledge', 'a', { type: 'knowledge', title: 'one-changed' });
    assert.notEqual(mint(home, 'knowledge').root, g1.root, 'a content change changes the root');
  });
});

test('snapshot: rollback to a non-existent generation is a no-op error', () => {
  withHome((home) => {
    writeZu(home, 'knowledge', 'a', { type: 'knowledge', title: 'one' });
    mint(home, 'knowledge'); // gen 1
    const r = rollback(home, 'knowledge', 99);
    assert.equal(r.ok, false);
    assert.match(r.error, /no generation 99/);
    assert.equal(readZu(home, 'knowledge', 'a').title, 'one', 'on-disk items untouched (no prune ran)');
  });
});

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

test('review: approve a create → writes the note + logs + mints a generation', () => {
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


test('snapshot: rollback prunes notes added after the target generation (no orphan)', () => {
  withHome((home) => {
    writeZu(home, 'knowledge', 'fact', { type: 'knowledge', title: 'v1' });
    mint(home, 'knowledge'); // gen 1 = {fact}
    writeZu(home, 'knowledge', 'later', { type: 'knowledge', title: 'added after gen1' });
    mint(home, 'knowledge'); // gen 2 = {fact, later}
    const r = rollback(home, 'knowledge', 1);
    assert.equal(r.pruned, 1, 'the post-gen note is pruned');
    assert.equal(existsSync(join(home, 'knowledge', 'items', 'later.md')), false, "rollback removed the note that wasn't in gen 1");
    assert.equal(existsSync(join(home, 'knowledge', 'items', 'fact.md')), true, 'the pinned note is restored');
  });
});

test('review: an update merges nested object fields (keeps siblings, no silent loss)', () => {
  withHome((home) => {
    writeZu(home, 'knowledge', 'fact', { type: 'knowledge', relations: { about: 'x', uses: 'y' } });
    const p = createProposal(home, 'knowledge', { op: 'update', target: 'fact', change: { relations: { about: 'z' } } });
    approve(home, 'knowledge', p.id);
    const f = parse(readFileSync(join(home, 'knowledge', 'items', 'fact.md'), 'utf8'), { id: 'fact' }).note;
    assert.deepEqual(f.relations, { about: 'z', uses: 'y' }, "uses survived the partial update");
  });
});

test('review: deleting a non-existent note returns ok:false (no phantom log/mint)', () => {
  withHome((home) => {
    const p = createProposal(home, 'knowledge', { op: 'delete', target: 'ghost' });
    const r = approve(home, 'knowledge', p.id);
    assert.equal(r.ok, false);
    assert.equal(generations(home, 'knowledge').active, null, 'no generation minted for a no-op');
  });
});

test('review: approving a deprecate flips status to deprecated and KEEPS the file', () => {
  withHome((home) => {
    writeZu(home, 'knowledge', 'old', { type: 'knowledge', title: 'stale', status: 'active' });
    const p = createProposal(home, 'knowledge', { op: 'deprecate', target: 'old' });
    const r = approve(home, 'knowledge', p.id);
    assert.equal(r.ok, true);
    assert.equal(existsSync(join(home, 'knowledge', 'items', 'old.md')), true, 'deprecate keeps the file');
    const note = parse(readFileSync(join(home, 'knowledge', 'items', 'old.md'), 'utf8'), { id: 'old' }).note;
    assert.equal(note.status, 'deprecated');
  });
});
