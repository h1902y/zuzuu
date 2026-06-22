// src/hosts/adapters/gemini-cli.mjs — observe a Gemini CLI session.
//
// what: list sessions from ~/.gemini/tmp/<project>/logs.json (a flat user-prompt
//       timeline). The HONEST thin host: logs.json carries no tool calls (those
//       live in Gemini checkpoint files, deferred), so mineSignals is empty.
// why:  host-agnosticity demonstrated, not asserted — same contract, thinner data
//       is a capture gap, not a core change.
// how:  built against real ~/.gemini logs.json. Zero-dep, tolerant. (From v1.)

import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { emptySignals } from '../signals.mjs';
import { readJson } from '../../notes/store.mjs';

const TMP_DIR = join(homedir(), '.gemini', 'tmp');
const ms = (iso) => (iso ? Date.parse(iso) : NaN);

function readLog(file) {
  const data = readJson(file, []);
  return Array.isArray(data) ? data : [];
}

export const geminiCli = {
  name: 'gemini-cli',

  detect() { return existsSync(TMP_DIR); },

  listSessions() {
    if (!existsSync(TMP_DIR)) return [];
    const out = [];
    for (const project of readdirSync(TMP_DIR)) {
      const file = join(TMP_DIR, project, 'logs.json');
      if (!existsSync(file)) continue;
      const sessions = new Map(); // sessionId → {count, last}
      for (const r of readLog(file)) {
        if (!r.sessionId) continue;
        const s = sessions.get(r.sessionId) || { count: 0, last: 0 };
        s.count++; s.last = Math.max(s.last, ms(r.timestamp) || 0);
        sessions.set(r.sessionId, s);
      }
      for (const [sessionId, s] of sessions) out.push({ sessionId, label: `${project} (${s.count} msgs)`, ref: { file, sessionId }, mtime: s.last });
    }
    return out.sort((a, b) => b.mtime - a.mtime);
  },

  // logs.json is prompt-only (no tool calls) → empty superset. Honest thin host.
  mineSignals(ref) {
    const sid = (ref && typeof ref === 'object' ? ref.sessionId : '') || '';
    return { sessionId: sid, ...emptySignals() };
  },
};
