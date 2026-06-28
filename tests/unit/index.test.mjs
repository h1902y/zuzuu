// notes/index.mjs (the query cache) + use/query.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { search, related, backlinks, count, brokenLinks } from '../../src/notes/index.mjs';
import { searchRows } from '../../src/notes/rows.mjs';
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

// ── Rung 7: server-side filter · sort · paginate over a module-as-table ──────
const TABLE = {
  'tasks:alpha': { type: 'task', title: 'Alpha', status: 'active', priority: 'high', body: 'a' },
  'tasks:bravo': { type: 'task', title: 'Bravo', status: 'active', priority: 'low', body: 'b' },
  'tasks:charlie': { type: 'task', title: 'Charlie', status: 'archived', priority: 'high', body: 'c' },
  'tasks:delta': { type: 'task', title: 'Delta', status: 'active', priority: 'high', body: 'd' },
};

test('search: --status filters server-side', () => {
  withZuzuu(TABLE, (home) => {
    assert.deepEqual(search(home, { module: 'tasks', status: 'archived' }).map((r) => r.addr), ['tasks:charlie']);
    assert.equal(search(home, { module: 'tasks', status: 'active' }).length, 3);
  });
});

test('search: --where key=val selects only the matching EAV rows (prop side-table)', () => {
  withZuzuu(TABLE, (home) => {
    const hi = search(home, { module: 'tasks', where: [{ key: 'priority', value: 'high' }] }).map((r) => r.addr).sort();
    assert.deepEqual(hi, ['tasks:alpha', 'tasks:charlie', 'tasks:delta']);
    // repeatable + AND-ed: high AND active narrows further
    const both = search(home, { module: 'tasks', where: [{ key: 'priority', value: 'high' }, { key: 'status', value: 'active' }] }).map((r) => r.addr).sort();
    assert.deepEqual(both, ['tasks:alpha', 'tasks:delta']);
    assert.equal(search(home, { module: 'tasks', where: [{ key: 'priority', value: 'none' }] }).length, 0);
  });
});

test('search: --sort a promoted column asc/desc + --offset slices in SQL', () => {
  withZuzuu(TABLE, (home) => {
    const asc = search(home, { module: 'tasks', sort: { col: 'title' } }).map((r) => r.title);
    assert.deepEqual(asc, ['Alpha', 'Bravo', 'Charlie', 'Delta']);
    const desc = search(home, { module: 'tasks', sort: { col: 'title', desc: true } }).map((r) => r.title);
    assert.deepEqual(desc, ['Delta', 'Charlie', 'Bravo', 'Alpha']);
    // limit + offset page the ordered window
    assert.deepEqual(search(home, { module: 'tasks', sort: { col: 'title' }, limit: 2, offset: 1 }).map((r) => r.title), ['Bravo', 'Charlie']);
  });
});

test('searchRows: filter + sort + paginate returns the page + the pre-paginate total', () => {
  withZuzuu(TABLE, (home) => {
    // --where priority=high (3 match) --sort title --limit 2 --offset 1 → page 2 of 3
    const r = searchRows(home, { module: 'tasks', where: [{ key: 'priority', value: 'high' }], sort: { col: 'title' }, limit: 2, offset: 1 });
    assert.equal(r.total, 3, 'total is the pre-paginate count (all 3 high), not the page size');
    assert.deepEqual(r.items.map((n) => n.id), ['charlie', 'delta']);
    // every frontmatter column survives the hydration (the lossless projection)
    assert.equal(r.items[0].priority, 'high');
  });
});

test('searchRows: an arbitrary EAV column sorts post-hydration, then slices', () => {
  withZuzuu(TABLE, (home) => {
    // `priority` is a custom column (no `notes` column to ORDER BY) → JS sort path
    const desc = searchRows(home, { module: 'tasks', sort: { col: 'priority', desc: true } });
    assert.equal(desc.total, 4);
    // low sorts after high under desc; ties (the 3 highs) break on id
    assert.deepEqual(desc.items.map((n) => n.id), ['bravo', 'alpha', 'charlie', 'delta']);
    // paginate the EAV-sorted set
    const page = searchRows(home, { module: 'tasks', sort: { col: 'priority' }, limit: 2, offset: 0 });
    assert.deepEqual(page.items.map((n) => n.id), ['alpha', 'charlie']); // high (a,c,d) before low; id tiebreak
  });
});

