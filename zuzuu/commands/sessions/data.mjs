// zuzuu/commands/sessions/data.mjs — the sessions observability data layer.
//
// Pure-ish functions returning the DISPLAY documents the CLI handlers print and
// the web daemon serves: the recorded-sessions list, one session's inspect
// document (trace summary + per-module mined signals), the nested SESSION→TURN
// →TOOL tree, the ordered per-action records, and on-demand host content.
//
// inspect = { session, trace: {spans, tools, duration}, signals: {<module>:
// counts} } — the span count reads the stored OTLP blob; the signals re-mine
// the HOST transcript through the proven adapters' mineSignals and map the
// superset onto modules via each module's sessionSignals hook. Fail-soft
// throughout: a gone blob/transcript degrades to warnings, never a throw.

import { readIndex, resolveTrace, paths } from '../../core/store.mjs';
import { transcriptsFor, mineHostSession } from '../../knowledge/distill.mjs';
import { modulesOf, invoke } from '../../module/registry.mjs';
import * as registry from '../../capture/adapters/registry.mjs';
import { readSessionLabels } from '../../sessions/labels.mjs';
import { countTraceSpans, readTraceSpans, spanToAction, spanToNode } from './trace.mjs';
import { redactionRegex, redact, MAX_TOOL_OUTPUT } from './redact.mjs';

/** Select a session record by exact id, else by unique-prefix; null when none. */
export const matchSession = (sessions, idArg) => {
  const exact = sessions.filter((s) => s.id === idArg);
  return (exact.length ? exact : sessions.filter((s) => String(s.id).startsWith(idArg)))[0] ?? null;
};

/** Pure: the sessions list with state labels — the web Sessions section source. */
export function sessionsListData(cwd = process.cwd()) {
  const { sessions } = readIndex(cwd);
  const labels = readSessionLabels(cwd); // W1-B: user names, kept out of the index
  return {
    sessions: sessions.map((s) => ({
      id: s.id,
      host: s.host,
      state: s.status, // active | completed | abandoned | crashed | captured | opening
      startedAt: s.startedAt ?? null,
      endedAt: s.endedAt ?? null,
      durationMs: s.durationMs ?? 0,
      counts: s.counts ?? { turns: 0, tools: 0, errors: 0 },
      generation: s.generation ?? null,
      git: s.git ?? { commit: null, branch: null },
      // U4 (KTD2): the daemon PTY join key, present only for workbench sessions.
      // Spread conditionally so older records (no ptyId) stay byte-for-byte the
      // same on the wire (backward-tolerant).
      ...(s.ptyId ? { ptyId: s.ptyId } : {}),
      // W1-B: a user label, only when set (absent → field omitted).
      ...(labels[s.id] ? { label: labels[s.id] } : {}),
    })),
  };
}

/**
 * Pure: the captured trace as a nested SESSION → TURN → TOOL_CALL tree.
 * Re-threads parentSpanId to build the hierarchy; children ordered by start time.
 * Fail-soft: missing/gone blob → { sessionId, root: null }, never throws.
 * @param {string} cwd
 * @param {string} idArg  session id or unique prefix
 * @returns {{ sessionId: string, root: object|null } | null}
 */
export function sessionTreeData(cwd, idArg) {
  if (!idArg) return null;
  const { sessions } = readIndex(cwd);
  const matches = sessions.filter((s) => s.id === idArg);
  const byPrefix = matches.length ? matches : sessions.filter((s) => String(s.id).startsWith(idArg));
  if (!byPrefix.length) return null;
  const s = byPrefix[0];

  let root = null;
  try {
    const file = resolveTrace(s.traceRef, cwd);
    const spans = readTraceSpans(file);
    // Build node map keyed by spanId (children: [] added below)
    const nodeMap = new Map();
    for (const sp of spans) {
      const node = spanToNode(sp);
      node.children = [];
      nodeMap.set(node.spanId, node);
    }
    // Thread: link each node to its parent; collect root
    for (const node of nodeMap.values()) {
      if (!node.parentSpanId) {
        // SESSION root
        root = node;
      } else {
        const parent = nodeMap.get(node.parentSpanId);
        if (parent) {
          parent.children.push(node);
        } else {
          // Orphaned node (parent missing): attach to root if present, else skip
          if (root) root.children.push(node);
        }
      }
    }
    // Children are already start-time ordered because readTraceSpans sorts by startTimeUnixNano
    // (children are inserted in order of the already-sorted spans array).
  } catch {
    // Missing or unreadable blob → null root (fail-soft)
  }

  // Strip internal spanId/parentSpanId from output nodes (they are implementation detail)
  function stripIds(node) {
    const { spanId: _s, parentSpanId: _p, ...rest } = node;
    rest.children = node.children.map(stripIds);
    return rest;
  }

  return { sessionId: s.id, root: root ? stripIds(root) : null };
}

/**
 * Pure: ordered per-action records from the stored OTLP trace blob.
 * Mirrors sessionInspectData — locates the session, resolves the blob, walks it.
 * Fail-soft: missing/gone blob → { sessionId, actions: [] }, never throws.
 * @param {string} cwd
 * @param {string} idArg  session id or unique prefix
 * @returns {{ sessionId: string, actions: Array<{kind,label,ts,status?}> } | null}
 */
