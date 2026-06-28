// command-table — the Rung-1 parity spec: the declarative table (commands.mjs)
// is the single source of truth the router AND `zz help` read. These tests pin
// three properties so the table can't silently drift from the old flat switch:
//   1. coverage  — every verb the old switch reached resolves to a handler row
//   2. help      — every row's path appears in `zz help` (help can't omit a verb)
//   3. parity    — a handful of representative verbs still emit their exact bytes
// The 359 existing tests remain the primary behavioural spec; this file guards the
// refactor's seam (table ↔ router ↔ help) specifically.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../../src/cli/index.mjs';
import { COMMANDS, helpText } from '../../src/cli/commands.mjs';
import { initHome } from '../../src/cli/init.mjs';
import { serialize } from '../../src/notes/note.mjs';
import { ensureModuleManifest } from '../../src/notes/module-templates.mjs';
import { stageChange } from '../../src/grow/stage.mjs';
import { resetCapabilities } from '../../src/serve/wire.mjs';

async function withRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zz-cmdtable-'));
  resetCapabilities();
  const out = [];
  const io = { cwd, log: (s) => out.push(String(s)) };
  try { return await fn({ cwd, home: join(cwd, '.zuzuu'), io, out, text: () => out.join('\n') }); }
  finally { rmSync(cwd, { recursive: true, force: true }); resetCapabilities(); }
}
const note = (home, module, id, n) => {
  ensureModuleManifest(home, module);
  mkdirSync(join(home, module, 'items'), { recursive: true });
  writeFileSync(join(home, module, 'items', `${id}.md`), serialize({ id, ...n }));
};

// The verbs the pre-rung-1 flat switch enumerated (excluding `help`/`--help`/`-h`,
// which the router renders from the table rather than dispatching as a row).
const SWITCH_VERBS = [
  'init', 'validate', 'log', 'query', 'act', 'check', 'observe', 'stage', 'review',
  'flow', 'view', 'patch', 'append', 'rename', 'merge', 'refactor', 'module',
  'session', 'registry', 'subscribe', 'doctor', 'status', 'explain', 'code', 'web',
  'enable', 'disable', 'hook', 'digest', 'start', 'wrap', 'steer',
];

// ── 1. coverage / parity ────────────────────────────────────────────────────────

test('every old-switch verb resolves to exactly one handler row', () => {
  const byVerb = new Map();
  for (const c of COMMANDS) byVerb.set(c.path[0], (byVerb.get(c.path[0]) ?? 0) + 1);
  for (const verb of SWITCH_VERBS) {
    const row = COMMANDS.find((c) => c.path.length === 1 && c.path[0] === verb);
    assert.ok(row, `verb '${verb}' has a table row`);
    assert.equal(typeof row.handler, 'function', `verb '${verb}' row has a handler`);
    assert.equal(byVerb.get(verb), 1, `verb '${verb}' resolves unambiguously`);
  }
});

test('the table covers the switch and adds no phantom top-level verbs', () => {
  const rowVerbs = COMMANDS.map((c) => c.path[0]).sort();
  assert.deepEqual(rowVerbs, [...SWITCH_VERBS].sort(), 'table verbs ≡ switch verbs');
});

test('every row carries the help + capability metadata the loop reads', () => {
  const planes = new Set(['data', 'evolution', 'session', 'inspection', 'setup', 'host', 'registry', 'steer']);
  for (const c of COMMANDS) {
    assert.ok(Array.isArray(c.path) && c.path.length >= 1, `${c.path}: path is a non-empty array`);
    assert.ok(planes.has(c.plane), `${c.path}: plane '${c.plane}' is a known plane`);
    assert.equal(typeof c.summary, 'string', `${c.path}: has a summary`);
    assert.equal(typeof c.usage, 'string', `${c.path}: has a usage`);
    assert.equal(typeof c.json, 'boolean', `${c.path}: records --json reality`);
  }
});

// ── 2. help completeness ─────────────────────────────────────────────────────────