// ── adversarial-review regressions: id substring · stable paging · limit 0 ──────

test('search: a text query also matches the note id as a SUBSTRING (the lost id filter)', () => {
  withZuzuu(CORPUS, (home) => {
    // 'me-st' is a substring of the id 'acme-style' but appears in no title/body token —
    // the old client matched title+body+id; FTS covers title+body, `id LIKE` restores id.
    assert.deepEqual(search(home, { text: 'me-st' }).map((r) => r.addr), ['knowledge:acme-style']);
    assert.equal(count(home, { text: 'me-st' }), 1, 'count uses the same plan — id substring counts too');
    // a text that matches BOTH a title token AND another row's id returns the union
    const acme = search(home, { module: 'knowledge', text: 'acme' }).map((r) => r.addr).sort();
    assert.deepEqual(acme, ['knowledge:acme', 'knowledge:acme-style'], 'fts title hit + id substring hit, unioned');
  });
});

test('search: OFFSET pagination is stable across pages — no dup, no skip (the tiebreak)', () => {
  withZuzuu(TABLE, (home) => {
    // no explicit sort (the FTS-less branch that USED to lack a `, notes.addr` tiebreak);
    // two non-overlapping pages of 2 must together cover the 4-note set exactly once.
    const p0 = search(home, { module: 'tasks', limit: 2, offset: 0 }).map((r) => r.addr);
    const p1 = search(home, { module: 'tasks', limit: 2, offset: 2 }).map((r) => r.addr);
    assert.equal(p0.length, 2);
    assert.equal(p1.length, 2);
    assert.equal(new Set([...p0, ...p1]).size, 4, 'the two pages cover all 4 with no dup/skip');
  });
});

test('search: an explicit limit:0 returns NONE (not the default 50)', () => {
  withZuzuu(TABLE, (home) => {
    assert.equal(search(home, { module: 'tasks', limit: 0 }).length, 0, 'limit 0 means 0 — `Number(limit) || 50` wrongly returned 50');
    assert.equal(search(home, { module: 'tasks' }).length, 4, 'the default (no limit) still returns the set');
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

test('search: a trailing * is a prefix query', () => {
  withZuzuu(CORPUS, (home) => {
    const r = search(home, { text: 'implem*' }); // matches nothing
    assert.equal(r.length, 0);
    const hit = search(home, { text: 'ret*' }); // "retail client" body
    assert.ok(hit.some((x) => x.addr === 'knowledge:acme'), 'ret* prefix-matches "retail"');
  });
});

test('search: BM25 ranks a title match above a body-only match', () => {
  withZuzuu({
    'k:title-hit': { type: 'knowledge', title: 'widget calibration', body: 'unrelated text' },
    'k:body-hit': { type: 'knowledge', title: 'unrelated', body: 'a passing mention of widget here' },
  }, (home) => {
    const r = search(home, { text: 'widget' });
    assert.equal(r.length, 2);
    assert.equal(r[0].addr, 'k:title-hit', 'the title match ranks first (title weighted 10×)');
  });
});

test('search: --full carries a matched-context snippet', () => {
  withZuzuu(CORPUS, (home) => {
    const r = search(home, { text: 'blue', full: true });
    assert.ok(r[0].snippet && r[0].snippet.includes('blue'), 'snippet shows the matched context');
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

test('backlinks: inbound edges — who links TO a note (full + same-module bare-id)', () => {
  withZuzuu({
    'k:hub': { type: 'knowledge', title: 'hub' },
    'k:a': { type: 'knowledge', relations: { uses: 'k:hub' } },         // full addr
    'k:b': { type: 'knowledge', relations: { 'related-to': 'hub' } },   // bare id, same module → k:hub
    'actions:c': { type: 'action', relations: { 'related-to': 'hub' } }, // bare from actions → actions:hub, NOT k:hub
    'k:lonely': { type: 'knowledge', title: 'lonely' },
  }, (home) => {
    const back = backlinks(home, 'k:hub').map((r) => r.addr).sort();
    assert.deepEqual(back, ['k:a', 'k:b'], 'full-addr + same-module bare-id referrers; the cross-module bare ref points elsewhere');
    assert.deepEqual(backlinks(home, 'k:lonely'), [], 'an unreferenced note has no backlinks');
  });
});
