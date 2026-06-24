// src/hosts/capture.mjs — host-agnostic capture-core.
//
// what: find the transcripts worth mining (across every detected host) and turn
//       them into per-session signals. The one seam between "a host wrote a log"
//       and "the observe pipeline has something to mine from."
// why:  the core stays host-blind — it iterates `detected()` adapters and calls
//       their uniform `listSessions`/`mineSignals`. A flaky host degrades to
//       skipped, never breaks the sweep.
// how:  zero-dep, tolerant. `scope`: 'last' (newest per host) | 'all'.

import * as registry from './registry.mjs';

/**
 * Resolve transcripts to mine across all detected hosts, newest-first.
 * @returns {Array<{host, ref, sessionId, mtime}>}
 */
function transcriptsFor({ cwd = process.cwd(), scope = 'all', session = null } = {}) {
  const pairs = [];
  for (const adapter of registry.detected()) {
    let sessions = [];
    try { sessions = adapter.listSessions({ cwd }); } catch { continue; }
    for (const s of sessions) pairs.push({ host: adapter.name, ref: s.ref, sessionId: s.sessionId, mtime: s.mtime ?? 0 });
  }
  pairs.sort((a, b) => b.mtime - a.mtime);
  let chosen = pairs;
  if (session) chosen = chosen.filter((p) => String(p.sessionId).includes(session));
  if (scope === 'last') chosen = chosen.slice(0, 1);
  return chosen;
}

/** Mine one {host, ref} → signals (host-prefixed sessionId for legible provenance). */
function mineSession({ host, ref, sessionId }) {
  try {
    const adapter = registry.byName(host);
    if (!adapter || typeof adapter.mineSignals !== 'function') return null;
    const sig = adapter.mineSignals(ref);
    const sid = sessionId || sig.sessionId || host;
    return { ...sig, sessionId: `${host}:${sid}`, host };
  } catch { return null; }
}

/** Mine every selected transcript → per-session signals. */
export function captureSignals(opts = {}) {
  return transcriptsFor(opts).map(mineSession).filter(Boolean);
}
