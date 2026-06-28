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

// The Tier-2 noun namespaces (Rung 4): every old flat verb still resolves at the top
// level — as a canonical row (Tier-1) OR a deprecating alias — so the switch's surface
// is intact; the only NEW top-level tokens are these five nouns.
const NAMESPACES = ['gen', 'host', 'note', 'registry', 'session'];

/** Resolve a row to the handler it ultimately runs (following an `alias` pointer). */
const canonicalOf = (row) => row.alias
  ? COMMANDS.find((c) => c.path.length === row.alias.length && c.path.every((p, i) => p === row.alias[i]))
  : row;

// ── 1. coverage / parity ────────────────────────────────────────────────────────

test('every old-switch verb resolves to exactly one handler (canonical or via alias)', () => {
  for (const verb of SWITCH_VERBS) {
    const rows = COMMANDS.filter((c) => c.path.length === 1 && c.path[0] === verb);
    assert.equal(rows.length, 1, `verb '${verb}' resolves unambiguously at the top level`);
    const target = canonicalOf(rows[0]);
    assert.ok(target, `verb '${verb}' (alias → ${rows[0].alias?.join(' ') ?? 'self'}) resolves to a row`);
    assert.equal(typeof target.handler, 'function', `verb '${verb}' ultimately runs a handler`);
  }
});

test('the table keeps the switch surface + adds only the five noun namespaces', () => {
  const flatVerbs = [...new Set(COMMANDS.filter((c) => c.path.length === 1).map((c) => c.path[0]))].sort();
  assert.deepEqual(flatVerbs, [...SWITCH_VERBS].sort(), 'every old flat verb still resolves top-level');
  const nouns = [...new Set(COMMANDS.filter((c) => c.path.length > 1).map((c) => c.path[0]))].sort();
  assert.deepEqual(nouns, NAMESPACES, 'the only namespaced paths are note/gen/session/host/registry');
});

test('every NON-alias row carries the help + capability metadata the loop reads', () => {
  const planes = new Set(['data', 'evolution', 'session', 'inspection', 'setup', 'host', 'registry', 'steer']);
  for (const c of COMMANDS) {
    assert.ok(Array.isArray(c.path) && c.path.length >= 1, `${c.path}: path is a non-empty array`);
    if (c.alias) {  // an alias is pure data: { path, alias } → its canonical exists
      assert.ok(canonicalOf(c), `${c.path.join(' ')}: alias points at a real canonical row`);
      continue;
    }
    assert.ok(planes.has(c.plane), `${c.path}: plane '${c.plane}' is a known plane`);
    assert.equal(typeof c.summary, 'string', `${c.path}: has a summary`);
    assert.equal(typeof c.usage, 'string', `${c.path}: has a usage`);
    assert.equal(typeof c.json, 'boolean', `${c.path}: records --json reality`);
  }
});

// ── 2. help completeness ─────────────────────────────────────────────────────────

test('every NON-alias row appears in `zz help` (help cannot drift from the router)', () => {
  const help = helpText();
  for (const c of COMMANDS) {
    if (c.alias) continue;  // aliases are back-compat, not surface — deliberately absent
    assert.ok(help.includes(c.path.join(' ')), `help lists '${c.path.join(' ')}'`);
    assert.ok(help.includes(c.summary), `help shows the summary for '${c.path.join(' ')}'`);
  }
});

