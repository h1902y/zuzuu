// notes/index.mjs — bare-id relation targets resolve to their OWNER module.
// (Regression: a journal note relating to a knowledge id used to get qualified to
// `journal:<id>` — a nonexistent addr — silently losing the backlink and making
// `check` flag a perfectly good edge as broken.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { related, backlinks, brokenLinks } from '../../src/notes/index.mjs';

function withZuzuu(notes, fn) {
  const root = mkdtempSync(join(tmpdir(), 'zuzuu-xlink-'));
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
  // journal note relates to a knowledge note by BARE id — the cross-module case
  'journal:2026-03-31': { type: 'journal-daily', title: 'march import day', relations: { informs: 'muscle-group-map' }, body: 'big day' },
  'knowledge:muscle-group-map': { type: 'concept', title: 'Muscle group map', body: 'the map' },
  // same-module bare id — must keep resolving within the module
  'knowledge:posterior-chain': { type: 'concept', title: 'Posterior chain', relations: { 'builds-on': 'muscle-group-map' }, body: '' },
  // an id owned by TWO modules — ambiguous, must fall back to the source module
  'actions:render': { type: 'action', title: 'render (action)', run: 'true', body: '' },
  'library:render': { type: 'reference', title: 'render (reference)', body: '' },
  'journal:2026-04-01': { type: 'journal-daily', title: 'ambiguous edge', relations: { informs: 'render' }, body: '' },
  // a target that exists nowhere — must stay flagged broken
  'journal:2026-04-02': { type: 'journal-daily', title: 'dangling edge', relations: { informs: 'no-such-note' }, body: '' },
};

test('cross-module bare id resolves to its unique owner module', () => {
  withZuzuu(CORPUS, (home) => {
    // the graph walk reaches the knowledge note from the journal note
    const out = related(home, 'journal:2026-03-31');
    assert.deepEqual(out.map((r) => r.addr), ['knowledge:muscle-group-map']);
    // and the backlink survives: who links TO knowledge:muscle-group-map?
    const back = backlinks(home, 'knowledge:muscle-group-map').map((r) => r.addr);
    assert.ok(back.includes('journal:2026-03-31'), `journal edge lost: ${JSON.stringify(back)}`);
    assert.ok(back.includes('knowledge:posterior-chain'), 'same-module edge lost');
  });
});

test('same-module bare id still resolves within the module', () => {
  withZuzuu(CORPUS, (home) => {
    const out = related(home, 'knowledge:posterior-chain');
    assert.deepEqual(out.map((r) => r.addr), ['knowledge:muscle-group-map']);
  });
});

test('ambiguous bare id falls back to the source module and is flagged broken', () => {
  withZuzuu(CORPUS, (home) => {
    const broken = brokenLinks(home);
    // the ambiguous 'render' edge from journal resolves to journal:render (absent) —
    // flagged, honestly, instead of silently picking an owner
    assert.ok(broken.some((b) => b.src === 'journal:2026-04-01' && b.dst === 'journal:render'),
      `ambiguous edge not flagged: ${JSON.stringify(broken)}`);
  });
});

test('unknown bare id stays flagged broken; resolved cross-module edge is NOT flagged', () => {
  withZuzuu(CORPUS, (home) => {
    const broken = brokenLinks(home);
    assert.ok(broken.some((b) => b.src === 'journal:2026-04-02'), 'dangling edge must stay broken');
    assert.ok(!broken.some((b) => b.src === 'journal:2026-03-31'),
      'the resolved cross-module edge must no longer be false-flagged');
  });
});
