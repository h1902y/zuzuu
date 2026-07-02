// Query engine v2 (Phase 4): EAV comparison operators + group-by/aggregate +
// the CSV table boundary.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { search, aggregate, count } from '../../src/notes/index.mjs';
import { toCsv, parseCsv } from '../../src/use/table.mjs';
import { parseWhere } from '../../src/cli/commands.mjs';

function withZuzuu(notes, fn) {
  const root = mkdtempSync(join(tmpdir(), 'zuzuu-qv2-'));
  const home = join(root, '.zuzuu');
  for (const [addr, note] of Object.entries(notes)) {
    const [module, id] = addr.split(':');
    const dir = join(home, module, 'items');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${id}.md`), serialize(note));
  }
  try { return fn(home); } finally { rmSync(root, { recursive: true, force: true }); }
}

const CORPUS = {
  'a:one': { type: 'activity', status: 'active', start_date: '2026-06-01', duration_days: 30, priority: 'high', body: '' },
  'a:two': { type: 'activity', status: 'active', start_date: '2026-07-10', duration_days: 7, priority: 'low', body: '' },
  'a:three': { type: 'activity', status: 'deferred', start_date: '2026-05-01', duration_days: 90, priority: 'high', body: '' },
};

test('where: date ranges compare lexicographically (ISO)', () => {
  withZuzuu(CORPUS, (home) => {
    const r = search(home, { module: 'a', where: [{ key: 'start_date', op: '<=', value: '2026-07-02' }] });
    assert.deepEqual(r.map((x) => x.addr).sort(), ['a:one', 'a:three']);
  });
});

test('where: numeric ranges compare numerically (9 < 10)', () => {
  withZuzuu(CORPUS, (home) => {
    const r = search(home, { module: 'a', where: [{ key: 'duration_days', op: '>', value: '9' }] });
    assert.deepEqual(r.map((x) => x.addr).sort(), ['a:one', 'a:three'], '30 and 90 exceed 9; 7 does not');
  });
});

test('where: != and stacked filters AND together; count agrees', () => {
  withZuzuu(CORPUS, (home) => {
    const where = [{ key: 'priority', op: '!=', value: 'low' }, { key: 'status', op: '=', value: 'active' }];
    const r = search(home, { module: 'a', where });
    assert.deepEqual(r.map((x) => x.addr), ['a:one']);
    assert.equal(count(home, { module: 'a', where }), 1);
  });
});

// node:sqlite rows are null-prototype objects — strip for deepEqual
const plain = (rows) => JSON.parse(JSON.stringify(rows));

test('aggregate: group-by with count and sum', () => {
  withZuzuu(CORPUS, (home) => {
    const byStatus = plain(aggregate(home, { module: 'a', groupBy: 'status' }));
    assert.deepEqual(byStatus, [
      { value: 'active', n: 2 },
      { value: 'deferred', n: 1 },
    ]);
    const summed = aggregate(home, { module: 'a', groupBy: 'status', agg: { fn: 'sum', field: 'duration_days' } });
    assert.equal(summed.find((r) => r.value === 'active').agg, 37);
    assert.equal(summed.find((r) => r.value === 'deferred').agg, 90);
  });
});

test('aggregate: composes with where filters', () => {
  withZuzuu(CORPUS, (home) => {
    const rows = plain(aggregate(home, {
      module: 'a', groupBy: 'priority',
      where: [{ key: 'start_date', op: '<=', value: '2026-07-02' }],
    }));
    assert.deepEqual(rows, [{ value: 'high', n: 2 }]);
  });
});

test('parseWhere: longest operator wins; bare pair without op is null', () => {
  assert.deepEqual(parseWhere('d>=5'), { key: 'd', op: '>=', value: '5' });
  assert.deepEqual(parseWhere('k!=x'), { key: 'k', op: '!=', value: 'x' });
  assert.deepEqual(parseWhere('k=a=b'), { key: 'k', op: '=', value: 'a=b' });
  assert.equal(parseWhere('nonsense'), null);
});

test('csv: rows round-trip (quotes, commas, newlines, lists, numbers)', () => {
  const rows = [
    { id: 'a', type: 'account', title: 'Acme, Inc.', tier: 3, tags: ['x', 'y'], body: 'line1\nline2' },
    { id: 'b', type: 'account', title: 'Say "hi"', tier: 1 },
  ];
  const back = parseCsv(toCsv(rows));
  assert.equal(back.length, 2);
  assert.equal(back[0].title, 'Acme, Inc.');
  assert.equal(back[0].tier, 3, 'numbers revive');
  assert.deepEqual(back[0].tags, ['x', 'y'], 'lists revive from JSON cells');
  assert.equal(back[0].body, 'line1\nline2', 'embedded newlines survive');
  assert.equal(back[1].title, 'Say "hi"');
  assert.equal(back[1].tags, undefined, 'empty cells skip');
});