test('every table row appears in `zz help` (help cannot drift from the router)', () => {
  const help = helpText();
  for (const c of COMMANDS) {
    assert.ok(help.includes(c.path.join(' ')), `help lists '${c.path.join(' ')}'`);
    assert.ok(help.includes(c.summary), `help shows the summary for '${c.path.join(' ')}'`);
  }
});

test('`zz help` (and its aliases) render the folded table, exit 0', async () => {
  for (const argv of [['help'], [], ['--help'], ['-h']]) {
    const out = [];
    assert.equal(await run(argv, { cwd: '/', log: (s) => out.push(String(s)) }), 0, `${JSON.stringify(argv)} exits 0`);
    assert.match(out.join('\n'), /your repo's Project/);
    assert.match(out.join('\n'), /grow the Project/);   // a plane heading proves the fold ran
  }
});

// ── 3. no-behaviour-change spot checks (the router still routes to the same bytes) ─

test('an unknown verb is a structured error + exit 1 (unchanged)', async () => {
  const out = [];
  assert.equal(await run(['definitely-not-a-verb'], { cwd: '/', log: (s) => out.push(String(s)) }), 1);
  assert.match(out.join('\n'), /unknown verb 'definitely-not-a-verb' — try: zz help/);
});

test('query routes to the TOON note rows', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    note(home, 'knowledge', 'acme', { type: 'knowledge', title: 'Acme likes blue', body: 'blue decks' });
    out.length = 0;
    assert.equal(await run(['query', 'knowledge', 'blue'], io), 0);
    assert.match(out.join('\n'), /knowledge:acme/);
  });
});

test('module items routes the subcommand-first read (the daemon shells this)', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    note(home, 'knowledge', 'fact', { type: 'knowledge', title: 'Fact' });
    out.length = 0;
    assert.equal(await run(['module', 'items', 'knowledge', '--json'], io), 0);
    assert.equal(out.length, 1, 'single JSON line');
    const parsed = JSON.parse(out[0]);
    assert.ok(Array.isArray(parsed.items));
    assert.ok(parsed.items.some((i) => i.id === 'fact'), 'the note is listed');
  });
});

test('session status --json routes to the daemon-shaped single JSON line', async () => {
  await withRepo(async ({ io, out }) => {
    initHome(io.cwd);
    out.length = 0;
    assert.equal(await run(['session', 'status', '--json'], io), 0);
    assert.equal(out.length, 1);
    const parsed = JSON.parse(out[0]);
    assert.deepEqual(Object.keys(parsed).sort(), ['active', 'enabled', 'held', 'main', 'onSessionBranch'].sort());
  });
});

test('review lists the staged change by its human handle', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    stageChange(home, 'knowledge', { op: 'create', target: 'fact-x', change: { type: 'knowledge', title: 'Fact X', body: 'hi' } });
    out.length = 0;
    assert.equal(await run(['review'], io), 0);
    assert.match(out.join('\n'), /fact-x/);
  });
});

test('stage rescans raw argv for repeated --field k=v (the quirk survives)', async () => {
  await withRepo(async ({ home, io, out }) => {
    initHome(io.cwd);
    ensureModuleManifest(home, 'knowledge');
    out.length = 0;
    const code = await run(
      ['stage', 'knowledge', '--op', 'create', '--target', 'multi', '--field', 'type=knowledge', '--field', 'title=First', '--field', 'body=Hello'],
      io,
    );
    assert.equal(code, 0);
    assert.match(out.join('\n'), /staged\[/, 'TOON staged receipt emitted');
    // all three --field pairs accumulated (the raw-argv rescan): parseArgs alone
    // would keep only the LAST --field, so the staged change would miss type+title.
    const dir = join(home, 'knowledge', 'staged');
    const blob = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
    for (const fragment of ['knowledge', 'First', 'Hello']) {
      assert.ok(blob.includes(fragment), `staged change carries '${fragment}' (every --field landed)`);
    }
  });
});
