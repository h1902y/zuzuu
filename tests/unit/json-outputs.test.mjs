// tests/unit/json-outputs.test.mjs
// The --json outputs the zuzuu-web daemon consumes (status/inbox/generation/digest).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { statusData } from '../../zuzuu/commands/status.mjs';
import { inboxData } from '../../zuzuu/commands/inbox.mjs';
import { generationListData, generationShowData, mintGenerationData, rollbackData } from '../../zuzuu/commands/generation.mjs';
import { evalData } from '../../zuzuu/commands/eval.mjs';
import { proposalsListData } from '../../zuzuu/commands/review.mjs';
import { mintGeneration } from '../../zuzuu/faculty/generation.mjs';
import { writeProposal, makeProposal } from '../../zuzuu/faculty/proposal.mjs';
import { digestData } from '../../zuzuu/commands/digest.mjs';
import { listProposedActions, activateAction, rejectAction } from '../../zuzuu/actions/inbox.mjs';

function withHome(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zjson-'));
  const dir = join(root, '.zuzuu');
  mkdirSync(join(dir, 'knowledge', 'proposals'), { recursive: true });
  try { return fn(dir); } finally { rmSync(root, { recursive: true, force: true }); }
}

// ── Task 5: statusData now includes hosts ────────────────────────────────────

test('statusData reports home, generation, pending map, drift', () => {
  withHome((dir) => {
    const d = statusData(dir, { hosts: [] });
    assert.equal(d.home, true);
    assert.equal(d.activeGeneration, null);          // none minted
    assert.equal(typeof d.pending, 'object');
    assert.equal(d.pending.knowledge, 0);
    assert.equal(d.drift.dirty, false);
  });
});

test('statusData includes hosts array in output', () => {
  withHome((dir) => {
    const d = statusData(dir, { hosts: [{ name: 'claude-code' }] });
    assert.ok(Array.isArray(d.hosts), 'hosts is an array');
    assert.equal(d.hosts[0].name, 'claude-code');
  });
});

test('statusData hosts defaults to an array when no second arg provided', () => {
  withHome((dir) => {
    // default: detected() is called — may return [] or real entries, but must be array
    const d = statusData(dir);
    assert.ok(Array.isArray(d.hosts), 'hosts is present and is an array');
  });
});

// ── Task 1: evalData ─────────────────────────────────────────────────────────

test('evalData returns ranked array with required keys for a seeded proposal', () => {
  withHome((dir) => {
    // seed a pending knowledge proposal
    writeFileSync(
      join(dir, 'knowledge', 'proposals', 'kp1.json'),
      JSON.stringify({
        id: 'kp1',
        faculty: 'knowledge',
        kind: 'item',
        status: 'pending',
        source: 'session-abc',
        candidate: {
          id: 'kp1',
          type: 'fact',
          body: 'use node:sqlite for local storage',
          attributes: {},
          relations: [],
          provenance: [],
        },
        er: { verdict: 'new', confidence: 0.9, reason: 'first observation', match: null },
        evidence: { occurrences: 2 },
        provenance: [{ sessionId: 'session-abc' }],
      }),
    );
    const d = evalData(dir);
    assert.ok(d && typeof d === 'object', 'evalData returns an object');
    assert.ok(Array.isArray(d.ranked), 'ranked is an array');
    assert.ok(d.ranked.length > 0, 'ranked has entries');
    const first = d.ranked[0];
    assert.ok('id' in first, 'has id');
    assert.ok('faculty' in first, 'has faculty');
    assert.ok('title' in first, 'has title');
    assert.ok('score' in first, 'has score');
    assert.ok('confidence' in first, 'has confidence');
    assert.ok('rationale' in first, 'has rationale');
    assert.equal(first.id, 'kp1');
    assert.equal(first.faculty, 'knowledge');
  });
});

test('evalData returns empty ranked array when no proposals', () => {
  withHome((dir) => {
    const d = evalData(dir);
    assert.ok(d && typeof d === 'object');
    assert.ok(Array.isArray(d.ranked));
    assert.equal(d.ranked.length, 0);
  });
});

// ── Task 2: proposals list/approve/reject --json ──────────────────────────────

test('proposalsListData returns {pending:[{id,faculty,title}]}', () => {
  withHome((dir) => {
    const p = makeProposal({
      faculty: 'knowledge', kind: 'item', source: 'sess1',
      payload: { id: 'kfact', type: 'fact', body: 'zero-deps policy', attributes: {}, relations: [] },
    });
    writeProposal(dir, p);
    const d = proposalsListData(dir, 'knowledge');
    assert.ok(Array.isArray(d.pending), 'pending is array');
    assert.ok(d.pending.length > 0, 'has pending items');
    const item = d.pending[0];
    assert.ok('id' in item, 'has id');
    assert.ok('faculty' in item, 'has faculty');
    assert.ok('title' in item, 'has title');
    assert.equal(item.faculty, 'knowledge');
  });
});

