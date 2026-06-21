// src/hosts/adapters/codex.mjs — observe a Codex CLI session.
//
// what: read ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl → mining signals.
// why:  host-agnostic observe; Codex is the second-richest host (real tool calls).
// how:  built against REAL wire data (a captured `codex exec` rollout), not docs.
//       Per line: { timestamp, type, payload }. Shell calls are response_item
//       function_call with name in CODEX_SHELL; the paired function_call_output
//       (by call_id) carries no error flag — but its text begins "Process exited
//       with code N", so N≠0 ⇒ failed. Zero-dep, tolerant. (Harvested from v1.)

import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { assembleSignals, emptySignals } from '../signals.mjs';

const SESSIONS_DIR = join(homedir(), '.codex', 'sessions');
const CODEX_SHELL = new Set(['exec_command', 'shell', 'local_shell', 'bash']);

function codexCmdText(args) {
  const a = typeof args === 'string' ? (() => { try { return JSON.parse(args); } catch { return {}; } })() : args ?? {};
  if (typeof a.cmd === 'string') return a.cmd;
  if (typeof a.command === 'string') return a.command;
  if (Array.isArray(a.command)) return a.command.join(' ');
  return '';
}
const codexFailed = (output) => /Process exited with code\s+([0-9]+)/i.test(String(output || '')) && !/Process exited with code\s+0\b/i.test(String(output || ''));

function readJsonl(file) {
  try {
    return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

export const codex = {
  name: 'codex',

  detect() { return existsSync(SESSIONS_DIR); },

  listSessions() {
    if (!existsSync(SESSIONS_DIR)) return [];
    return readdirSync(SESSIONS_DIR, { recursive: true })
      .filter((f) => typeof f === 'string' && /rollout-.*\.jsonl$/.test(f))
      .map((f) => {
        const ref = join(SESSIONS_DIR, f);
        const m = f.match(/rollout-.*-([0-9a-f-]{36})\.jsonl$/i);
        return { sessionId: m ? m[1] : f, ref, label: 'codex', mtime: statSync(ref).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
  },

  mineSignals(ref) {
    try {
      const file = typeof ref === 'string' ? ref : ref?.ref;
      const rows = readJsonl(file);
      const outputs = new Map(); // call_id → output text
      for (const r of rows) {
        const p = r.payload || {};
        if (r.type === 'response_item' && p.type === 'function_call_output') outputs.set(p.call_id, p.output);
      }
      const shellCalls = [];
      for (const r of rows) {
        const p = r.payload || {};
        if (r.type === 'response_item' && p.type === 'function_call' && CODEX_SHELL.has(p.name)) {
          const cmd = codexCmdText(p.arguments);
          if (cmd) shellCalls.push({ cmd, failed: codexFailed(outputs.get(p.call_id)), tool: p.name });
        }
      }
      const sig = assembleSignals(shellCalls);
      const meta = rows.find((r) => r.type === 'session_meta')?.payload;
      return { sessionId: meta?.id || (file ? String(file).split('/').pop().replace(/\.jsonl$/, '') : ''), ...sig };
    } catch { return { sessionId: '', ...emptySignals() }; }
  },
};
