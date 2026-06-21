// kernel/index.mjs + capabilities/query.mjs — the query engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { search, related, count, brokenLinks } from '../../src/notes/index.mjs';
import { queryData } from '../../src/use/query.mjs';
import { toon } from '../../src/notes/toon.mjs';

// build a temp .zuzuu home with some zus and hand back the home dir
function withBrain(zus, fn) {
  const root = mkdtempSync(join(tmpdir(), 'zuzuu-index-'));
  const home = join(root, '.zuzuu');
  for (const [addr, item] of Object.entries(zus)) {
    const [module, id] = addr.split(':');
    const dir = join(home, module, 'items');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${id}.md`), serialize(item));
  }
  try { return fn(home); } finally { rmSync(root, { recursive: true, force: true }); }
}

const CORPUS = {
  'knowledge:acme-style': { type: 'knowledge', title: 'Acme prefers minimal blue decks', tags: ['client-acme', 'design'], body: 'blue accent on white' },
  'knowledge:acme': { type: 'knowledge', title: 'Acme Corp', tags: ['client-acme'], body: 'a retail client' },
  'actions:build-report': { type: 'action', title: 'Build the report', tags: ['reporting'], relations: { uses: 'knowledge:acme-style' }, body: 'render the deck' },
};

test('search: by free text (FTS5)', () => {
  withBrain(CORPUS, (home) => {
    const r = search(home, { text: 'blue' });
    assert.equal(r.length, 1);
    assert.equal(r[0].addr, 'knowledge:acme-style');
    assert.equal(r[0].body, undefined, 'brief by default — no body');
  });
});

test('search: --full includes the body', () => {
  withBrain(CORPUS, (home) => {
    const r = search(home, { text: 'blue', full: true });
    assert.equal(r[0].body, 'blue accent on white');
  });
});

test('search: filter by type, module, tag', () => {
  withBrain(CORPUS, (home) => {
    assert.equal(search(home, { type: 'action' }).length, 1);
    assert.equal(search(home, { module: 'knowledge' }).length, 2);
    assert.equal(search(home, { tag: 'client-acme' }).length, 2);
    assert.equal(search(home, { tag: 'design' }).length, 1);
  });
});

test('related: walk relations by depth (recursive CTE)', () => {
  withBrain(CORPUS, (home) => {
    const r = related(home, 'actions:build-report', { depth: 1 });
    assert.equal(r.length, 1);
    assert.equal(r[0].addr, 'knowledge:acme-style');
    assert.equal(r[0].hop, 1);
  });
});

test('count: the --dry-run lever (no materialize)', () => {
  withBrain(CORPUS, (home) => {
    assert.equal(count(home, { module: 'knowledge' }), 2);
  });
});

test('brokenLinks: a relation to a missing zu is surfaced', () => {
  const broken = { ...CORPUS, 'actions:orphan': { type: 'action', title: 'x', relations: { uses: 'knowledge:gone' }, body: 'y' } };
  withBrain(broken, (home) => {
    const bl = brokenLinks(home);
    assert.ok(bl.some((l) => l.src === 'actions:orphan' && l.dst === 'knowledge:gone'));
  });
});

test('index rebuilds when a file changes (staleness)', () => {
  withBrain(CORPUS, (home) => {
    assert.equal(search(home, { text: 'blue' }).length, 1);
    // add a new zu after the first build
    const dir = join(home, 'knowledge', 'items');
    writeFileSync(join(dir, 'new.md'), serialize({ type: 'knowledge', title: 'new blue thing', body: 'more blue' }));
    assert.equal(search(home, { text: 'blue' }).length, 2, 'rebuild picked up the new file');
  });
});

test('queryData: dry-run, related, search shapes', () => {
  withBrain(CORPUS, (home) => {
    assert.equal(queryData(home, { dryRun: true, module: 'knowledge' }).kind, 'count');
    assert.equal(queryData(home, { from: 'actions:build-report', depth: 1 }).kind, 'related');
    assert.equal(queryData(home, { text: 'blue' }).rows.length, 1);
  });
});

test('toon: token-dense list + empty zero-state', () => {
  const out = toon('zus', [{ addr: 'k:a', type: 'knowledge', title: 'A' }], ['addr', 'type', 'title']);
  assert.match(out, /^zus\[1\]\{addr,type,title\}:/);
  assert.match(out, /\n {2}k:a,knowledge,A/);
  assert.match(toon('zus', [], ['addr']), /^zus\[0\]: \(none\)/);
});

test('toon: values with commas are quoted', () => {
  const out = toon('zus', [{ title: 'a, b, c' }], ['title']);
  assert.match(out, /"a, b, c"/);
});
