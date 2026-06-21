// zuzuu/pipelines/observe.mjs — watched work → review-queued proposals.
//
// what: the observe half of the loop. Aggregate per-session signals (from
//       hosts/capture) across sessions with a corroboration threshold, then route
//       each candidate to the RIGHT module as a typed proposal — never writing,
//       always human-gated (rung 5's propose/review).
// why:  this is what feeds `enhance` from real work and solves the cold-start —
//       the conversation/work tracks the design promised, made concrete and
//       deterministic (zero-LLM). It mines what RECURRED, corroborated across
//       sessions (Generative-Agents: don't act on a single sighting).
// how:  aggregate harvested from v1's proven distill.aggregate; routing maps a
//       candidate kind → {module, zu}. Zero-dep, fail-soft.

import { slugify } from '../notes/note.mjs';
import { captureSignals } from '../hosts/capture.mjs';
import { createProposal } from './propose.mjs';

/**
 * Aggregate per-session signals → candidates above the corroboration threshold.
 * Pure (hermetically testable). Harvested from the proven v1 distiller.
 * @returns {Array<{kind, id, title, body, attributes, evidence, score}>}
 */
export function aggregate(sessions, { minCmdCount = 3, minCmdSessions = 2, minFileTouches = 5, minFailures = 3 } = {}) {
  const out = [];

  // recurring commands → a runnable action
  const cmdStats = new Map();
  for (const s of sessions) for (const { cmd, failed } of s.commands ?? []) {
    const st = cmdStats.get(cmd) ?? { count: 0, sessions: new Set(), failures: 0 };
    st.count++; st.sessions.add(s.sessionId); if (failed) st.failures++;
    cmdStats.set(cmd, st);
  }
  for (const [cmd, st] of cmdStats) {
    if (st.count >= minCmdCount && st.sessions.size >= minCmdSessions) {
      out.push({
        kind: 'command', id: 'command-' + slugify(cmd, 40),
        title: `Run \`${cmd}\``, attributes: { command: cmd },
        body: `Recurring project command: \`${cmd}\` (used ${st.count}× across ${st.sessions.size} sessions${st.failures ? `, failed ${st.failures}×` : ''}).`,
        evidence: { occurrences: st.count, sessions: st.sessions.size, failures: st.failures },
        score: st.count * 10 + st.sessions.size,
      });
    }
  }

  // hot files → a project entity (knowledge)
  const fileStats = new Map();
  for (const s of sessions) for (const f of s.files ?? []) {
    const st = fileStats.get(f) ?? { count: 0, sessions: new Set() };
    st.count++; st.sessions.add(s.sessionId); fileStats.set(f, st);
  }
  for (const [path, st] of fileStats) {
    if (st.count >= minFileTouches) {
      const base = path.split('/').slice(-2).join('/');
      out.push({
        kind: 'entity', id: 'file-' + slugify(base, 40),
        title: `Hot file: ${base}`, attributes: { path },
        body: `Hot file in this project: \`${path}\` (touched ${st.count}× across ${st.sessions.size} sessions).`,
        evidence: { occurrences: st.count, sessions: st.sessions.size },
        score: st.count,
      });
    }
  }

  // frequently-failing tools → a fact worth knowing (knowledge)
  const failStats = new Map();
  for (const s of sessions) for (const t of s.failures ?? []) failStats.set(t, (failStats.get(t) ?? 0) + 1);
  for (const [tool, n] of failStats) {
    if (n >= minFailures) {
      out.push({
        kind: 'fact', id: 'failing-tool-' + slugify(tool, 30),
        title: `${tool} fails frequently`, attributes: {},
        body: `Tool \`${tool}\` fails frequently in this project (${n} failures observed) — worth investigating why.`,
        evidence: { occurrences: n }, score: n,
      });
    }
  }

  return out;
}

// candidate kind → the module it belongs in + the zu it becomes
const ROUTE = {
  command: (c) => ({ module: 'actions', change: { type: 'action', title: c.title, run: c.attributes.command, body: c.body } }),
  entity: (c) => ({ module: 'knowledge', change: { type: 'knowledge', title: c.title, path: c.attributes.path, body: c.body } }),
  fact: (c) => ({ module: 'knowledge', change: { type: 'knowledge', title: c.title, body: c.body } }),
};

/**
 * Observe real sessions → file evidence-backed proposals into each module's
 * review queue. Never writes the brain; dedup is propose's job (idempotent).
 * @returns {{ sessionsMined, candidates, proposed, proposals }}
 */
export function observe(home, opts = {}) {
  // `opts.sessions` injects pre-mined signals (tests / a caller that already
  // captured); otherwise sweep the real host transcripts.
  const sessions = opts.sessions ?? captureSignals(opts);
  const candidates = aggregate(sessions, opts);
  const proposals = [];
  for (const c of candidates) {
    const route = ROUTE[c.kind]?.(c);
    if (!route) continue;
    const p = createProposal(home, route.module, {
      op: 'create', target: c.id, change: route.change,
      rationale: c.body, evidence: [{ kind: c.kind, ...c.evidence }],
      source: 'observe', score: c.score ?? 1,
    });
    if (p && !p.duplicate) proposals.push({ module: route.module, ...p });
  }
  return { sessionsMined: sessions.length, candidates: candidates.length, proposed: proposals.length, proposals };
}
