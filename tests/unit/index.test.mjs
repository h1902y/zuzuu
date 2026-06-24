// notes/index.mjs (the query cache) + use/query.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { search, related, count, brokenLinks } from '../../src/notes/index.mjs';
import { queryData } from '../../src/use/query.mjs';
import { toon } from '../../src/notes/toon.mjs';

// build a temp .zuzuu home with some notes and hand back the home dir
function withZuzuu(notes, fn) {
  const root = mkdtempSync(join(tmpdir(), 'zuzuu-index-'));
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
  'knowledge:acme-style': { type: 'knowledge', title: 'Acme prefers minimal blue decks', tags: ['client-acme', 'design'], body: 'blue accent on white' },
  'knowledge:acme': { type: 'knowledge', title: 'Acme Corp', tags: ['client-acme'], body: 'a retail client' },
  'actions:build-report': { type: 'action', title: 'Build the report', tags: ['reporting'], relations: { uses: 'knowledge:acme-style' }, body: 'render the deck' },
};

test('search: by free text (FTS5)', () => {
  withZuzuu(CORPUS, (home) => {
    const r = search(home, { text: 'blue' });
    assert.equal(r.length, 1);
    assert.equal(r[0].addr, 'knowledge:acme-style');
    assert.equal(r[0].body, undefined, 'brief by default — no body');
  });
});

test('search: --full includes the body', () => {
  withZuzuu(CORPUS, (home) => {
    const r = search(home, { text: 'blue', full: true });
    assert.equal(r[0].body, 'blue accent on white');
  });
});

test('search: filter by type, module, tag', () => {
  withZuzuu(CORPUS, (home) => {
    assert.equal(search(home, { type: 'action' }).length, 1);
    assert.equal(search(home, { module: 'knowledge' }).length, 2);
    assert.equal(search(home, { tag: 'client-acme' }).length, 2);
    assert.equal(search(home, { tag: 'design' }).length, 1);
  });
});

test('related: walk relations by depth (recursive CTE)', () => {
  withZuzuu(CORPUS, (home) => {
    const r = related(home, 'actions:build-report', { depth: 1 });
    assert.equal(r.length, 1);
    assert.equal(r[0].addr, 'knowledge:acme-style');
    assert.equal(r[0].hop, 1);
  });
});

test('count: the --dry-run lever (no materialize)', () => {
  withZuzuu(CORPUS, (home) => {
    assert.equal(count(home, { module: 'knowledge' }), 2);
  });
});

test('brokenLinks: a relation to a missing note is surfaced', () => {
  const broken = { ...CORPUS, 'actions:orphan': { type: 'action', title: 'x', relations: { uses: 'knowledge:gone' }, body: 'y' } };
  withZuzuu(broken, (home) => {
    const bl = brokenLinks(home);
    assert.ok(bl.some((l) => l.src === 'actions:orphan' && l.dst === 'knowledge:gone'));
  });
});

test('index rebuilds when a file changes (staleness)', () => {
  withZuzuu(CORPUS, (home) => {
    assert.equal(search(home, { text: 'blue' }).length, 1);
    // add a new note after the first build
    const dir = join(home, 'knowledge', 'items');
    writeFileSync(join(dir, 'new.md'), serialize({ type: 'knowledge', title: 'new blue thing', body: 'more blue' }));
    assert.equal(search(home, { text: 'blue' }).length, 2, 'rebuild picked up the new file');
  });
});

test('queryData: dry-run, related, search shapes', () => {
  withZuzuu(CORPUS, (home) => {
    assert.equal(queryData(home, { dryRun: true, module: 'knowledge' }).kind, 'count');
    assert.equal(queryData(home, { from: 'actions:build-report', depth: 1 }).kind, 'related');
    assert.equal(queryData(home, { text: 'blue' }).rows.length, 1);
  });
});

test('toon: token-dense list + empty zero-state', () => {
  const out = toon('notes', [{ addr: 'k:a', type: 'knowledge', title: 'A' }], ['addr', 'type', 'title']);
  assert.match(out, /^notes\[1\]\{addr,type,title\}:/);
  assert.match(out, /\n {2}k:a,knowledge,A/);
  assert.match(toon('notes', [], ['addr']), /^notes\[0\]: \(none\)/);
});

