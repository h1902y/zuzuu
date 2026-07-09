// tests/unit/verb-aliases.test.mjs — surface-spec.md slice 2: the human verb surface
// (`suggest`/`approvals`/`history`/`collection`) as REAL, QUIET aliases over the
// UNTOUCHED engine canonicals (`stage`/`review`/`gen`/`module`). Pins:
//   1. dispatch  — a human verb produces the exact same bytes as its canonical, with
//                  ZERO deprecation note on either side (quiet ≠ back-compat)
//   2. unchanged — engine canonicals + EXISTING (non-quiet) aliases keep warning
//   3. the moat  — every WRITE human alias is caught by gateWriteVerbPattern()
//                  exactly like its canonical, including `approvals approve|apply`
//                  (a write SUBCOMMAND dispatched inside the bare `review` row, not a
//                  standalone canonical path — the case the exact-path alias match in
//                  writeVerbPaths() can't see without the namespace-alias pass this
//                  slice adds) — and `suggest` is correctly NOT denied (stage is the
//                  agent's sanctioned proposal channel, agentInvokable:true).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../../src/cli/index.mjs';
import { writeVerbPaths, gateWriteVerbPattern } from '../../src/cli/commands.mjs';
import { initHome } from '../../src/cli/init.mjs';
import { serialize } from '../../src/notes/note.mjs';
import { ensureModuleManifest } from '../../src/notes/module-templates.mjs';
import { stageChange } from '../../src/grow/stage.mjs';
import { resetCapabilities } from '../../src/serve/wire.mjs';

async function withRepo(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zz-verbalias-'));
  resetCapabilities();
  try { return await fn({ cwd, home: join(cwd, '.zuzuu') }); }
  finally { rmSync(cwd, { recursive: true, force: true }); resetCapabilities(); }
}
const note = (home, module, id, n) => {
  ensureModuleManifest(home, module);
  mkdirSync(join(home, module, 'items'), { recursive: true });
  writeFileSync(join(home, module, 'items', `${id}.md`), serialize({ id, ...n }));
};
/** Run argv, capturing stdout (`log`) and stderr (`warn`) separately. */
async function capture(argv, cwd) {
  const out = []; const warn = [];
  const code = await run(argv, { cwd, log: (s) => out.push(String(s)), warn: (s) => warn.push(String(s)) });
  return { code, out, warn };
}

// ── 1. quiet dispatch — human verb == canonical, byte-for-byte, zero deprecation ────

test('quiet human read-verbs dispatch to their canonical: identical stdout, no deprecation either side', async () => {
  await withRepo(async ({ cwd }) => {
    initHome(cwd);
    const PAIRS = [
      [['collection', 'list'], ['module', 'list']],
      [['collection', 'overview'], ['module', 'overview']],
      [['history', 'log'], ['gen', 'log']],
    ];
    for (const [humanP, canonP] of PAIRS) {
      const human = await capture(humanP, cwd);
      const canon = await capture(canonP, cwd);
      assert.deepEqual(human.out, canon.out, `'${humanP.join(' ')}' matches '${canonP.join(' ')}' byte-for-byte`);
      assert.equal(human.warn.length, 0, `'${humanP.join(' ')}' emits NO deprecation (quiet)`);
      assert.equal(canon.warn.length, 0, `canonical '${canonP.join(' ')}' emits no deprecation either`);
    }
  });
});

test('`collection items <k>` == `module items <k>` (the module-as-table read, JSON exact)', async () => {
  await withRepo(async ({ cwd, home }) => {
    initHome(cwd);
    note(home, 'knowledge', 'fact', { type: 'knowledge', title: 'Fact' });
    const human = await capture(['collection', 'items', 'knowledge', '--json'], cwd);
    const canon = await capture(['module', 'items', 'knowledge', '--json'], cwd);
    assert.deepEqual(human.out, canon.out);
    assert.equal(human.warn.length, 0);
    assert.equal(canon.warn.length, 0);
    assert.ok(JSON.parse(human.out[0]).items.some((i) => i.id === 'fact'), "the human path's JSON carries the note");
  });
});

test('`history list/diff/rollback` == `gen list/diff/rollback` (usage-error parity, quiet)', async () => {
  await withRepo(async ({ cwd }) => {
    initHome(cwd);
    const PAIRS = [
      [['history', 'list'], ['gen', 'list']],           // both hit the same "usage: zz gen list <module>" error
      [['history', 'diff'], ['gen', 'diff']],
      [['history', 'rollback'], ['gen', 'rollback']],
    ];
    for (const [humanP, canonP] of PAIRS) {
      const human = await capture(humanP, cwd);
      const canon = await capture(canonP, cwd);
      assert.deepEqual(human.out, canon.out, `'${humanP.join(' ')}' == '${canonP.join(' ')}'`);
      assert.equal(human.code, canon.code);
      assert.equal(human.warn.length, 0, `'${humanP.join(' ')}' is quiet`);
    }
  });
});

test('`suggest` behaves exactly like `stage` (usage/err path), quiet, and the real canonical syntax is untouched', async () => {
  await withRepo(async ({ cwd }) => {
    initHome(cwd);
    const human = await capture(['suggest'], cwd);
    const canon = await capture(['stage'], cwd);
    assert.deepEqual(human.out, canon.out, "'suggest' bare == 'stage' bare");
    assert.equal(human.warn.length, 0, "'suggest' is quiet");
    // fail() usage strings were deliberately NOT display-relabeled — they still name
    // the real canonical CLI syntax an agent/human must actually type.
    assert.match(human.out.join('\n'), /usage: zz stage /, 'the fail() usage string still says `zz stage`');
  });
});

