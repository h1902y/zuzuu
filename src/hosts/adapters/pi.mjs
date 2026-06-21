// src/hosts/adapters/pi.mjs — observe a pi CLI session.
//
// what: read ~/.pi/agent/sessions/<slug>/*.jsonl → mining signals.
// why:  host-agnostic observe; pi is the owned-harness target (stage 3).
// how:  built against REAL wire data (a captured `pi` session). One JSON object
//       per line; shell calls are assistant content[].toolCall with name in
//       PI_SHELL, command = arguments.command; paired toolResult.isError by
//       toolCall.id === toolResult.message.toolCallId. Zero-dep, tolerant. (v1.)

import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { assembleSignals, emptySignals } from '../signals.mjs';

const SESSIONS_DIR = join(homedir(), '.pi', 'agent', 'sessions');
const PI_SHELL = new Set(['bash', 'shell']);

function piCmdText(args) {
  const a = typeof args === 'string' ? (() => { try { return JSON.parse(args); } catch { return {}; } })() : args ?? {};
  if (typeof a.command === 'string') return a.command;
  if (Array.isArray(a.command)) return a.command.join(' ');
  if (typeof a.cmd === 'string') return a.cmd;
  return '';
}

function readJsonl(file) {
  try {
    return readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

export const pi = {
  name: 'pi',

  detect() { return existsSync(SESSIONS_DIR); },

  listSessions() {
    if (!existsSync(SESSIONS_DIR)) return [];
    return readdirSync(SESSIONS_DIR, { recursive: true })
      .filter((f) => typeof f === 'string' && /\.jsonl$/.test(f))
      .map((f) => {
        const ref = join(SESSIONS_DIR, f);
        const m = f.match(/([0-9a-f-]{36})\.jsonl$/i);
        return { sessionId: m ? m[1] : f, ref, label: 'pi', mtime: statSync(ref).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
  },

  mineSignals(ref) {
    try {
      const file = typeof ref === 'string' ? ref : ref?.ref;
      const rows = readJsonl(file);
      let sessionId = '';
      const errors = new Map(); // toolCallId → isError
      for (const r of rows) {
        if (r.type === 'session' && r.id) sessionId ||= r.id;
        if (r.type !== 'message') continue;
        const m = r.message || {};
        if (m.role === 'toolResult' && m.toolCallId) errors.set(m.toolCallId, !!m.isError);
      }
      const shellCalls = [];
      for (const r of rows) {
        if (r.type !== 'message') continue;
        const m = r.message || {};
        if (m.role !== 'assistant' || !Array.isArray(m.content)) continue;
        for (const c of m.content) {
          if (!c || c.type !== 'toolCall' || !PI_SHELL.has(c.name)) continue;
          const cmd = piCmdText(c.arguments);
          if (cmd) shellCalls.push({ cmd, failed: errors.get(c.id) === true, tool: c.name });
        }
      }
      return { sessionId: sessionId || (file ? String(file).split('/').pop().replace(/\.jsonl$/, '') : ''), ...assembleSignals(shellCalls) };
    } catch { return { sessionId: '', ...emptySignals() }; }
  },
};