test('toon: values with commas are quoted', () => {
  const out = toon('notes', [{ title: 'a, b, c' }], ['title']);
  assert.match(out, /"a, b, c"/);
});

test('search: FTS metacharacters never crash (sanitized) but still match', () => {
  withZuzuu(CORPUS, (home) => {
    // each of these is a live FTS5 query metacharacter that used to throw SqliteError
    for (const text of ['"unbalanced', 'acme:style', 'a AND', 'foo*bar:', 'a OR b']) {
      assert.doesNotThrow(() => search(home, { text }), `search(${JSON.stringify(text)}) must not throw`);
    }
    // a normal multi-word query still matches (tokens ANDed)
    const r = search(home, { text: 'blue accent' });
    assert.equal(r.length, 1);
    assert.equal(r[0].addr, 'knowledge:acme-style');
  });
});

test('related: transitive walk (depth ≥ 2) returns correct hops', () => {
  withZuzuu({
    'k:a': { type: 'knowledge', relations: { uses: 'k:b' } },
    'k:b': { type: 'knowledge', relations: { uses: 'k:c' } },
    'k:c': { type: 'knowledge', title: 'c' },
  }, (home) => {
    assert.deepEqual(related(home, 'k:a', { depth: 2 }).map((r) => [r.addr, r.hop]), [['k:b', 1], ['k:c', 2]]);
    assert.deepEqual(related(home, 'k:a', { depth: 1 }).map((r) => r.addr), ['k:b']);
  });
});

test('related: a cycle terminates and stays bounded (UNION, not UNION ALL)', () => {
  withZuzuu({
    'k:a': { type: 'knowledge', relations: { uses: 'k:b' } },
    'k:b': { type: 'knowledge', relations: { uses: 'k:a' } },
  }, (home) => {
    const r = related(home, 'k:a', { depth: 3 }); // the test completing at all proves it terminates
    assert.ok(r.some((x) => x.addr === 'k:b'));
    assert.ok(r.length <= 3, 'bounded by depth — no infinite expansion');
  });
});

test('related: the type filter restricts the edge type', () => {
  withZuzuu({
    'k:a': { type: 'knowledge', relations: { uses: 'k:b', about: 'k:c' } },
    'k:b': { type: 'knowledge', title: 'b' },
    'k:c': { type: 'knowledge', title: 'c' },
  }, (home) => {
    assert.deepEqual(related(home, 'k:a', { depth: 1, type: 'uses' }).map((r) => r.addr), ['k:b']);
    assert.equal(related(home, 'k:a', { depth: 1 }).length, 2, 'untyped returns both edges');
  });
});

test('index self-heals from a corrupt .index.db (rebuilds, never throws)', () => {
  withZuzuu(CORPUS, (home) => {
    assert.equal(search(home, { text: 'blue' }).length, 1); // build the db
    writeFileSync(join(home, '.index.db'), 'GARBAGE NOT SQLITE'); // corrupt it
    assert.equal(search(home, { text: 'blue' }).length, 1, 'rebuilt from the files');
  });
});

test('related: an array-valued relation indexes every target', () => {
  withZuzuu({
    'k:a': { type: 'knowledge', relations: { uses: ['k:b', 'k:c'] } },
    'k:b': { type: 'knowledge', title: 'b' },
    'k:c': { type: 'knowledge', title: 'c' },
  }, (home) => {
    assert.deepEqual(related(home, 'k:a', { depth: 1 }).map((r) => r.addr).sort(), ['k:b', 'k:c']);
  });
});

test('related: follows a BARE-id relation target (the shape observe/relate write)', () => {
  withZuzuu({
    'actions:pull': { type: 'action', relations: { 'related-to': 'render' } }, // bare id, not 'actions:render'
    'actions:render': { type: 'action', title: 'render' },
  }, (home) => {
    const hits = related(home, 'actions:pull', { depth: 1 });
    assert.ok(hits.some((r) => r.addr === 'actions:render'), 'bare-id target resolves to the full addr in the walk');
  });
});
