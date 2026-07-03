// use/check.mjs — integrity: broken links · orphans · stale · ungated.
// (Was the biggest coverage hole flagged by the 02-07 product audit: `check` is
// newly load-bearing as the home's trust signal, with no dedicated test.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { check } from '../../src/use/check.mjs';

const checkData = (home) => check({ home });

function withZuzuu(notes, fn) {
  const root = mkdtempSync(join(tmpdir(), 'zuzuu-check-'));
  const home = join(root, '.zuzuu');
  for (const [addr, note] of Object.entries(notes)) {
    const [module, id] = addr.split(':');
    const dir = join(home, module, 'items');
    mkdirSync(dir, { recursive: true });
    // check walks listModules → a module needs its manifest (unlike the raw index)
    writeFileSync(join(home, module, 'module.md'), serialize({ type: 'module', id: module, title: module }));
    writeFileSync(join(dir, `${id}.md`), serialize(note));
  }
  try { return fn(home); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('check: broken links — dangling targets flagged, resolved cross-module edges not', () => {
  withZuzuu({
    'k:hub': { type: 'concept', title: 'hub', body: '' },
    'j:entry': { type: 'journal-daily', relations: { informs: 'hub' }, body: '' },   // resolves → k:hub
    'j:bad': { type: 'journal-daily', relations: { informs: 'ghost-note' }, body: '' }, // dangles
  }, (home) => {
    const r = checkData(home);
    assert.ok(r.broken.some((b) => b.src === 'j:bad'), 'dangling edge flagged');
    assert.ok(!r.broken.some((b) => b.src === 'j:entry'), 'resolved cross-module edge clean');
  });
});

test('check: orphans — unlinked notes surface; linked ones do not', () => {
  withZuzuu({
    'k:hub': { type: 'concept', body: '' },
    'k:leaf': { type: 'concept', relations: { uses: 'k:hub' }, body: '' },
    'k:island': { type: 'concept', body: '' },
  }, (home) => {
    const r = checkData(home);
    const orphans = r.orphans.map((o) => o.addr ?? o);
    assert.ok(orphans.some((a) => String(a).includes('k:island')), 'the unlinked note is an orphan');
    assert.ok(!orphans.some((a) => String(a).includes('k:leaf')), 'a linking note is not an orphan');
  });
});

test('check: ungated — a note with no mutation-log entry is flagged; a logged one is not', () => {
  withZuzuu({
    'k:logged': { type: 'concept', body: '' },
    'k:rogue': { type: 'concept', body: '' },
  }, (home) => {
    // log an entry for one of the two (the shape logMutation writes: `note` carries the id)
    appendFileSync(join(home, 'k', 'log.jsonl'),
      JSON.stringify({ at: '2026-07-02T00:00:00Z', op: 'create', note: 'logged', actor: 'operator' }) + '\n');
    const r = checkData(home);
    const ungated = (r.ungated ?? []).map((u) => u.addr);
    assert.ok(ungated.includes('k:rogue'), 'the unlogged note is ungated');
    assert.ok(!ungated.includes('k:logged'), 'the logged note is gated');
  });
});
