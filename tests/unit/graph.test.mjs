// serve/graph.mjs — the project-as-graph document (`zz graph --json`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { graphData } from '../../src/serve/graph.mjs';

function withZuzuu(notes, fn) {
  const root = mkdtempSync(join(tmpdir(), 'zuzuu-graph-'));
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
  'k:hub': { type: 'concept', title: 'The hub', definition: 'central idea', body: 'a body' },
  'k:leaf': { type: 'concept', relations: { 'builds-on': 'k:hub' }, body: '' },
  'j:day': { type: 'journal-daily', relations: { informs: 'hub' }, body: 'notes' }, // bare cross-module → k:hub
  'j:dangler': { type: 'journal-daily', relations: { informs: 'nowhere' }, body: '' },
};

test('graph: addr-keyed nodes, resolved links, degrees', () => {
  withZuzuu(CORPUS, (home) => {
    const g = graphData(home);
    assert.equal(g.nodes.length, 4);
    const hub = g.nodes.find((n) => n.addr === 'k:hub');
    assert.equal(hub.module, 'k');
    assert.equal(hub.hasBody, true);
    assert.equal(hub.degree, 2, 'k:leaf + j:day both point at the hub');
    // links are full-addr pairs; the cross-module bare id resolved to k:hub
    assert.ok(g.links.some((l) => l.source === 'j:day' && l.target === 'k:hub'));
    // the dangling edge is check's business, not the map's
    assert.ok(!g.links.some((l) => l.source === 'j:dangler'));
  });
});

test('graph: props allowlist rides chosen columns; absent by default', () => {
  withZuzuu(CORPUS, (home) => {
    const bare = graphData(home);
    assert.equal(bare.nodes.find((n) => n.addr === 'k:hub').props, undefined);
    const g = graphData(home, { props: ['definition'] });
    assert.equal(g.nodes.find((n) => n.addr === 'k:hub').props.definition, 'central idea');
    assert.equal(g.nodes.find((n) => n.addr === 'k:leaf').props, undefined, 'no declared props → no bag');
  });
});
