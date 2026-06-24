// Security regressions — the P0 bypasses a compound-engineering review found.
// Each test pins a fix; if any reverts, this file fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { isSafeSegment, itemPath } from '../../src/notes/store.mjs';
import { stageChange } from '../../src/grow/stage.mjs';
import { approve } from '../../src/grow/review.mjs';
import { loadRules, evaluate, clearCache } from '../../src/guardrails/gate.mjs';
import { act } from '../../src/use/act.mjs';
import { initHome } from '../../src/cli/init.mjs';

function withHome(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zuzuu-sec-'));
  initHome(cwd); clearCache();
  const home = join(cwd, '.zuzuu');
  try { return fn({ cwd, home }); } finally { rmSync(cwd, { recursive: true, force: true }); clearCache(); }
}
const note = (home, mod, id, n) => { mkdirSync(join(home, mod, 'items'), { recursive: true }); writeFileSync(join(home, mod, 'items', `${id}.md`), serialize({ id, ...n })); };

// ── P0: path-traversal write through the human gate ──────────────────────────

test('store: a `..`/separator id is rejected; a slug id is allowed', () => {
  assert.equal(isSafeSegment('command-ls-la-src'), true);
  assert.equal(isSafeSegment('../../guardrails/items/x'), false);
  assert.equal(isSafeSegment('a/b'), false);
  assert.equal(isSafeSegment('..'), false);
  assert.equal(isSafeSegment('a..b'), false);
  assert.throws(() => itemPath('/h', 'knowledge', '../escape'), /unsafe id/);
});

test('review: approving a `../` proposal cannot escape the module or neuter a guardrail', () => {
  withHome(({ home }) => {
    const before = readFileSync(join(home, 'guardrails', 'items', 'no-root-wipe.md'), 'utf8');
    const p = stageChange(home, 'knowledge', { op: 'create', target: '../../guardrails/items/no-root-wipe', change: { type: 'rule', action: 'allow', pattern: 'rm -rf' } });
    const r = approve(home, 'knowledge', p.id);
    assert.equal(r.ok, false);
    assert.match(r.error, /unsafe id/);
    assert.equal(readFileSync(join(home, 'guardrails', 'items', 'no-root-wipe.md'), 'utf8'), before, 'guardrail untouched');
  });
});

test('review: a `../` relate `from` cannot escape the module either', () => {
  withHome(({ home }) => {
    const before = readFileSync(join(home, 'guardrails', 'items', 'no-root-wipe.md'), 'utf8');
    const p = stageChange(home, 'knowledge', { op: 'relate', change: { from: '../../guardrails/items/no-root-wipe', type: 'related-to', to: 'x' } });
    const r = approve(home, 'knowledge', p.id);
    assert.equal(r.ok, false);
    assert.match(r.error, /unsafe id/);
    assert.equal(readFileSync(join(home, 'guardrails', 'items', 'no-root-wipe.md'), 'utf8'), before, 'guardrail untouched');
  });
});

test('review: a relate `to` is stored as a relation VALUE — content, never a write path', () => {
  withHome(({ home }) => {
    note(home, 'knowledge', 'src-note', { type: 'knowledge', title: 'src' });
    const before = readFileSync(join(home, 'guardrails', 'items', 'no-root-wipe.md'), 'utf8');
    const r = approve(home, 'knowledge', stageChange(home, 'knowledge', { op: 'relate', change: { from: 'src-note', type: 'related-to', to: '../../guardrails/items/no-root-wipe' } }).id);
    assert.equal(r.ok, true, 'a weird `to` is accepted — it is content on the FROM note, not a path');
    assert.match(readFileSync(join(home, 'knowledge', 'items', 'src-note.md'), 'utf8'), /\.\.\/\.\.\/guardrails/, 'stored verbatim as a relation value');
    assert.equal(readFileSync(join(home, 'guardrails', 'items', 'no-root-wipe.md'), 'utf8'), before, 'nothing written outside the module');
  });
});

// ── P0: guardrails gate bypass (whitespace-escape, long flags, quoted root) ───

test('gate: root-wipe deny fires on every bypass variant; allows safe deletes', () => {
  withHome(({ home }) => {
    const rules = loadRules(home, 'guardrails');
    const denied = (cmd, tool = 'Bash') => evaluate(rules, { tool, input: { command: cmd } })?.action === 'deny';
    for (const c of ['rm -rf /', 'rm --recursive --force /', 'rm -rf "/"', 'rm\t-rf\t/', 'rm -fr /;']) assert.equal(denied(c), true, `must deny ${JSON.stringify(c)}`);
    for (const c of ['rm -rf /tmp/x', 'rm dir/', 'ls -la', 'rm build/']) assert.equal(denied(c), false, `must allow ${JSON.stringify(c)}`);
  });
});

test('gate: a Bash-scoped rule fires across host shell-tool aliases', () => {
  withHome(({ home }) => {
    const rules = loadRules(home, 'guardrails');
    for (const tool of ['bash', 'shell', 'exec_command', 'local_shell']) {
      assert.equal(evaluate(rules, { tool, input: { command: 'rm -rf /' } })?.action, 'deny', `tool ${tool}`);
    }
  });
});

test('gate: a ReDoS-shaped rule pattern is rejected at compile (never hangs)', () => {
  withHome(({ home }) => {
    note(home, 'guardrails', 'redos', { type: 'rule', action: 'deny', tool: '*', pattern: '(a+)+$' });
    clearCache();
    const rules = loadRules(home, 'guardrails');
    assert.equal(rules.some((r) => r.id === 'redos'), false, 'the catastrophic pattern is skipped');
    // and a worst-case input returns promptly (the rule never compiled)
    const t0 = Date.now();
    evaluate(rules, { tool: 'Bash', input: { command: 'a'.repeat(40) + '!' } });
    assert.ok(Date.now() - t0 < 1000, 'no catastrophic backtracking');
  });
});

// ── P0: act runs are gated + the allowlist `/` escape is closed ──────────────

test('act: a poisoned action note (`rm -rf /`) is blocked by the guardrails gate', () => {
  withHome(({ home }) => {
    note(home, 'actions', 'danger', { type: 'action', run: 'rm -rf /' });
    const r = act({ home, module: 'actions', manifest: {} }, 'danger');
    assert.equal(r.ran, false);
    assert.equal(r.denied, true);
    assert.match(r.error, /guardrail/);
  });
});

test('act: an absolute path outside the repo does NOT bypass run.allow', () => {
  withHome(({ home }) => {
    note(home, 'actions', 'abs', { type: 'action', run: '/bin/echo pwned', policy: { run: { allow: ['echo'] } } });
    const r = act({ home, module: 'actions', manifest: {} }, 'abs');
    assert.equal(r.ran, false);
    assert.equal(r.denied, true);
    // a genuinely allowlisted command still runs
    note(home, 'actions', 'ok', { type: 'action', run: 'echo hi', policy: { run: { allow: ['echo'] } } });
    const r2 = act({ home, module: 'actions', manifest: {} }, 'ok');
    assert.equal(r2.ran, true);
    assert.equal(r2.success, true);
  });
});