test('`approvals` == `review` (bare listing shows the same pending change), quiet', async () => {
  await withRepo(async ({ cwd, home }) => {
    initHome(cwd);
    ensureModuleManifest(home, 'knowledge');
    stageChange(home, 'knowledge', { op: 'create', target: 'fact-x', change: { type: 'knowledge', title: 'Fact X', body: 'hi' } });
    const human = await capture(['approvals'], cwd);
    const canon = await capture(['review'], cwd);
    assert.deepEqual(human.out, canon.out);
    assert.equal(human.warn.length, 0);
    assert.match(human.out.join('\n'), /fact-x/);
  });
});

// ── 2. engine canonicals + EXISTING (non-quiet) aliases are unchanged ───────────────

test('engine canonicals (stage/review/module/gen) still resolve with zero deprecation', async () => {
  await withRepo(async ({ cwd }) => {
    initHome(cwd);
    for (const argv of [['stage'], ['review'], ['module', 'list'], ['gen', 'log']]) {
      const { warn } = await capture(argv, cwd);
      assert.equal(warn.length, 0, `canonical '${argv.join(' ')}' is not an alias — no deprecation`);
    }
  });
});

test('an EXISTING (non-quiet) alias — `merge` — still emits its deprecation note, unaffected by slice 2', async () => {
  await withRepo(async ({ cwd }) => {
    initHome(cwd);
    const { warn } = await capture(['merge'], cwd);
    assert.equal(warn.length, 1, "'merge' still deprecates — only the NEW human-verb rows are quiet");
    assert.match(warn[0], /deprecated/);
    assert.ok(warn[0].includes('note fold'), "points at the canonical 'note fold'");
  });
});

// ── 3. THE MOAT — every write human-verb alias is denied exactly like its canonical ─

test('every WRITE `collection`/`history` alias is caught by gateWriteVerbPattern()', () => {
  const re = new RegExp(gateWriteVerbPattern(), 'i');
  for (const cmd of [
    'zz collection add-field knowledge col text',
    'zz collection new my-collection',
    'zz collection import knowledge --json f.json',
    'zz collection backfill',
    'zz collection change-field knowledge col',
    'zz collection remove-field knowledge col',
    'zz history rollback knowledge 1',
    'zz history mint knowledge',
  ]) assert.ok(re.test(cmd), `gate denies '${cmd}'`);
});

test('the `review` write subcommands are denied through `approvals` too (the namespace-alias gap this slice closes)', () => {
  const re = new RegExp(gateWriteVerbPattern(), 'i');
  assert.ok(re.test('zz approvals approve knowledge fact-x'), "gate denies 'zz approvals approve'");
  assert.ok(re.test('zz approvals apply knowledge'), "gate denies 'zz approvals apply'");
  const paths = writeVerbPaths().map((p) => p.join(' '));
  assert.ok(paths.includes('approvals approve'), 'writeVerbPaths() carries approvals approve');
  assert.ok(paths.includes('approvals apply'), 'writeVerbPaths() carries approvals apply');
  // reject is NOT a declared write-subcommand (mirrors `review reject`) — stays open
  assert.equal(re.test('zz approvals reject knowledge fact-x'), false, "'approvals reject' is not denied (matches 'review reject')");
});

test('the deprecated key-first `<m> rollback` write is denied through the `collection` alias too (the slice-2 review bypass)', () => {
  const re = new RegExp(gateWriteVerbPattern(), 'i');
  // `zz collection <m> rollback <n>` routes into the module handler's key-first genRollback
  // (admin, agent-denied); it must be caught exactly like `zz module <m> rollback` / `zz gen rollback`.
  assert.ok(re.test('zz collection knowledge rollback 3'), "gate denies 'zz collection <m> rollback'");
  assert.ok(re.test('node /x/bin/zuzuu.mjs collection knowledge rollback 3'), 'denied via the binary path too');
  assert.ok(re.test('zz module knowledge rollback 3'), 'canonical key-first still denied');
  for (const open of ['zz collection knowledge generations', 'zz collection knowledge diff 1 2', 'zz collection export knowledge', 'zz collection rollback']) {
    assert.equal(re.test(open), false, `'${open}' stays open through the alias`);
  }
});

test('`suggest` is correctly NOT denied — stage is the agent-sanctioned proposal channel', () => {
  const re = new RegExp(gateWriteVerbPattern(), 'i');
  assert.equal(re.test('zz suggest knowledge --op create --target x'), false, "'suggest' is allowed, mirrors 'stage'");
  const paths = writeVerbPaths().map((p) => p.join(' '));
  assert.ok(!paths.includes('suggest'), 'suggest never enters the deny-path list');
});

test('read human-verb aliases are never denied', () => {
  const re = new RegExp(gateWriteVerbPattern(), 'i');
  for (const cmd of [
    'zz collection list', 'zz collection items knowledge', 'zz collection export knowledge',
    'zz history log', 'zz history list knowledge', 'zz history diff knowledge 1 2',
    'zz approvals knowledge', 'zz approvals plan knowledge',
  ]) assert.equal(re.test(cmd), false, `'${cmd}' is NOT denied`);
});