test('proposalsListData returns empty pending when no proposals', () => {
  withHome((dir) => {
    const d = proposalsListData(dir);
    assert.ok(Array.isArray(d.pending));
    assert.equal(d.pending.length, 0);
  });
});

// ── Task 3: act inbox|approve|reject data shapes ──────────────────────────────

function withActHome(slug, fn) {
  const root = mkdtempSync(join(tmpdir(), 'zjson-act-'));
  const home = join(root, '.zuzuu');
  const dir = join(home, 'actions', 'inbox', slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'action.json'), JSON.stringify({ slug, kind: 'script', promptSnippet: 'do the thing' }));
  writeFileSync(join(dir, 'run.mjs'), 'export async function main(){ return { ok: true }; }');
  try { return fn(home); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('act inbox --json data shape: {pending:[{slug,...}]}', () => {
  withActHome('do-thing', (home) => {
    const pending = listProposedActions(home);
    const result = { pending };
    assert.ok(Array.isArray(result.pending), 'pending is array');
    assert.ok(result.pending.length > 0, 'has pending items');
    assert.ok('slug' in result.pending[0], 'has slug');
    assert.equal(result.pending[0].slug, 'do-thing');
    // JSON-serialisable
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    assert.equal(parsed.pending[0].slug, 'do-thing');
  });
});

test('act approve --json data shape: {ok,action,slug}', () => {
  withActHome('my-action', (home) => {
    const r = activateAction(home, 'my-action');
    const result = { ok: r.ok, action: r.ok ? 'activated my-action' : r.error, slug: 'my-action' };
    assert.equal(result.ok, true);
    assert.ok('action' in result);
    assert.ok('slug' in result);
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.slug, 'my-action');
  });
});

test('act reject --json data shape: {ok,action,slug}', () => {
  withActHome('bad-action', (home) => {
    const r = rejectAction(home, 'bad-action');
    const result = { ok: r.ok, action: r.ok ? 'rejected bad-action' : r.error, slug: 'bad-action' };
    assert.equal(result.ok, true);
    assert.ok('action' in result);
    assert.ok('slug' in result);
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    assert.equal(parsed.ok, true);
  });
});

// ── Task 4: generation mint --json + rollback --json ─────────────────────────

test('mintGenerationData returns {id,mintedFrom,forkedFrom}', () => {
  withHome((dir) => {
    const d = mintGenerationData(dir, { mintedFrom: [] });
    assert.ok(d && typeof d === 'object', 'returns object');
    assert.match(d.id, /^gen_/, 'id matches gen_ pattern');
    assert.ok(Array.isArray(d.mintedFrom), 'mintedFrom is array');
    assert.ok('forkedFrom' in d, 'has forkedFrom');
  });
});

test('mintGenerationData --from p1,p2 passes through mintedFrom [p1,p2]', () => {
  withHome((dir) => {
    const d = mintGenerationData(dir, { mintedFrom: ['p1', 'p2'] });
    assert.deepEqual(d.mintedFrom, ['p1', 'p2']);
  });
});

test('rollbackData returns {ok,restored,active} with gen_ id', () => {
  withHome((dir) => {
    const minted = mintGeneration(dir, { forkedFrom: null });
    const d = rollbackData(dir, minted.id);
    assert.equal(d.ok, true, 'ok is true');
    assert.equal(typeof d.restored, 'number', 'restored is number');
    assert.ok(d.active, 'has active');
    assert.match(d.active, /^gen_/, 'active matches gen_ pattern');
    // JSON-serialisable
    const parsed = JSON.parse(JSON.stringify(d));
    assert.equal(parsed.ok, true);
  });
});

// ── pre-existing tests (unchanged) ───────────────────────────────────────────

test('inboxData lists pending proposals with faculty + title + total', () => {
  withHome((dir) => {
    writeFileSync(join(dir, 'knowledge', 'proposals', 'p1.json'),
      JSON.stringify({ id: 'p1', kind: 'item', status: 'pending',
        candidate: { id: 'p1', type: 'fact', body: 'use node:sqlite', attributes: {}, relations: [], provenance: [] } }));
    const d = inboxData(dir);
    assert.equal(d.total, 1);
    assert.equal(d.pending[0].faculty, 'knowledge');
    assert.equal(d.pending[0].id, 'p1');
    assert.match(d.pending[0].title, /node:sqlite/);
  });
});

test('generationListData returns active + list; showData returns the diff', () => {
  withHome((dir) => {
    const lf = mintGeneration(dir, { forkedFrom: null });
    const list = generationListData(dir);
    assert.equal(list.active, lf.id);
    assert.equal(list.generations[0].id, lf.id);
    const show = generationShowData(dir, lf.id);
    assert.equal(show.id, lf.id);
    assert.ok(show.faculties && typeof show.faculties === 'object');
    assert.equal(generationShowData(dir, 'gen_999'), null);   // unknown id
  });
});

test('digestData returns { text }', () => {
  withHome((dir) => {
    const d = digestData(dir);
    assert.equal(typeof d.text, 'string');
  });
});
