// src/hosts/adapters/opencode.mjs — observe an OpenCode session.
//
// what: read ~/.local/share/opencode/opencode.db (SQLite) → mining signals.
// why:  OpenCode is the bundled host (`zz code`), so observing it closes the loop
//       for the default path.
// how:  built against REAL wire data (a live `opencode run` session). Shell calls
//       are `part` rows with data.type "tool" and tool in OC_SHELL; the command
//       is state.input.command, failed = state.status === 'error'. node:sqlite is
//       loaded LAZILY (createRequire) so importing this never breaks the registry
//       on older Node — only mining touches SQLite. Zero-dep, tolerant. (From v1.)

import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { assembleSignals, emptySignals } from '../signals.mjs';

const require = createRequire(import.meta.url);
const DB_PATH = join(homedir(), '.local', 'share', 'opencode', 'opencode.db');
const OC_SHELL = new Set(['bash', 'shell']);
const openDb = (path) => new (require('node:sqlite').DatabaseSync)(path, { readOnly: true });

/** Pure: shell calls from SQLite `part` rows → the signal superset. */
export function signalsFromParts(parts) {
  const shellCalls = [];
  for (const p of parts.filter((p) => p.type === 'tool').sort((a, b) => (a.state?.time?.start || a.time_created || 0) - (b.state?.time?.start || b.time_created || 0))) {
    if (!OC_SHELL.has(p.tool)) continue;
    const cmd = p.state?.input?.command;
    if (typeof cmd !== 'string' || !cmd) continue;
    shellCalls.push({ cmd, failed: p.state?.status === 'error', tool: p.tool });
  }
  return assembleSignals(shellCalls);
}

export const opencode = {
  name: 'opencode',

  detect() { return existsSync(DB_PATH); },

  listSessions() {
    if (!existsSync(DB_PATH)) return [];
    const db = openDb(DB_PATH);
    try {
      return db.prepare('SELECT id, title, time_updated FROM session ORDER BY time_updated DESC').all()
        .map((r) => ({ sessionId: r.id, ref: { db: DB_PATH, sessionId: r.id }, label: r.title || 'opencode', mtime: r.time_updated }));
    } catch { return []; } finally { db.close(); }
  },

  mineSignals(ref) {
    try {
      const dbPath = ref?.db || DB_PATH;
      const sid = ref?.sessionId || ref;
      if (!existsSync(dbPath)) return { sessionId: String(sid || ''), ...emptySignals() };
      const db = openDb(dbPath);
      try {
        const parts = db.prepare('SELECT time_created, data FROM part WHERE session_id = ? ORDER BY time_created').all(sid)
          .map((p) => { const d = JSON.parse(p.data); return { time_created: p.time_created, type: d.type, tool: d.tool, state: d.state }; });
        return { sessionId: String(sid || ''), ...signalsFromParts(parts) };
      } finally { db.close(); }
    } catch { return { sessionId: '', ...emptySignals() }; }
  },
};
