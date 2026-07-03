// Tier 2.9 — pre-write validation: a malformed note is refused at the gate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateNote, bindingOf, promptOf, ACTION_BINDINGS } from '../../src/notes/validate.mjs';
import { stageChange } from '../../src/grow/stage.mjs';
import { approve } from '../../src/grow/review.mjs';

test('validateNote: type-keyed invariants', () => {
  assert.equal(validateNote({ type: 'knowledge', title: 'x', status: 'active' }).ok, true);
  assert.equal(validateNote({ title: 'no type' }).ok, false);
  assert.equal(validateNote({ type: 'rule', title: 'r', status: 'active', action: 'deny', pattern: 'rm' }).ok, true);
  assert.equal(validateNote({ type: 'rule', action: 'nope', pattern: 'rm' }).ok, false, 'bad action');
  assert.equal(validateNote({ type: 'rule', action: 'deny' }).ok, false, 'rule needs a pattern');
  assert.equal(validateNote({ type: 'action', title: 'a', status: 'active', run: 'echo' }).ok, true);
  assert.equal(validateNote({ type: 'action', title: 'no run' }).ok, false);
});

// ── binding (§I.1/§I.6): a tool note's shell|agent|mcp back-compat + invariants ──

test('validateNote: absent binding is back-compat shell — a plain run: still validates', () => {
  const r = validateNote({ type: 'action', title: 'a', status: 'active', run: 'echo hi' });
  assert.equal(r.ok, true, r.errors.join('; '));
  assert.equal(bindingOf({ run: 'echo hi' }), 'shell');
});

test('validateNote: binding: shell needs run: exactly like the implicit default', () => {
  assert.equal(validateNote({ type: 'action', title: 'a', status: 'active', binding: 'shell', run: 'echo hi' }).ok, true);
  const r = validateNote({ type: 'action', title: 'a', status: 'active', binding: 'shell' });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(';'), /run command/);
});

test('validateNote: binding: agent needs a prompt — an explicit prompt: satisfies it', () => {
  const r = validateNote({ type: 'action', title: 'a', status: 'active', binding: 'agent', prompt: 'use your browser tool to …' });
  assert.equal(r.ok, true, r.errors.join('; '));
});

test('validateNote: binding: agent — run: is reused as the prompt when prompt: is absent (the documented decision)', () => {
  const note = { type: 'action', title: 'a', status: 'active', binding: 'agent', run: 'use your browser tool to enrich the lead' };
  assert.equal(validateNote(note).ok, true);
  assert.equal(promptOf(note), 'use your browser tool to enrich the lead');
});

test('validateNote: binding: agent with neither prompt: nor run: is rejected', () => {
  const r = validateNote({ type: 'action', title: 'a', status: 'active', binding: 'agent' });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(';'), /agent-binding action needs a prompt/);
});

test('validateNote: binding: mcp needs mcp: {server, tool}', () => {
  const ok = validateNote({ type: 'action', title: 'a', status: 'active', binding: 'mcp', mcp: { server: 'gmail', tool: 'send' } });
  assert.equal(ok.ok, true, ok.errors.join('; '));
  const missing = validateNote({ type: 'action', title: 'a', status: 'active', binding: 'mcp' });
  assert.equal(missing.ok, false);
  assert.match(missing.errors.join(';'), /mcp: \{server, tool\}/);
  const partial = validateNote({ type: 'action', title: 'a', status: 'active', binding: 'mcp', mcp: { server: 'gmail' } });
  assert.equal(partial.ok, false);
});

test('validateNote: an unrecognized binding value is its own error, never silently shell', () => {
  const r = validateNote({ type: 'action', title: 'a', status: 'active', binding: 'carrier-pigeon', run: 'echo hi' });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(';'), /binding must be one of shell\|agent\|mcp/);
});

test('bindingOf: fail-soft default — a garbage binding on a hand-edited note falls through to shell', () => {
  assert.equal(bindingOf({ binding: 'carrier-pigeon', run: 'echo hi' }), 'shell');
  assert.equal(bindingOf({}), 'shell');
  assert.equal(bindingOf(null), 'shell');
  for (const b of ACTION_BINDINGS) assert.equal(bindingOf({ binding: b }), b);
});

test('validateNote: secrets must be a list of name strings', () => {
  assert.equal(validateNote({ type: 'action', title: 'a', status: 'active', run: 'echo', secrets: ['CLEARBIT_KEY', 'SMTP_PASS'] }).ok, true);
  const bad1 = validateNote({ type: 'action', title: 'a', status: 'active', run: 'echo', secrets: 'CLEARBIT_KEY' });
  assert.equal(bad1.ok, false);
  assert.match(bad1.errors.join(';'), /secrets must be a list/);
  const bad2 = validateNote({ type: 'action', title: 'a', status: 'active', run: 'echo', secrets: ['', 'ok'] });
  assert.equal(bad2.ok, false);
  const bad3 = validateNote({ type: 'action', title: 'a', status: 'active', run: 'echo', secrets: [{ name: 'x' }] });
  assert.equal(bad3.ok, false);
});

test('gate: a malformed note is refused BEFORE it is written', () => {
  const root = mkdtempSync(join(tmpdir(), 'zz-val-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@e.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: root });
  const home = join(root, '.zuzuu');
  // an action note with no `run` — staged fine, but the gate refuses to evolve it
  const p = stageChange(home, 'actions', { op: 'create', target: 'bad', change: { type: 'action', title: 'no run' } });
  const r = approve(home, 'actions', p.id);
  assert.equal(r.ok, false);
  assert.match(r.error, /invalid note.*run/);
  rmSync(root, { recursive: true, force: true });
});