test('`zz help` renders the Tier-2 noun namespaces as grouped sections', () => {
  const help = helpText();
  // the namespace headings + a representative canonical path under each
  for (const [heading, path] of [
    ['note — edit notes', 'note fold'],
    ['gen — generations', 'gen log'],
    ['session — the per-session git surface', 'session land'],
    ['host — launch & lifecycle', 'host enable'],
    ['registry — published modules', 'registry subscribe'],
  ]) {
    assert.ok(help.includes(heading), `help has the '${heading}' section`);
    assert.ok(help.includes(path), `help lists '${path}'`);
  }
  // aliases must NOT clutter help (the old flat verbs are gone from the surface)
  assert.ok(!/\n  zz merge /.test(help), 'the deprecated `merge` verb is absent from help');
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

// ── 4. the two-tier grammar — back-compat aliases (Rung 4) ───────────────────────

// renamed verbs whose canonical path runs cleanly with no args (a usage/empty result)
// so old and new can be byte-compared in one repo without mutation/side-effects.
const SAFE_RENAMES = [
  [['merge'], ['note', 'fold']],
  [['patch'], ['note', 'set']],
  [['append'], ['note', 'append']],
  [['rename'], ['note', 'rename']],
  [['refactor'], ['note', 'retype']],
  [['view'], ['note', 'view']],
  [['flow'], ['note', 'flow']],
  [['log'], ['gen', 'log']],
  [['subscribe'], ['registry', 'subscribe']],
];

test('each renamed verb runs its canonical handler + emits exactly one stderr deprecation', async () => {
  await withRepo(async ({ cwd, out }) => {
    initHome(cwd);
    for (const [oldP, newP] of SAFE_RENAMES) {
      out.length = 0; const oldWarn = [];
      await run(oldP, { cwd, log: (s) => out.push(String(s)), warn: (s) => oldWarn.push(String(s)) });
      const oldOut = out.join('\n');
      out.length = 0; const newWarn = [];
      await run(newP, { cwd, log: (s) => out.push(String(s)), warn: (s) => newWarn.push(String(s)) });
      const newOut = out.join('\n');
      assert.equal(oldWarn.length, 1, `'${oldP.join(' ')}' emits exactly one deprecation`);
      assert.match(oldWarn[0], /deprecated/, 'the note names the deprecation');
      assert.ok(oldWarn[0].includes(newP.join(' ')), `'${oldP.join(' ')}' points at '${newP.join(' ')}'`);
      assert.equal(newWarn.length, 0, `canonical '${newP.join(' ')}' emits no deprecation`);
      assert.equal(oldOut, newOut, `'${oldP.join(' ')}' and '${newP.join(' ')}' produce identical stdout`);
    }
  });
});

test('the host-namespace renames deprecate without leaking to stdout', async () => {
  await withRepo(async ({ cwd, out }) => {
    initHome(cwd);
    out.length = 0; const warn = [];
    const code = await run(['enable'], { cwd, log: (s) => out.push(String(s)), warn: (s) => warn.push(String(s)) });
    assert.equal(code, 0, "'enable' still installs the hooks");
    assert.equal(warn.length, 1, "'enable' emits one deprecation");
    assert.ok(warn[0].includes('host enable'), "points at 'host enable'");
    assert.ok(!out.join('\n').includes('deprecated'), 'the deprecation never reaches stdout');
    // the canonical path is clean
    out.length = 0; const warn2 = [];
    await run(['host', 'disable'], { cwd, log: (s) => out.push(String(s)), warn: (s) => warn2.push(String(s)) });
    assert.equal(warn2.length, 0, "'host disable' emits no deprecation");
  });
});

test('the internal (subcommand) renames also deprecate to stderr', async () => {
  await withRepo(async ({ cwd, out }) => {
    initHome(cwd);
    for (const [argv, canonical] of [
      [['module', 'knowledge', 'generations'], 'gen list'],
      [['module', 'knowledge', 'rollback', '1'], 'gen rollback'],
      [['module', 'knowledge', 'diff', '1', '2'], 'gen diff'],
      [['session', 'merge'], 'session land'],
      [['session', 'finalize'], 'session hold'],
      [['session', 'continue'], 'session resume'],
      [['session', 'discard', '--yes'], 'session drop'],
    ]) {
      out.length = 0; const warn = [];
      await run(argv, { cwd, log: (s) => out.push(String(s)), warn: (s) => warn.push(String(s)) });
      assert.equal(warn.length, 1, `'${argv.join(' ')}' emits one deprecation`);
      assert.ok(warn[0].includes(canonical), `'${argv.join(' ')}' points at '${canonical}'`);
    }
  });
});

test('the canonical namespaced verbs resolve with NO deprecation', async () => {
  await withRepo(async ({ cwd, out }) => {
    initHome(cwd);
    for (const argv of [
      ['session', 'land'], ['session', 'hold'], ['session', 'resume'], ['session', 'drop', '--yes'],
      ['gen', 'list', 'knowledge'], ['gen', 'log'], ['note', 'view'],
    ]) {
      out.length = 0; const warn = [];
      await run(argv, { cwd, log: (s) => out.push(String(s)), warn: (s) => warn.push(String(s)) });
      assert.equal(warn.length, 0, `'${argv.join(' ')}' is canonical — no deprecation`);
    }
  });
});

test('daemon-shelled verbs keep clean single-line JSON on stdout (deprecations → warn only)', async () => {
  await withRepo(async ({ home, cwd, out }) => {
    initHome(cwd);
    note(home, 'knowledge', 'fact', { type: 'knowledge', title: 'Fact' });
    for (const [argv, expectWarn] of [
      [['module', 'items', 'knowledge', '--json'], 0],
      [['session', 'status', '--json'], 0],
      [['module', 'knowledge', 'generations', '--json'], 1],  // deprecated AND daemon-shelled
    ]) {
      out.length = 0; const warn = [];
      const code = await run(argv, { cwd, log: (s) => out.push(String(s)), warn: (s) => warn.push(String(s)) });
      assert.equal(code, 0, `${argv.join(' ')} exits 0`);
      assert.equal(out.length, 1, `${argv.join(' ')} → exactly one stdout line`);
      JSON.parse(out[0]);  // throws if a deprecation leaked into the JSON line
      assert.equal(warn.length, expectWarn, `${argv.join(' ')} → ${expectWarn} stderr deprecation(s)`);
    }
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
