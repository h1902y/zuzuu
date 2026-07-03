// Brain write-protection — Layer 1 (the gate denies direct .zuzuu/ writes), Layer 3
// (the propose instruction is seeded), Layer 4 (provenance: seeds are logged; a direct
// write is flagged ungated). Uses the REAL seeded rules from initHome + real PreToolUse
// call shapes ({ tool: tool_name, input: tool_input }) — never an invented fixture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initHome } from '../../src/cli/init.mjs';
import { gate, clearCache } from '../../src/guardrails/gate.mjs';
import { check } from '../../src/use/check.mjs';
import { read as readLog } from '../../src/notes/log.mjs';
import { serialize, parse } from '../../src/notes/note.mjs';
import { gateWriteVerbPattern } from '../../src/cli/commands.mjs';

function withInit(fn) {
  const root = mkdtempSync(join(tmpdir(), 'zz-brain-'));
  const { home } = initHome(root); // repoRoot falls back to cwd → no git needed
  clearCache();
  try { return fn(root, home); } finally { rmSync(root, { recursive: true, force: true }); }
}

/** The gate verdict for a real PreToolUse call shape ({action,rule,reason} | null). */
const decide = (home, tool, input) => gate({ home }, { tool, input });

test('Layer 1: a direct Write into the brain is DENIED, pointing at zz stage', () => withInit((root, home) => {
  const v = decide(home, 'Write', { file_path: join(home, 'instructions', 'items', 'evil.md'), content: 'x' });
  assert.equal(v?.action, 'deny');
  assert.match(v.reason, /zz stage/);
}));

test('Layer 1: write-tool aliasing — Edit is denied too (one rule, every host)', () => withInit((root, home) => {
  const v = decide(home, 'Edit', { file_path: join(home, 'knowledge', 'items', 'x.md'), old_string: 'a', new_string: 'b' });
  assert.equal(v?.action, 'deny');
}));

test('Layer 1: path-scoped — a normal write whose CONTENT mentions .zuzuu/ is ALLOWED', () => withInit((root, home) => {
  const v = decide(home, 'Write', { file_path: join(root, 'README.md'), content: 'docs live in .zuzuu/knowledge' });
  assert.equal(v, null);
}));

test('Layer 1: READING the brain is allowed (read tools are not write-aliased)', () => withInit((root, home) => {
  const v = decide(home, 'Read', { file_path: join(home, 'instructions', 'items', 'review-the-gate.md') });
  assert.equal(v, null);
}));

test('Layer 1: writing inside a session worktree is allowed (that is where the agent works)', () => withInit((root, home) => {
  const v = decide(home, 'Write', { file_path: join(home, 'worktrees', 's1', 'src', 'a.js'), content: 'x' });
  assert.equal(v, null);
}));

test('Layer 1: shell — a redirect into the brain is denied (absolute + relative); a read is allowed, a zz WRITE verb is denied (Rung 9)', () => withInit((root, home) => {
  assert.equal(decide(home, 'Bash', { command: `echo x > ${home}/instructions/items/y.md` })?.action, 'deny');
  assert.equal(decide(home, 'Bash', { command: 'echo x > .zuzuu/instructions/items/y.md' })?.action, 'deny');
  assert.equal(decide(home, 'Bash', { command: `cat ${home}/instructions/items/review-the-gate.md` }), null, 'a read defers');
  // Rung 9 closed the gap: `zz review approve` (a WRITE) is now denied; a bare `zz review`
  // (the read/list) still defers — the agent can inspect the queue, not approve from it.
  assert.equal(decide(home, 'Bash', { command: 'zz review approve instructions foo' })?.action, 'deny');
  assert.equal(decide(home, 'Bash', { command: 'zz review instructions' }), null, 'the bare review list defers');
}));

test('Layer 3: init seeds the protect rules (incl. the exec guard) + the propose-never-write instruction', () => withInit((root, home) => {
  const items = join(home, 'instructions', 'items');
  for (const id of ['protect-brain-writes', 'protect-brain-shell', 'protect-brain-exec', 'propose-never-write']) {
    assert.ok(existsSync(join(items, `${id}.md`)), `missing seed ${id}`);
  }
}));

test('Layer 4: seeds carry provenance; a directly-written note is flagged ungated', () => withInit((root, home) => {
  const logged = new Set(readLog(home, 'instructions', 'mutations').map((e) => e.note));
  assert.ok(logged.has('review-the-gate'), 'seed not logged');

  // a bypass that slipped through (or pre-enforcement): a note straight to disk, no log
  writeFileSync(join(home, 'instructions', 'items', 'snuck-in.md'),
    serialize({ id: 'snuck-in', type: 'instruction', title: 'snuck in', body: 'x' }));

  const ids = check({ home }).ungated.map((u) => u.addr);
  assert.ok(ids.includes('instructions:snuck-in'), 'bypass not flagged');
  assert.ok(!ids.includes('instructions:review-the-gate'), 'seed false-flagged as ungated');
}));

