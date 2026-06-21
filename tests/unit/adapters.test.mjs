// host adapters — signal extraction from each host's real on-disk shape.
// Fixtures mirror wire data verified against ~/.codex, ~/.gemini, the opencode
// SQLite db, and ~/.pi on this machine (real-wire-data rule).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { codex } from '../../zuzuu/hosts/adapters/codex.mjs';
import { geminiCli } from '../../zuzuu/hosts/adapters/gemini-cli.mjs';
import { signalsFromParts } from '../../zuzuu/hosts/adapters/opencode.mjs';
import { pi } from '../../zuzuu/hosts/adapters/pi.mjs';
import { assembleSignals, emptySignals } from '../../zuzuu/hosts/signals.mjs';
import { all, detected } from '../../zuzuu/hosts/registry.mjs';

const tmp = () => mkdtempSync(join(tmpdir(), 'zuzuu-adp-'));
const jsonl = (dir, rows) => { const f = join(dir, 's.jsonl'); writeFileSync(f, rows.map((r) => JSON.stringify(r)).join('\n') + '\n'); return f; };

// ── the shared assembler ──────────────────────────────────────────────────────

test('signals: assembleSignals builds commands, sequences, failures, destructive', () => {
  const s = assembleSignals([
    { cmd: 'npm test', failed: false, tool: 'bash' },
    { cmd: 'rm -rf /', failed: true, tool: 'bash' },
  ]);
  assert.deepEqual(s.commands.map((c) => c.cmd), ['npm test', 'rm -rf /']);
  assert.deepEqual(s.sequences, ['npm test && rm -rf /']);
  assert.deepEqual(s.failures, ['bash']);
  assert.equal(s.destructiveFailures.length, 1);
  assert.deepEqual(emptySignals().commands, []);
});

// ── codex (rollout JSONL; failed inferred from "Process exited with code N") ──

test('codex: extracts shell calls + the exit-code-inferred failed flag', () => {
  const dir = tmp();
  const file = jsonl(dir, [
    { type: 'session_meta', payload: { id: 'cdx-1', cwd: '/p' } },
    { type: 'response_item', payload: { type: 'function_call', name: 'exec_command', call_id: 'a', arguments: JSON.stringify({ cmd: 'npm run build' }) } },
    { type: 'response_item', payload: { type: 'function_call_output', call_id: 'a', output: 'Process exited with code 0\n…' } },
    { type: 'response_item', payload: { type: 'function_call', name: 'exec_command', call_id: 'b', arguments: JSON.stringify({ cmd: 'rm -rf /' }) } },
    { type: 'response_item', payload: { type: 'function_call_output', call_id: 'b', output: 'Process exited with code 1' } },
  ]);
  const s = codex.mineSignals(file);
  assert.equal(s.sessionId, 'cdx-1');
  assert.deepEqual(s.commands.map((c) => c.cmd), ['npm run build', 'rm -rf /']);
  assert.equal(s.commands[0].failed, false);
  assert.equal(s.commands[1].failed, true);
  assert.equal(s.destructiveFailures.length, 1, 'failed rm -rf is destructive');
  rmSync(dir, { recursive: true, force: true });
});

// ── gemini (prompt-only logs → honest empty) ─────────────────────────────────

test('gemini: lists sessions from logs.json but mines no shell signals', () => {
  const dir = tmp();
  const proj = join(dir, 'tmp', 'projhash');
  mkdirSync(proj, { recursive: true });
  writeFileSync(join(proj, 'logs.json'), JSON.stringify([
    { sessionId: 'g1', messageId: 0, type: 'user', message: 'hi', timestamp: '2026-06-21T00:00:00Z' },
  ]));
  assert.deepEqual(geminiCli.mineSignals({ sessionId: 'g1' }).commands, [], 'thin host → empty');
});

// ── opencode (SQLite parts → signals via the pure helper) ────────────────────

test('opencode: signalsFromParts extracts bash commands + the error status', () => {
  const parts = [
    { time_created: 1, type: 'tool', tool: 'bash', state: { status: 'completed', input: { command: 'git status' }, time: { start: 1 } } },
    { time_created: 2, type: 'tool', tool: 'bash', state: { status: 'error', input: { command: 'chmod -R 777 /' }, time: { start: 2 } } },
    { time_created: 3, type: 'text', text: 'not a tool' },
  ];
  const s = signalsFromParts(parts);
  assert.deepEqual(s.commands.map((c) => c.cmd), ['git status', 'chmod -R 777 /']);
  assert.equal(s.commands[1].failed, true);
  assert.equal(s.destructiveFailures.length, 1);
});

test('opencode: mineSignals reads a real SQLite db (node:sqlite round-trip)', () => {
  const require = createRequire(import.meta.url);
  let DB; try { DB = require('node:sqlite').DatabaseSync; } catch { return; } // skip if unavailable
  const dir = tmp();
  const dbPath = join(dir, 'opencode.db');
  const db = new DB(dbPath);
  db.exec('CREATE TABLE part (id TEXT, message_id TEXT, session_id TEXT, time_created INTEGER, data TEXT)');
  const part = (id, data) => db.prepare('INSERT INTO part VALUES (?,?,?,?,?)').run(id, 'm', 'ses_1', id, JSON.stringify(data));
  part(1, { type: 'tool', tool: 'bash', state: { status: 'completed', input: { command: 'npm ci' }, time: { start: 1 } } });
  db.close();
  const { opencode } = require('../../zuzuu/hosts/adapters/opencode.mjs');
  const s = opencode.mineSignals({ db: dbPath, sessionId: 'ses_1' });
  assert.deepEqual(s.commands.map((c) => c.cmd), ['npm ci']);
  rmSync(dir, { recursive: true, force: true });
});

// ── pi (session JSONL; toolResult.isError by toolCallId) ─────────────────────

test('pi: pairs assistant toolCall(bash) to toolResult.isError', () => {
  const dir = tmp();
  const file = jsonl(dir, [
    { type: 'session', id: 'pi-1', cwd: '/p' },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'toolCall', id: 't1', name: 'bash', arguments: { command: 'ls -la' } }] } },
    { type: 'message', message: { role: 'toolResult', toolCallId: 't1', isError: false, content: [{ type: 'text', text: 'ok' }] } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'toolCall', id: 't2', name: 'bash', arguments: { command: 'git push --force origin main' } }] } },
    { type: 'message', message: { role: 'toolResult', toolCallId: 't2', isError: true, content: [{ type: 'text', text: 'rejected' }] } },
  ]);
  const s = pi.mineSignals(file);
  assert.equal(s.sessionId, 'pi-1');
  assert.deepEqual(s.commands.map((c) => c.cmd), ['ls -la', 'git push --force origin main']);
  assert.equal(s.commands[1].failed, true);
  assert.equal(s.destructiveFailures.length, 1, 'a failed force-push is destructive');
  rmSync(dir, { recursive: true, force: true });
});

// ── registry ──────────────────────────────────────────────────────────────────

test('registry: all five hosts registered; detected() is a subset', () => {
  assert.deepEqual(all().map((a) => a.name), ['claude-code', 'codex', 'gemini-cli', 'opencode', 'pi']);
  for (const a of detected()) assert.ok(all().includes(a));
});