export function sessionTraceData(cwd, idArg) {
  if (!idArg) return null;
  const { sessions } = readIndex(cwd);
  const matches = sessions.filter((s) => s.id === idArg);
  const byPrefix = matches.length ? matches : sessions.filter((s) => String(s.id).startsWith(idArg));
  if (!byPrefix.length) return null;
  const s = byPrefix[0];

  const actions = [];
  try {
    const file = resolveTrace(s.traceRef, cwd);
    const spans = readTraceSpans(file);
    for (const sp of spans) {
      const action = spanToAction(sp);
      if (action) actions.push(action);
    }
  } catch {
    // Missing or unreadable blob → empty actions (fail-soft)
  }
  return { sessionId: s.id, actions };
}

/**
 * Pure-ish: one session's observability document, or null for an unknown id.
 * Accepts a unique id prefix (the table shows 8-char ids).
 * @param {string} cwd
 * @param {string} idArg
 * @param {{transcripts?: Array<{host,ref,sessionId}>}} [opts]  injectable for hermetic tests
 * @returns {{session, trace:{spans,tools,duration}, signals:object, warnings:string[]} | null}
 */
export function sessionInspectData(cwd, idArg, { transcripts } = {}) {
  if (!idArg) return null;
  const { sessions } = readIndex(cwd);
  const matches = sessions.filter((s) => s.id === idArg);
  const byPrefix = matches.length ? matches : sessions.filter((s) => String(s.id).startsWith(idArg));
  if (!byPrefix.length) return null;
  const s = byPrefix[0];
  const warnings = [];

  // trace summary — span count from the stored OTLP blob (fail-soft)
  let spans = null;
  try {
    spans = countTraceSpans(resolveTrace(s.traceRef, cwd));
  } catch {
    warnings.push('trace blob unavailable — span count unknown');
  }
  const trace = { spans, tools: s.counts?.tools ?? 0, duration: s.durationMs ?? 0 };

  // per-module mined signals — re-mine the host transcript (fail-soft when gone)
  const signals = {};
  try {
    const pairs = transcripts ?? transcriptsFor({ scope: 'all', cwd });
    const pair = pairs.find((p) => p.host === s.host && String(p.sessionId) === String(s.id));
    const mined = pair ? mineHostSession(pair) : null;
    if (!mined) {
      warnings.push('host transcript unavailable — signals empty');
    } else {
      const agentDir = paths(cwd).dir;
      for (const entry of modulesOf(agentDir)) {
        const r = invoke(entry, 'sessionSignals', mined);
        if (r.ok && r.value && typeof r.value === 'object') signals[entry.id] = r.value;
      }
    }
  } catch {
    warnings.push('signal mining failed — signals empty');
  }

  return {
    session: {
      id: s.id,
      host: s.host,
      state: s.status,
      startedAt: s.startedAt ?? null,
      endedAt: s.endedAt ?? null,
      durationMs: s.durationMs ?? 0,
      counts: s.counts ?? { turns: 0, tools: 0, errors: 0 },
      generation: s.generation ?? null,
      git: s.git ?? { commit: null, branch: null },
      traceRef: s.traceRef ?? null,
    },
    trace,
    signals,
    warnings,
  };
}

/**
 * Pure-ish: ordered DISPLAY content nodes for one session, read on demand from
 * the HOST transcript (reuses the adapter's extractContent). Redaction + size
 * cap applied here. Fail-soft: unknown id, gone transcript, adapter without the
 * capability, or any read error → { sessionId, nodes: [] }, never throws.
 * @param {string} cwd
 * @param {string} idArg            session id or unique prefix
 * @param {{transcripts?: Array<{host,ref,sessionId}>}} [opts]  injectable for tests
 * @returns {{ sessionId: string, nodes: Array<object> } | null}
 */
export function sessionContentData(cwd, idArg, { transcripts } = {}) {
  if (!idArg) return null;
  const { sessions } = readIndex(cwd);
  const matches = sessions.filter((s) => s.id === idArg);
  const byPrefix = matches.length ? matches : sessions.filter((s) => String(s.id).startsWith(idArg));
  if (!byPrefix.length) return null;
  const s = byPrefix[0];

  let nodes = [];
  try {
    const pairs = transcripts ?? transcriptsFor({ scope: 'all', cwd });
    const pair = pairs.find((p) => p.host === s.host && String(p.sessionId) === String(s.id));
    const adapter = pair ? registry.byName(pair.host) : null;
    if (pair && adapter && typeof adapter.extractContent === 'function') {
      const raw = adapter.extractContent(pair.ref) || [];
      const re = redactionRegex(paths(cwd).dir);
      nodes = raw.map((n) => {
        const node = { kind: n.kind, label: n.label, ts: n.ts };
        if (n.text != null) node.text = redact(n.text, re);
        if (n.toolInput != null) node.toolInput = redact(n.toolInput, re);
        if (n.toolOutput != null) {
          let out = redact(n.toolOutput, re);
          if (typeof out === 'string' && out.length > MAX_TOOL_OUTPUT) {
            out = out.slice(0, MAX_TOOL_OUTPUT);
            node.truncated = true;
          }
          node.toolOutput = out;
        }
        if (n.status) node.status = n.status;
        return node;
      });
    }
  } catch {
    nodes = []; // fail-soft: any read/parse error → empty content
  }
  return { sessionId: s.id, nodes };
}