test('Layer 4: re-running init is idempotent and does not double-log a seed', () => withInit((root, home) => {
  initHome(root); // reconcile pass
  const creates = readLog(home, 'instructions', 'mutations').filter((e) => e.note === 'review-the-gate');
  assert.equal(creates.length, 1);
}));

// ── SHOULD-FIX 1 (docs/audits/2026-07-03-triggers-review.md): the exec-gate's stored
// pattern must track the live command table, not freeze at first-seed ────────────────

test('the seeded protect-brain-exec rule denies `zz trigger fire` via the REAL stored note (classic mode)', () => withInit((root, home) => {
  const decide = (command) => gate({ home }, { tool: 'Bash', input: { command } });
  assert.equal(decide('zz trigger fire actions:t1')?.action, 'deny');
  assert.equal(decide('zz trigger fire actions:t1')?.rule, 'protect-brain-exec');
  assert.equal(decide('zz trigger enable actions:t1')?.action, 'deny');
  assert.equal(decide('zz trigger disable actions:t1')?.action, 'deny');
  assert.equal(decide('zz trigger list'), null, 'reads stay open');
}));

test('zz init reconciles a STALE protect-brain-exec pattern to the current write-verb table', () => withInit((root, home) => {
  const p = join(home, 'instructions', 'items', 'protect-brain-exec.md');
  // simulate a project seeded BEFORE `zz trigger fire` existed: a pattern that denies
  // an older write verb but knows nothing about `trigger`.
  const { note } = parse(readFileSync(p, 'utf8'), { id: 'protect-brain-exec' });
  writeFileSync(p, serialize({ ...note, pattern: '(?:\\bzz|\\bzuzuu(?:\\.mjs)?)\\s+(?:note\\s+set)\\b' }));
  clearCache();

  // before reconciliation: the stale pattern does NOT catch the new verb
  assert.equal(gate({ home }, { tool: 'Bash', input: { command: 'zz trigger fire actions:t1' } }), null, 'stale pattern misses the new verb');

  const r = initHome(root); // the reconcile pass
  assert.ok(r.reconciled.includes('instructions/protect-brain-exec'), 'reported as reconciled, not created/skipped');
  clearCache();

  const reread = parse(readFileSync(p, 'utf8'), { id: 'protect-brain-exec' }).note;
  assert.equal(reread.pattern, gateWriteVerbPattern(), 'pattern converges to the live table');
  assert.equal(gate({ home }, { tool: 'Bash', input: { command: 'zz trigger fire actions:t1' } })?.rule, 'protect-brain-exec', 're-armed after reconcile');
}));

test('zz init reconcile updates ONLY pattern — a human-edited action/reason on protect-brain-exec survives', () => withInit((root, home) => {
  const p = join(home, 'instructions', 'items', 'protect-brain-exec.md');
  const { note } = parse(readFileSync(p, 'utf8'), { id: 'protect-brain-exec' });
  // a human downgraded deny→ask and wrote their own reason; pattern is stale (pre-trigger)
  writeFileSync(p, serialize({
    ...note, action: 'ask', reason: 'my own custom reason',
    pattern: '(?:\\bzz|\\bzuzuu(?:\\.mjs)?)\\s+(?:note\\s+set)\\b',
  }));

  initHome(root);

  const reread = parse(readFileSync(p, 'utf8'), { id: 'protect-brain-exec' }).note;
  assert.equal(reread.pattern, gateWriteVerbPattern(), 'pattern reconciled');
  assert.equal(reread.action, 'ask', "the human's action override survives reconciliation");
  assert.equal(reread.reason, 'my own custom reason', "the human's reason survives reconciliation");
}));

test('zz init reconcile is a no-op once the pattern already matches the live table (idempotent)', () => withInit((root, home) => {
  const p = join(home, 'instructions', 'items', 'protect-brain-exec.md');
  const before = readFileSync(p, 'utf8');
  const r = initHome(root);
  assert.equal(r.reconciled.length, 0, 'already-current pattern is not re-reported as reconciled');
  assert.ok(r.skipped.includes('instructions/protect-brain-exec'));
  assert.equal(readFileSync(p, 'utf8'), before, 'byte-identical — no spurious rewrite');
}));
