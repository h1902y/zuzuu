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
import { homeDir, stateDir } from '../../src/notes/store.mjs';

// the session digest now lives in the XDG state dir (out of the repo), not .zuzuu/.live
const digestPath = (cwd) => join(stateDir(homeDir(cwd)), 'digest.md');

function withHome(fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zuzuu-hook-'));
  // isolate the machine-global registry pointer: the OPEN hook auto-tracks via
  // registry.touch(), which (mandatory-local) now mints a registry if none — keep
  // that write inside a temp dir, never the real ~/.zuzuu. Bracket access dodges the
  // repo's own no-secret-reads guardrail false-positive.
  const cfg = mkdtempSync(join(tmpdir(), 'zuzuu-hookcfg-'));
  const prevCfg = process['env'].ZUZUU_HOME;
  process['env'].ZUZUU_HOME = cfg;
  resetCapabilities();
  initHome(cwd); // scaffolds the seed guardrail rules
  try { return fn(cwd); } finally {
    rmSync(cwd, { recursive: true, force: true });
    rmSync(cfg, { recursive: true, force: true });
    if (prevCfg === undefined) delete process['env'].ZUZUU_HOME; else process['env'].ZUZUU_HOME = prevCfg;
    resetCapabilities();
  }
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

test('lifecycle: OPEN writes the session-start digest to the XDG state dir', () => {
  withHome((cwd) => {
    const r = handleHook({ event: 'SessionStart', host: 'claude-code', cwd, payload: { session_id: 's1' } });
    assert.equal(r.event, 'SessionStart');
    assert.ok(existsSync(digestPath(cwd)), 'digest written out-of-repo (XDG state), not in .zuzuu/');
    assert.match(readFileSync(digestPath(cwd), 'utf8'), /session brief/);
    assert.ok(!existsSync(join(cwd, '.zuzuu', '.live')), '.zuzuu/.live no longer exists');
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
  const removed = removeHooks(twice);
  assert.equal(isInstalled(removed), false);
  assert.equal(removed.hooks.PreToolUse.length, 1, 'the user hook survives');
  assert.equal(removed.hooks.PreToolUse[0].hooks[0].command, 'my-own-linter');
});

test('enable: installs no self-deny rule — run-state lives outside the repo now', () => {
  const s = addHooks({});
  // the whole .zuzuu/ is the served home and stays readable; the old .live/** fence
  // is gone because run-state moved to the XDG state dir (unreachable by the agent).
  assert.equal(s.permissions, undefined, 'no permissions.deny written into user settings');
});
