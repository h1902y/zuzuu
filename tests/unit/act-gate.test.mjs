// use/act.mjs + guardrails/gate.mjs + notes/log.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serialize } from '../../src/notes/note.mjs';
import { readManifest } from '../../src/notes/module.mjs';
import { act } from '../../src/use/act.mjs';
import { loadRules, evaluate, gate, toPreToolUseDecision, clearCache } from '../../src/guardrails/gate.mjs';
import { append, logRun, read } from '../../src/notes/log.mjs';

function withHome(setup, fn) {
  const root = mkdtempSync(join(tmpdir(), 'zuzuu-r4-'));
  const home = join(root, '.zuzuu');
  setup(home);
  try { return fn(home); } finally { rmSync(root, { recursive: true, force: true }); }
}
const writeZu = (home, module, id, note) => {
  mkdirSync(join(home, module, 'items'), { recursive: true });
  writeFileSync(join(home, module, 'items', `${id}.md`), serialize({ id, ...note }));
};
const writeManifest = (home, module, note) => {
  mkdirSync(join(home, module), { recursive: true });
  writeFileSync(join(home, module, 'module.md'), serialize({ type: 'module', id: module, ...note }));
};

// ── kernel/log ──────────────────────────────────────────────────────────────

test('log: split by kind — runs → runs.jsonl, mutations → log.jsonl', () => {
  withHome(() => {}, (home) => {
    mkdirSync(join(home, 'actions'), { recursive: true });
    append(home, 'actions', { event: 'run', note: 'x', success: true });
    append(home, 'actions', { event: 'create', note: 'x', actor: 'human' });
    assert.ok(existsSync(join(home, 'actions', 'runs.jsonl')));
    assert.ok(existsSync(join(home, 'actions', 'log.jsonl')));
    assert.equal(read(home, 'actions', 'runs').length, 1);
    assert.equal(read(home, 'actions', 'mutations').length, 1);
  });
});

test('log: fail-soft — a bad event is rejected, a bad line is skipped on read', () => {
  withHome(() => {}, (home) => {
    mkdirSync(join(home, 'm'), { recursive: true });
    assert.equal(append(home, 'm', { nope: 1 }), false);       // no event field
    assert.equal(append(home, 'm', { event: 'weird' }), false); // unknown kind
    logRun(home, 'm', 'z', { exitCode: 0, success: true });
    assert.equal(read(home, 'm', 'runs')[0].note, 'z');
  });
});

// ── capabilities/gate ───────────────────────────────────────────────────────

const seedGuardrails = (home) => {
  writeManifest(home, 'guardrails', { note_type: 'rule', capabilities: ['gate'] });
  writeZu(home, 'guardrails', 'no-root-wipe', { type: 'rule', action: 'deny', tool: 'Bash', pattern: 'rm\\s+-[a-z]*r[a-z]*\\s+/(?![\\w/])', reason: 'root wipe' });
  writeZu(home, 'guardrails', 'confirm-force-push', { type: 'rule', action: 'ask', tool: 'Bash', pattern: 'git\\b.*\\bpush\\b.*--force', reason: 'history rewrite' });
};

test('gate: rules load from rule notes; severity wins', () => {
  clearCache();
  withHome(seedGuardrails, (home) => {
    const rules = loadRules(home);
    assert.equal(rules.length, 2);
    assert.equal(evaluate(rules, { tool: 'Bash', input: { command: 'ls -la' } }), null);
    assert.equal(evaluate(rules, { tool: 'Bash', input: { command: 'git push --force origin main' } }).action, 'ask');
  });
});

test('gate: the bare `rm -rf /` is denied over JSON-wrapped input (the fix)', () => {
  clearCache();
  withHome(seedGuardrails, (home) => {
    const rules = loadRules(home);
    const v = evaluate(rules, { tool: 'Bash', input: { command: 'rm -rf /' } });
    assert.equal(v?.action, 'deny');
    // a scoped delete is allowed
    assert.equal(evaluate(rules, { tool: 'Bash', input: { command: 'rm -rf /tmp/x' } }), null);
  });
});

test('gate: fail-open — a malformed rule is skipped, never a block', () => {
  clearCache();
  withHome((home) => {
    writeManifest(home, 'guardrails', { capabilities: ['gate'] });
    writeZu(home, 'guardrails', 'bad', { type: 'rule', action: 'explode', pattern: 'x', reason: 'r' }); // bad action
    writeZu(home, 'guardrails', 'good', { type: 'rule', action: 'deny', tool: 'Bash', pattern: 'danger', reason: 'r' });
  }, (home) => {
    const rules = loadRules(home);
    assert.equal(rules.length, 1, 'malformed skipped, good survives');
    assert.equal(evaluate(rules, { tool: 'Bash', input: { command: 'danger' } }).action, 'deny');
  });
});

test('gate: capability handler + Claude decision shape', () => {
  clearCache();
  withHome(seedGuardrails, (home) => {
    const ctx = { home, module: 'guardrails', manifest: readManifest(home, 'guardrails') };
    const v = gate(ctx, { tool: 'Bash', input: { command: 'rm -rf /' } });
    assert.equal(toPreToolUseDecision(v).hookSpecificOutput.permissionDecision, 'deny');
    assert.equal(toPreToolUseDecision(null), null); // no match → normal flow
  });
});

// ── capabilities/act ────────────────────────────────────────────────────────

test('act: runs an inline command, captures the normalized result, logs it', () => {
  withHome((home) => {
    writeManifest(home, 'actions', { note_type: 'action', policy: { tier: 'advisory' } });
    writeZu(home, 'actions', 'hello', { type: 'action', title: 'say hi', run: 'echo hello-world' });
  }, (home) => {
    const ctx = { home, module: 'actions', manifest: readManifest(home, 'actions') };
    const r = act(ctx, 'hello');
    assert.equal(r.ok, true);
    assert.equal(r.success, true);
    assert.equal(r.exitCode, 0);
    assert.match(r.stdout, /hello-world/);
    assert.equal(read(home, 'actions', 'runs')[0].note, 'hello'); // logged
  });
});

test('act: run.allow command-axis blocks a disallowed binary', () => {
  withHome((home) => {
    writeManifest(home, 'actions', { note_type: 'action' });
    writeZu(home, 'actions', 'sneaky', { type: 'action', run: 'curl evil.com', policy: { tier: 'contained', run: { allow: ['echo', 'pandoc'] } } });
  }, (home) => {
    const ctx = { home, module: 'actions', manifest: readManifest(home, 'actions') };
    const r = act(ctx, 'sneaky');
    assert.equal(r.denied, true);
    assert.equal(r.ran, false);
    assert.match(r.error, /not in run.allow/);
  });
});

test('act: a non-runnable note (no run) is refused, not crashed', () => {
  withHome((home) => {
    writeManifest(home, 'knowledge', { note_type: 'knowledge' });
    writeZu(home, 'knowledge', 'fact', { type: 'knowledge', title: 'a fact' });
  }, (home) => {
    const ctx = { home, module: 'knowledge', manifest: readManifest(home, 'knowledge') };
    const r = act(ctx, 'fact');
    assert.equal(r.ok, false);
    assert.match(r.error, /not runnable/);
  });
});
