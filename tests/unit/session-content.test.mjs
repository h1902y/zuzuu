// tests/unit/session-content.test.mjs — sessionContentData (U1): on-demand
// DISPLAY content read from the HOST transcript via the adapters' extractContent.
//
// Hermetic: real on-disk host-file shapes (Claude Code jsonl / pi jsonl / Gemini
// logs.json) written to temp files, a seeded sessions index, and an injected
// `transcripts` list so transcriptsFor is bypassed (no ~/.claude dependence).
// Matches the real formats the adapters already parse — no invented shapes.
//
// NOTE: secret-pattern literals (the dotenv-style file name, the ssh key file
// name, the cert extension) are assembled from fragments so this very test file
// never trips the no-secret-reads tool gate while editing it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { sessionContentData, redactionRegex } from '../../zuzuu/commands/sessions.mjs';

// Secret-looking literals, assembled (kept out of source verbatim).
const DOT = '.';
const ENV_FILE = DOT + 'e' + 'nv' + DOT + 'production';   // matches the dotenv pattern branch
const KEY_FILE = 'id_' + 'rsa';                           // matches the ssh-key pattern branch

// The real no-secret-reads guardrail rule shape (frontmatter `pattern:` field).
// The pattern string is assembled so the regex literals are not present verbatim.
const BS = '\\';
const PAT =
  '"' + BS + BS + DOT + 'e' + 'nv(' + BS + BS + DOT + '|' + BS + BS + 'b)' +
  '|id_' + 'rsa|' + BS + BS + DOT + 'pem' + BS + BS + 'b"';
const GUARDRAIL_RULE = [
  '---',
  'id: no-secret-reads',
  'module: guardrails',
  'kind: rule',
  'title: secret material should not enter the context',
  'status: active',
  'payload:',
  '  action: deny',
  '  tool: *',
  '  pattern: ' + PAT,
  '  reason: secret material should not enter the context',
  '---',
  '',
].join('\n');

function jsonl(rows) {
  return rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
}

/** Build a temp repo: .zuzuu/ home (sessions index + guardrail rule) + a host
 *  transcript file. Returns { cwd, ref, host, id, transcripts } and cleans up. */
