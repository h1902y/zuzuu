// U2 regression — `zz stage --field k=v` must coerce values the SAME way `zz note
// create --field k=v` does (grow/edit.mjs's `coerceForField`), not the identity
// coercion `fieldPairs` defaults to. Before this fix, `stage`'s CLI handler
// (cli/verbs/evolution.mjs) scanned --field with plain fieldPairs(rest) — so
// `--field relations='{"relates-to":["m:id"]}'` landed `relations` as the LITERAL
// STRING (never a map), which validateNote (notes/validate.mjs) rejects at
// approve/commit time — every agent-built graph that reached for the obvious
// `--field` flag either lost its edges outright or never approved at all, while
// the identical `--change '{...}'` body always worked. See docs context: the
// job-search-build repro (29 nodes, 0 links).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../../src/cli/index.mjs';
import { initHome } from '../../src/cli/init.mjs';
import { listStaged } from '../../src/grow/stage.mjs';
import { readNote } from '../../src/notes/repo.mjs';
import { graphData } from '../../src/serve/graph.mjs';
import { open } from '../../src/serve/api.mjs';
import { resetCapabilities } from '../../src/serve/wire.mjs';

async function withRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zz-stage-field-'));
  resetCapabilities();
  const out = [];
  const io = { cwd, log: (s) => out.push(String(s)) };
  try { return await fn({ cwd, home: join(cwd, '.zuzuu'), io, out }); }
  finally { rmSync(cwd, { recursive: true, force: true }); resetCapabilities(); }
}

test('regression: stage --field relations=<json> for a create, once approved, lands a real edge (not a string, not 0 links)', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    // the relation's target must exist for the graph to draw a real link
    assert.equal(await run(['note', 'create', 'companies', 'acme', '--type', 'company', '--field', 'title=Acme', '--json'], io), 0);

    out.length = 0;
    const staged = await run(['stage', 'companies', '--op', 'create', '--target', 'beta', '--field', 'type=company', '--field', 'relations={"relates-to":["companies:acme"]}', '--json'], io);
    assert.equal(staged, 0);
    const rec = listStaged(home, 'companies')[0];
    assert.deepEqual(rec.change.relations, { 'relates-to': ['companies:acme'] }, '--field relations lands as a real MAP in the staged change, not a string');

    out.length = 0;
    assert.equal(await run(['review', 'approve', 'companies', 'beta', '--json'], io), 0, 'approve must succeed — a well-formed relations map is valid');

    const landed = readNote(home, 'companies', 'beta');
    assert.equal(typeof landed.relations, 'object', "the landed note's relations is an object, not a string");
    assert.deepEqual(landed.relations, { 'relates-to': ['companies:acme'] });

    const g = graphData(home);
    assert.equal(g.links.length, 1, 'the graph shows the real edge — not the disconnected 0-links regression');
  });
});

test('parity: --field and --change produce the IDENTICAL typed change for the same relations/date/number input', async () => {
  await withRepo(async ({ home, io }) => {
    initHome(io.cwd);
    const zz = open(io.cwd);
    assert.equal(zz.moduleNew('events', {}).ok, true);
    assert.equal(zz.addColumn('events', 'attendees', 'number', {}).ok, true);
    assert.equal(await run(['note', 'create', 'companies', 'acme', '--type', 'company', '--json'], io), 0);

    await run(['stage', 'events', '--op', 'create', '--target', 'via-field', '--field', 'type=event',
      '--field', 'occurred_on=2026-07-04', '--field', 'attendees=5',
      '--field', 'relations={"relates-to":["companies:acme"]}', '--json'], io);
    await run(['stage', 'events', '--op', 'create', '--target', 'via-change', '--change',
      '{"type":"event","occurred_on":"2026-07-04","attendees":5,"relations":{"relates-to":["companies:acme"]}}', '--json'], io);

    const rows = listStaged(home, 'events');
    const viaField = rows.find((r) => r.target === 'via-field').change;
    const viaChange = rows.find((r) => r.target === 'via-change').change;
    assert.deepEqual(viaField, viaChange, '--field k=v and --change <json> must resolve to the SAME typed change body');
    // pinned expectations, so a drift in either path fails loudly rather than the two just agreeing with each other
    assert.deepEqual(viaField, {
      type: 'event',
      occurred_on: '2026-07-04',
      attendees: 5,
      relations: { 'relates-to': ['companies:acme'] },
    });
  });
});

test('a malformed (non-map) relations value fails validation LOUDLY at approve — never a silent 0-edge landing', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    assert.equal(await run(['note', 'create', 'companies', 'acme', '--type', 'company', '--json'], io), 0);

    // not valid JSON → coerceForField's JSON.parse fails → stays the literal string
    // "companies:acme", exactly the shape validateNote must reject.
    assert.equal(await run(['stage', 'companies', '--op', 'create', '--target', 'delta', '--field', 'type=company', '--field', 'relations=companies:acme', '--json'], io), 0, 'staging itself always succeeds — only approve validates');

    out.length = 0;
    const code = await run(['review', 'approve', 'companies', 'delta', '--json'], io);
    assert.equal(code, 1, 'approve must FAIL, not silently succeed with a stringified relations');
    const err = JSON.parse(out[0]).error;
    assert.match(err, /relations must be a map of type/, 'a clear, specific validation error — not a hang or a silent no-op');

    assert.equal(existsSync(join(home, 'companies', 'items', 'delta.md')), false, 'the malformed note never lands on disk');
    const g = graphData(home);
    assert.equal(g.links.length, 0, 'no phantom edge — and no silently-landed disconnected node either (the note was refused outright)');
  });
});
