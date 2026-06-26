// src/grow/observe.mjs — watched work → review-queued proposals.
//
// what: the observe half of the loop. Aggregate per-session signals (from
//       hosts/capture) across sessions with a corroboration threshold, then route
//       each candidate to the RIGHT module as a typed proposal — never writing,
//       always human-gated (rung 5's propose/review).
// why:  this is what `observe` mines from real work and solves the cold-start —
//       the conversation/work tracks the design promised, made concrete and
//       deterministic (zero-LLM). It mines what RECURRED, corroborated across
//       sessions (Generative-Agents: don't act on a single sighting).
// how:  aggregate harvested from v1's proven distill.aggregate; routing maps a
//       candidate kind → {module, note}. Zero-dep, fail-soft.

import { slugify } from '../notes/note.mjs';
import { stageChange } from './stage.mjs';

// escape a literal command for a guardrail rule's regex pattern (match exactly it)
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// NB: observe does NOT import hosts/ — the caller captures and injects
// `opts.sessions` (the cli/hook do). That keeps the import graph acyclic:
// hosts → loop, never loop → hosts.

/**
 * Aggregate per-session signals → candidates above the corroboration threshold.
 * Pure (hermetically testable). Harvested from the proven v1 distiller.
 * @returns {Array<{kind, id, title, body, attributes, evidence, score}>}
 */
export function aggregate(sessions, { minCmdCount = 3, minCmdSessions = 2, minFileTouches = 5, minFailures = 3, minDestructiveSessions = 2, minCorrectionSessions = 2 } = {}) {
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

  // repeated destructive commands → an ASK guardrail (cross-session-gated, never
  // an auto-deny — a mined rule only asks; the human can tighten it at review)
  const destStats = new Map();
  for (const s of sessions) for (const d of s.destructiveFailures ?? []) {
    const cmd = typeof d === 'string' ? d : d.cmd;
    if (!cmd) continue;
    const st = destStats.get(cmd) ?? { count: 0, sessions: new Set() };
    st.count++; st.sessions.add(s.sessionId); destStats.set(cmd, st);
  }
  for (const [cmd, st] of destStats) {
    if (st.sessions.size >= minDestructiveSessions) {
      out.push({
        kind: 'guardrail', id: 'guard-' + slugify(cmd, 30),
        title: `Confirm before \`${cmd}\``, attributes: { command: cmd, pattern: escapeRe(cmd) },
        body: `\`${cmd}\` is a destructive command that failed across ${st.sessions.size} sessions — propose an ask-gate so it's confirmed, not run unprompted.`,
        evidence: { occurrences: st.count, sessions: st.sessions.size }, score: st.count + st.sessions.size,
      });
    }
  }

  // a correction the user repeats across sessions → a standing instruction
  const corrStats = new Map();
  for (const s of sessions) for (const c of s.correctionTurns ?? []) {
    const text = (typeof c === 'string' ? c : c.text ?? '').trim();
    if (!text) continue;
    const st = corrStats.get(text) ?? { count: 0, sessions: new Set() };
    st.count++; st.sessions.add(s.sessionId); corrStats.set(text, st);
  }
  for (const [text, st] of corrStats) {
    if (st.sessions.size >= minCorrectionSessions) {
      out.push({
        kind: 'correction', id: 'instruction-' + slugify(text, 40),
        title: `Standing guidance: ${text.slice(0, 60)}`, attributes: { text },
        body: `You corrected this across ${st.sessions.size} sessions: "${text}". Consider it standing guidance.`,
        evidence: { occurrences: st.count, sessions: st.sessions.size }, score: st.count + st.sessions.size,
      });
    }
  }

  // a recurring two-step command sequence → a runnable workflow action
  const seqStats = new Map();
  for (const s of sessions) for (const seq of s.sequences ?? []) {
    const st = seqStats.get(seq) ?? { count: 0, sessions: new Set() };
    st.count++; st.sessions.add(s.sessionId); seqStats.set(seq, st);
  }
  for (const [seq, st] of seqStats) {
    if (st.count >= minCmdCount && st.sessions.size >= minCmdSessions) {
      out.push({
        kind: 'workflow', id: 'workflow-' + slugify(seq, 40),
        title: `Workflow: ${seq}`, attributes: { command: seq },
        body: `Recurring two-step sequence: \`${seq}\` (${st.count}× across ${st.sessions.size} sessions).`,
        evidence: { occurrences: st.count, sessions: st.sessions.size }, score: st.count * 10 + st.sessions.size,
      });
    }
  }

  return out;
}

// The routing table: candidate kind → the module it belongs in + the note it
// becomes. The ONE declarative surface for "which observation grows which module"
// — every kind aggregate emits has an entry here, so observe reaches four of the
// five standard kinds (knowledge · actions · instructions · guardrails; Memory's
// episodic distiller is separate). Adding a routed signal = one aggregate producer
// + one line here.
const ROUTE = {
  command: (c) => ({ module: 'actions', change: { type: 'action', title: c.title, run: c.attributes.command, body: c.body } }),
  entity: (c) => ({ module: 'knowledge', change: { type: 'knowledge', title: c.title, path: c.attributes.path, body: c.body } }),
  fact: (c) => ({ module: 'knowledge', change: { type: 'knowledge', title: c.title, body: c.body } }),
  guardrail: (c) => ({ module: 'instructions', change: { type: 'rule', title: c.title, action: 'ask', tool: 'Bash', pattern: c.attributes.pattern, reason: 'recurring destructive command (mined)', body: c.body } }),
  correction: (c) => ({ module: 'instructions', change: { type: 'instruction', title: c.title, body: c.body } }),
  workflow: (c) => ({ module: 'actions', change: { type: 'action', title: c.title, run: c.attributes.command, body: c.body } }),
};

/**
 * Observe real sessions → file evidence-backed staged changes into each module's
 * review queue. Never writes the Project; dedup is stage's job (idempotent).
 * @returns {{ sessionsMined, candidates, proposed, staged }}
 */
export function observe(home, opts = {}) {
  // sessions are injected by the caller (the cli/hook capture via hosts/capture);
  // observe itself never reaches into hosts/, so grow/ → hosts/ is not an edge.
  const sessions = opts.sessions ?? [];
  const candidates = aggregate(sessions, opts);
  const staged = [];
  for (const c of candidates) {
    const route = ROUTE[c.kind]?.(c);
    if (!route) continue;
    const p = stageChange(home, route.module, {
      op: 'create', target: c.id, change: route.change,
      rationale: c.body, evidence: [{ kind: c.kind, ...c.evidence }],
      source: 'observe', score: c.score ?? 1,
    });
    if (p && !p.duplicate) staged.push({ module: route.module, ...p });
  }
  return { sessionsMined: sessions.length, candidates: candidates.length, proposed: staged.length, staged };
}