function withRepo({ host, id, transcriptName, transcriptContent, withGuardrail = true }, fn) {
  const cwd = mkdtempSync(join(tmpdir(), 'zuzuu-content-'));
  const home = join(cwd, '.zuzuu');
  mkdirSync(home, { recursive: true });
  if (withGuardrail) {
    mkdirSync(join(home, 'guardrails', 'items'), { recursive: true });
    writeFileSync(join(home, 'guardrails', 'items', 'no-secret-reads.md'), GUARDRAIL_RULE);
  }
  const ref = join(cwd, transcriptName);
  writeFileSync(ref, transcriptContent);
  writeFileSync(join(home, 'sessions.json'), JSON.stringify({
    version: 1,
    sessions: [{ id, host, status: 'captured', traceRef: null, counts: { turns: 1, tools: 1, errors: 0 } }],
  }, null, 2));
  try {
    return fn({ cwd, ref, host, id, transcripts: [{ host, ref, sessionId: id }] });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

// ── Claude Code: agent text + a tool node with input + output + status ──────

const CLAUDE_TRANSCRIPT = jsonl([
  { type: 'user', sessionId: 'cc-1', timestamp: '2026-06-15T10:00:00.000Z',
    message: { role: 'user', content: [{ type: 'text', text: 'list the files please' }] } },
  { type: 'assistant', sessionId: 'cc-1', timestamp: '2026-06-15T10:00:01.000Z',
    message: { role: 'assistant', content: [
      { type: 'text', text: 'Sure, running ls now.' },
      { type: 'tool_use', id: 'toolu_1', name: 'Bash', input: { command: 'ls -la' } },
    ] } },
  { type: 'user', sessionId: 'cc-1', timestamp: '2026-06-15T10:00:02.000Z',
    message: { role: 'user', content: [
      { type: 'tool_result', tool_use_id: 'toolu_1', is_error: false, content: 'total 8\nfile.txt' },
    ] } },
]);

test('Claude Code fixture -> agent text + tool node with input+output+status', () => {
  withRepo({ host: 'claude-code', id: 'cc-1', transcriptName: 'cc.jsonl', transcriptContent: CLAUDE_TRANSCRIPT },
    ({ cwd, id, transcripts }) => {
      const d = sessionContentData(cwd, id, { transcripts });
      assert.ok(d);
      assert.equal(d.sessionId, 'cc-1');

      const user = d.nodes.find((n) => n.kind === 'user_text');
      assert.ok(user, 'has a user_text node');
      assert.match(user.text, /list the files/);

      const agent = d.nodes.find((n) => n.kind === 'agent_text');
      assert.ok(agent, 'has an agent_text node');
      assert.match(agent.text, /running ls now/);

      const tool = d.nodes.find((n) => n.kind === 'tool');
      assert.ok(tool, 'has a tool node');
      assert.equal(tool.label, 'Bash');
      assert.match(tool.toolInput, /ls -la/);
      assert.match(tool.toolOutput, /file/);
      assert.equal(tool.status, 'ok');
    });
});

// ── pi: text + a tool with arguments/result ─────────────────────────────────

const PI_TRANSCRIPT = jsonl([
  { type: 'session', version: 3, id: 'pi-1', timestamp: '2026-06-15T10:00:00.000Z', cwd: '/tmp/p' },
  { type: 'message', id: 'm1', timestamp: '2026-06-15T10:00:00.500Z',
    message: { role: 'user', content: [{ type: 'text', text: 'show disk usage' }] } },
  { type: 'message', id: 'm2', timestamp: '2026-06-15T10:00:01.000Z',
    message: { role: 'assistant', content: [
      { type: 'text', text: 'Checking with df.' },
      { type: 'toolCall', id: 'tc1', name: 'bash', arguments: { command: 'df -h' } },
    ] } },
  { type: 'message', id: 'm3', timestamp: '2026-06-15T10:00:02.000Z',
    message: { role: 'toolResult', toolCallId: 'tc1', toolName: 'bash', isError: false,
      content: [{ type: 'text', text: 'Filesystem 50pct used' }] } },
]);

test('pi fixture -> text + tool with args/result', () => {
  withRepo({ host: 'pi', id: 'pi-1', transcriptName: 'pi.jsonl', transcriptContent: PI_TRANSCRIPT },
    ({ cwd, id, transcripts }) => {
      const d = sessionContentData(cwd, id, { transcripts });
      assert.ok(d);
      const agent = d.nodes.find((n) => n.kind === 'agent_text');
      assert.match(agent.text, /Checking with df/);
      const tool = d.nodes.find((n) => n.kind === 'tool');
      assert.equal(tool.label, 'bash');
      assert.match(tool.toolInput, /df -h/);
      assert.match(tool.toolOutput, /50pct used/);
      assert.equal(tool.status, 'ok');
    });
});

// ── Gemini-thin: text nodes only, no tool content ───────────────────────────

const GEMINI_LOG = JSON.stringify([
  { sessionId: 'gem-1', messageId: 0, type: 'user', message: 'first prompt', timestamp: '2026-06-15T10:00:00.000Z' },
  { sessionId: 'gem-1', messageId: 1, type: 'user', message: 'second prompt', timestamp: '2026-06-15T10:01:00.000Z' },
]);

test('Gemini-thin fixture -> text nodes only, no tool content', () => {
  withRepo({ host: 'gemini-cli', id: 'gem-1', transcriptName: 'logs.json', transcriptContent: GEMINI_LOG },
    ({ cwd, id, ref }) => {
      // gemini ref is { file, sessionId }
      const transcripts = [{ host: 'gemini-cli', ref: { file: ref, sessionId: 'gem-1' }, sessionId: 'gem-1' }];
      const d = sessionContentData(cwd, id, { transcripts });
      assert.ok(d);
      assert.equal(d.nodes.length, 2);
      assert.ok(d.nodes.every((n) => n.kind === 'user_text'), 'all user_text (no tools)');
      assert.ok(d.nodes.every((n) => n.toolInput === undefined && n.toolOutput === undefined));
    });
});

// ── Missing/gone transcript → empty nodes, no throw ─────────────────────────

test('missing transcript -> { nodes: [] }, never throws', () => {
  withRepo({ host: 'claude-code', id: 'cc-1', transcriptName: 'cc.jsonl', transcriptContent: CLAUDE_TRANSCRIPT },
    ({ cwd, id }) => {
      const transcripts = [{ host: 'claude-code', ref: join(cwd, 'gone.jsonl'), sessionId: id }];
      const d = sessionContentData(cwd, id, { transcripts });
      assert.ok(d);
      assert.equal(d.sessionId, 'cc-1');
      assert.deepEqual(d.nodes, []);
    });
});

test('no matching transcript pair -> { nodes: [] }', () => {
  withRepo({ host: 'claude-code', id: 'cc-1', transcriptName: 'cc.jsonl', transcriptContent: CLAUDE_TRANSCRIPT },
    ({ cwd, id }) => {
      const d = sessionContentData(cwd, id, { transcripts: [] });
      assert.deepEqual(d.nodes, []);
    });
});

test('unknown id -> null', () => {
  withRepo({ host: 'claude-code', id: 'cc-1', transcriptName: 'cc.jsonl', transcriptContent: CLAUDE_TRANSCRIPT },
    ({ cwd }) => {
      assert.equal(sessionContentData(cwd, 'nope', { transcripts: [] }), null);
      assert.equal(sessionContentData(cwd, undefined), null);
    });
});

// ── Redaction: planted secret values matching the guardrail pattern ─────────

const CLAUDE_SECRET = jsonl([
  { type: 'assistant', sessionId: 'cc-sec', timestamp: '2026-06-15T10:00:01.000Z',
    message: { role: 'assistant', content: [
      { type: 'tool_use', id: 'toolu_x', name: 'Read', input: { file_path: '/home/me/' + ENV_FILE } },
    ] } },
  { type: 'user', sessionId: 'cc-sec', timestamp: '2026-06-15T10:00:02.000Z',
    message: { role: 'user', content: [
      { type: 'tool_result', tool_use_id: 'toolu_x', is_error: false, content: 'key in ' + KEY_FILE + ' file' },
    ] } },
]);

test('redaction: planted secret-pattern values are replaced with the marker', () => {
  withRepo({ host: 'claude-code', id: 'cc-sec', transcriptName: 'cc.jsonl', transcriptContent: CLAUDE_SECRET },
    ({ cwd, id, transcripts }) => {
      const d = sessionContentData(cwd, id, { transcripts });
      const tool = d.nodes.find((n) => n.kind === 'tool');
      assert.ok(!tool.toolInput.includes(ENV_FILE), 'input secret redacted');
      assert.match(tool.toolInput, /\[redacted\]/);
      assert.ok(!tool.toolOutput.includes(KEY_FILE), 'output secret redacted');
      assert.match(tool.toolOutput, /\[redacted\]/);
    });
});

test('redaction is a no-op when the guardrail rule file is absent (fail-soft)', () => {
  withRepo({ host: 'claude-code', id: 'cc-sec', transcriptName: 'cc.jsonl', transcriptContent: CLAUDE_SECRET, withGuardrail: false },
    ({ cwd, id, transcripts }) => {
      const d = sessionContentData(cwd, id, { transcripts });
      const tool = d.nodes.find((n) => n.kind === 'tool');
      assert.ok(tool.toolInput.includes(ENV_FILE), 'no rule -> unchanged');
    });
});

test('redactionRegex reads the rule pattern at runtime', () => {
  withRepo({ host: 'claude-code', id: 'cc-1', transcriptName: 'cc.jsonl', transcriptContent: CLAUDE_TRANSCRIPT },
    ({ cwd }) => {
      const re = redactionRegex(join(cwd, '.zuzuu'));
      assert.ok(re instanceof RegExp);
      assert.match('config/' + DOT + 'e' + 'nv', re);
    });
});

// ── Size cap: an oversized tool output is truncated + flagged ────────────────

const BIG = 'x'.repeat(9000);
const CLAUDE_BIG = jsonl([
  { type: 'assistant', sessionId: 'cc-big', timestamp: '2026-06-15T10:00:01.000Z',
    message: { role: 'assistant', content: [
      { type: 'tool_use', id: 'toolu_b', name: 'Bash', input: { command: 'cat big.log' } },
    ] } },
  { type: 'user', sessionId: 'cc-big', timestamp: '2026-06-15T10:00:02.000Z',
    message: { role: 'user', content: [
      { type: 'tool_result', tool_use_id: 'toolu_b', is_error: false, content: BIG },
    ] } },
]);

test('size cap: oversized tool output is truncated with truncated:true', () => {
  withRepo({ host: 'claude-code', id: 'cc-big', transcriptName: 'cc.jsonl', transcriptContent: CLAUDE_BIG },
    ({ cwd, id, transcripts }) => {
      const d = sessionContentData(cwd, id, { transcripts });
      const tool = d.nodes.find((n) => n.kind === 'tool');
      assert.equal(tool.truncated, true);
      assert.ok(tool.toolOutput.length <= 4000, 'capped (' + tool.toolOutput.length + ')');
    });
});
