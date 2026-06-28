import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { homeDir, stateDir } from '../../src/notes/store.mjs';

// The temp project isn't a git repo, so repoRoot falls back to the path as-is; the
// gate subprocess resolves its cwd through macOS's /var→/private/var symlink, so
// match it by resolving the real path here too (in a real repo, git canonicalizes).
const stateOf = (cwd) => stateDir(homeDir(realpathSync(cwd)));

// Drives the REAL gate: `home hook PreToolUse` with a payload on stdin, in a
// temp project scaffolded by the real `home init` (so the seed rules are the
// ones users actually get). Asserts the wire contract Claude Code consumes.
const BIN = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'bin', 'zuzuu.mjs');

function gate(cwd, payload) {
  const r = spawnSync(process.execPath, [BIN, 'hook', 'PreToolUse'], { cwd, input: JSON.stringify(payload), encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout.trim() };
}

function withProject(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'zuzuu-gate-'));
  try {
    spawnSync(process.execPath, [BIN, 'init'], { cwd: dir, encoding: 'utf8' });
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('seed rule denies a root wipe with the verified schema; exit 0', () => {
  withProject((cwd) => {
    const { status, stdout } = gate(cwd, { session_id: 's1', tool_name: 'Bash', tool_input: { command: 'rm -rf / ' } });
    assert.equal(status, 0, 'gate must exit 0 even when denying');
    const d = JSON.parse(stdout);
    assert.equal(d.hookSpecificOutput.hookEventName, 'PreToolUse');
    assert.equal(d.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(d.hookSpecificOutput.permissionDecisionReason, /no-root-wipe/);
  });
});

test('seed rule asks on force-push; benign call stays silent (normal flow)', () => {
  withProject((cwd) => {
    const ask = gate(cwd, { session_id: 's1', tool_name: 'Bash', tool_input: { command: 'git push --force origin main' } });
    assert.equal(JSON.parse(ask.stdout).hookSpecificOutput.permissionDecision, 'ask');
    const ok = gate(cwd, { session_id: 's1', tool_name: 'Bash', tool_input: { command: 'ls -la' } });
    assert.equal(ok.stdout, '', 'no match → no output → host default flow');
    assert.equal(ok.status, 0);
  });
});

test('fail-open: garbage stdin, and projects with no rule items, never block', () => {
  withProject((cwd) => {
    rmSync(join(cwd, '.zuzuu', 'instructions', 'items'), { recursive: true, force: true });
    const noRules = gate(cwd, { session_id: 's1', tool_name: 'Bash', tool_input: { command: 'rm -rf / ' } });
    assert.equal(noRules.stdout, '');
    assert.equal(noRules.status, 0);
  });
  const dir = mkdtempSync(join(tmpdir(), 'zuzuu-gate-raw-'));
  try {
    const r = spawnSync(process.execPath, [BIN, 'hook', 'PreToolUse'], { cwd: dir, input: 'not json at all', encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a malformed rule note is skipped silently — seeds still enforce', () => {
  withProject((cwd) => {
    const items = join(cwd, '.zuzuu', 'instructions', 'items');
    mkdirSync(items, { recursive: true });
    // a broken envelope next to the seeds must not disarm the gate
    writeFileSync(join(items, 'broken.md'), '{ not an envelope at all');
    const denied = gate(cwd, { session_id: 's1', tool_name: 'Bash', tool_input: { command: 'rm -rf / ' } });
    assert.equal(denied.status, 0);
    assert.equal(JSON.parse(denied.stdout).hookSpecificOutput.permissionDecision, 'deny', 'seed rules survive a malformed sibling');
    const ok = gate(cwd, { session_id: 's1', tool_name: 'Bash', tool_input: { command: 'ls' } });
    assert.equal(ok.stdout, '', 'no spurious decision from the malformed note');
  });
});

test('matched decisions are logged for the trace', () => {
  withProject((cwd) => {
    gate(cwd, { session_id: 'sess-log', tool_name: 'Bash', tool_input: { command: 'rm -rf / ' } });
    // the gate log now lands in the XDG state dir (out of the repo), not .zuzuu/.live
    const log = readFileSync(join(stateOf(cwd), 'gate-sess-log.jsonl'), 'utf8');
    const entry = JSON.parse(log.trim().split('\n')[0]);
    assert.equal(entry.action, 'deny');
    assert.equal(entry.rule, 'no-root-wipe');
    assert.equal(entry.tool, 'Bash');
  });
});

// ── Critical 2: the session WRITE aliases must not escape protect-brain-exec ──
// The gate denies `zz session drop --yes` (a row) but USED to ALLOW the byte-equivalent
// alias `zz session discard --yes` and `zz session worktree discard <id> --yes` — the
// agent could DELETE a held session branch + checkpoints at the merge gate.
test('the deprecated session aliases + the destructive worktree ops are DENIED', () => {
  withProject((cwd) => {
    const deny = (command) => {
      const { status, stdout } = gate(cwd, { session_id: 's1', tool_name: 'Bash', tool_input: { command } });
      assert.equal(status, 0, 'gate exits 0 even on deny');
      const d = JSON.parse(stdout || '{}');
      assert.equal(d.hookSpecificOutput?.permissionDecision, 'deny', `denied: ${command}`);
      assert.match(d.hookSpecificOutput.permissionDecisionReason, /protect-brain-exec/);
    };
    deny('zz session discard --yes');
    deny('zz session worktree discard mybranch --yes');
    deny('zz session worktree close mybranch');
    deny('zuzuu session merge');
    // …while the reads/labels stay allowed (no decision = normal flow)
    for (const command of ['zz session status', 'zz session worktree list', 'zz session label x --text y']) {
      assert.equal(gate(cwd, { session_id: 's1', tool_name: 'Bash', tool_input: { command } }).stdout, '', `allowed: ${command}`);
    }
  });
});

// ── Critical 3: whitespace padding must not push a write verb past the match window ──
test('a write verb padded past the 8192-char haystack window still DENIES', () => {
  withProject((cwd) => {
    const padded = 'zz' + ' '.repeat(8300) + 'note set rule action allow';
    const { status, stdout } = gate(cwd, { session_id: 's1', tool_name: 'Bash', tool_input: { command: padded } });
    assert.equal(status, 0);
    const d = JSON.parse(stdout || '{}');
    assert.equal(d.hookSpecificOutput?.permissionDecision, 'deny', 'the padded write verb is still denied');
    assert.match(d.hookSpecificOutput.permissionDecisionReason, /protect-brain-exec/);
  });
});
