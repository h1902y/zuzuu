// Rung 5/8 — the ONE write boundary: commit() is the sole writer + minter, operator-only.
// Focused tests for the primitive: a multi-op batch mints ONE generation per touched
// module; a mid-batch failure leaves NO partial write (atomic); and THE MOAT — a
// non-operator (the agent) is refused before any write or mint (Rung 8 enforcement).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commit } from '../../src/grow/commit.mjs';
import { generations } from '../../src/notes/generation.mjs';
import { read as readLog } from '../../src/notes/log.mjs';

function withRepo(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-commit-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: root });
  const home = join(root, '.zuzuu');
  try { return fn(home, root); } finally { rmSync(root, { recursive: true, force: true }); }
}
const itemPath = (home, m, id) => join(home, m, 'items', `${id}.md`);

test('commit: a multi-op cross-module batch mints exactly ONE generation per touched module', () => {
  withRepo((home, root) => {
    const batch = [
      { module: 'knowledge', op: 'create', target: 'a', change: { type: 'knowledge', title: 'A' }, id: 'op-a' },
      { module: 'knowledge', op: 'create', target: 'b', change: { type: 'knowledge', title: 'B' }, id: 'op-b' },
      { module: 'actions', op: 'create', target: 'r1', change: { type: 'action', run: 'echo hi' }, id: 'op-r1' },
    ];
    const res = commit(home, { actor: 'operator' }, batch);
    assert.equal(res.ok, true);
    assert.equal(res.results.length, 3, 'every op applied');
    // ONE generation per touched module, in first-touch order
    assert.deepEqual(res.generations, [{ module: 'knowledge', n: 1 }, { module: 'actions', n: 1 }]);
    assert.equal(generations(home, 'knowledge').active, 1, 'knowledge: one generation for the two notes');
    assert.equal(generations(home, 'actions').active, 1);
    for (const [m, id] of [['knowledge', 'a'], ['knowledge', 'b'], ['actions', 'r1']]) {
      assert.ok(existsSync(itemPath(home, m, id)), `${m}:${id} written`);
    }
    // one zz-gen commit per module (not one per note) — the transaction is the unit
    const kgen = execFileSync('git', ['-C', root, 'log', '--format=%s', '--grep', 'zz-gen: knowledge/'], { encoding: 'utf8' });
    assert.equal(kgen.trim().split('\n').length, 1, 'one knowledge generation commit for the whole batch');
  });
});

test('commit: a mid-batch failure is ATOMIC — no partial write, no mint, prior ops reverted', () => {
  withRepo((home) => {
    // op 2 is an invalid action (no `run`) → writeNote refuses it mid-batch
    const batch = [
      { module: 'knowledge', op: 'create', target: 'good', change: { type: 'knowledge', title: 'Good' }, id: 'op-good' },
      { module: 'actions', op: 'create', target: 'bad', change: { type: 'action' }, id: 'op-bad' },
    ];
    const res = commit(home, { actor: 'operator' }, batch);
    assert.equal(res.ok, false);
    assert.equal(res.reverted, true);
    assert.match(res.error, /commit failed on op-bad/);
    // the FIRST op's write was rolled back — nothing partial survives
    assert.equal(existsSync(itemPath(home, 'knowledge', 'good')), false, 'the prior (successful) write was reverted');
    assert.equal(existsSync(itemPath(home, 'actions', 'bad')), false, 'the failing write never landed');
    // no generation minted for either module
    assert.equal(generations(home, 'knowledge').active, null, 'no mint on a failed transaction');
    assert.equal(generations(home, 'actions').active, null);
  });
});

test('commit: THE MOAT — writing is operator-only; a non-operator is refused (no write, no mint)', () => {
  withRepo((home) => {
    // default actor (omitted ctx) is operator → works
    const a = commit(home, undefined, [{ module: 'knowledge', op: 'create', target: 'd1', change: { type: 'knowledge', title: 'D1' }, id: 'op-d1' }]);
    assert.equal(a.ok, true, 'omitting the ctx uses the default actor (operator)');
    // a non-operator (the agent) is REFUSED before any write or mint
    const b = commit(home, { actor: 'agent' }, [{ module: 'knowledge', op: 'create', target: 'd2', change: { type: 'knowledge', title: 'D2' }, id: 'op-d2' }]);
    assert.equal(b.ok, false);
    assert.equal(b.refused, true, 'a non-operator commit is refused');
    assert.equal(existsSync(itemPath(home, 'knowledge', 'd2')), false, 'no note written for an agent commit');
    // the mint stays at d1's generation — no new generation from the refused write
    assert.equal(generations(home, 'knowledge').active, 1, 'no mint on the refused commit');
  });
});

test('commit: the relate op logs as kind `update` and the body bytes are exact (parity with the old evolve)', () => {
  withRepo((home) => {
    commit(home, { actor: 'operator' }, [
      { module: 'knowledge', op: 'create', target: 'f', change: { type: 'knowledge', title: 'F' }, id: 'op-f' },
      { module: 'knowledge', op: 'create', target: 'o', change: { type: 'knowledge', title: 'O' }, id: 'op-o' },
    ]);
    const res = commit(home, { actor: 'operator' }, [
      { module: 'knowledge', op: 'relate', change: { from: 'f', type: 'related-to', to: 'o' }, id: 'op-rel' },
    ]);
    assert.equal(res.ok, true);
    const last = readLog(home, 'knowledge', 'mutations').at(-1);
    assert.equal(last.event, 'update', 'relate is logged as an update of the `from` note');
    assert.equal(last.note, 'f');
    assert.equal(last.relation, 'related-to');
    assert.equal(readFileSync(itemPath(home, 'knowledge', 'f'), 'utf8'),
      '---\ntype: knowledge\ntitle: F\nrelations:\n  related-to: o\n---\n');
  });
});
