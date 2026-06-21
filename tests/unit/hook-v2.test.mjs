// rung 8c — the v2 hook (gate + lifecycle) + enable/disable settings transforms.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gateDecision, handleHook, writeDigest } from '../../src/hosts/hook.mjs';
import { addHooks, removeHooks, isInstalled } from '../../src/cli/enable.mjs';
import { initHome } from '../../src/cli/init.mjs';
import { resetCapabilities } from '../../src/serve/wire.mjs';

function withHome(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zuzuu-hook-'));
  resetCapabilities();
  initHome(cwd); // scaffolds the seed guardrail rules
  try { return fn(cwd); } finally { rmSync(cwd, { recursive: true, force: true }); resetCapabilities(); }
}

// ── the gate (the security-critical path) ─────────────────────────────────────

test('gate: rm -rf / → a deny decision in Claude hook shape', () => {
  withHome((cwd) => {
    const d = gateDecision({ host: 'claude-code', cwd, payload: { tool_name: 'Bash', tool_input: { command: 'rm -rf /' }, session_id: 's1' } });
    assert.equal(d.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(d.hookSpecificOutput.permissionDecisionReason, /no-root-wipe/);
  });
});

test('gate: an innocuous command emits no decision (fail-open / defer)', () => {
  withHome((cwd) => {
    assert.equal(gateDecision({ cwd, payload: { tool_name: 'Bash', tool_input: { command: 'ls -la' }, session_id: 's1' } }), null);
  });
});

test('gate: no guardrails home → null (never blocks)', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'zuzuu-nohome-'));
  try {
    assert.equal(gateDecision({ cwd, payload: { tool_name: 'Bash', tool_input: { command: 'rm -rf /' } } }), null);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test('gate: rm -rf /tmp/x (a real path) is allowed through', () => {
  withHome((cwd) => {
    assert.equal(gateDecision({ cwd, payload: { tool_name: 'Bash', tool_input: { command: 'rm -rf /tmp/x' } } }), null);
  });
});

// ── lifecycle (Design B: signals, fail-open, never throws) ────────────────────

test('lifecycle: OPEN writes the session-start digest to .live/digest.md', () => {
  withHome((cwd) => {
    const r = handleHook({ event: 'SessionStart', host: 'claude-code', cwd, payload: { session_id: 's1' } });
    assert.equal(r.event, 'SessionStart');
    assert.ok(existsSync(join(cwd, '.zuzuu', '.live', 'digest.md')));
    assert.match(readFileSync(join(cwd, '.zuzuu', '.live', 'digest.md'), 'utf8'), /session brief/);
  });
});

test('lifecycle: END mines + writes digest without throwing (no git, no transcripts)', () => {
  withHome((cwd) => {
    const r = handleHook({ event: 'SessionEnd', host: 'claude-code', cwd, payload: { session_id: 's1' } });
    assert.equal(r.event, 'SessionEnd');
  });
});

test('lifecycle: an unhandled event is a no-op', () => {
  withHome((cwd) => {
    assert.equal(handleHook({ event: 'Nonsense', cwd, payload: { session_id: 's1' } }).skipped, 'unhandled event');
  });
});

// ── enable/disable settings transforms ────────────────────────────────────────

test('enable: addHooks installs all events + is idempotent; removeHooks keeps user hooks', () => {
  const user = { hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'my-own-linter' }] }] } };
  const once = addHooks(user);
  assert.equal(isInstalled(once), true);
  const twice = addHooks(once);
  assert.equal(twice.hooks.PreToolUse.length, 2, 'one user + one ours, not duplicated');
  assert.ok(twice.permissions.deny.includes('Read(./.zuzuu/.live/**)'));
  const removed = removeHooks(twice);
  assert.equal(isInstalled(removed), false);
  assert.equal(removed.hooks.PreToolUse.length, 1, 'the user hook survives');
  assert.equal(removed.hooks.PreToolUse[0].hooks[0].command, 'my-own-linter');
});

test('enable: deny rule does NOT block the served module home (only .live)', () => {
  const s = addHooks({});
  assert.deepEqual(s.permissions.deny, ['Read(./.zuzuu/.live/**)']);
  assert.equal(s.permissions.deny.some((r) => r.includes('.traces')), false, 'no dropped-trace-layer deny');
});
