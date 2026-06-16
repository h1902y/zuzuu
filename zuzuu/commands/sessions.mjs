// zuzuu/commands/sessions.mjs — the sessions observability surface (overhaul
// Part A, 2026-06-13; per-action trace records added U6 2026-06-15).
//
//   zuzuu sessions [--json]              recorded sessions w/ state labels
//   zuzuu session inspect <id> [--json]  one session: trace summary +
//                                        per-module mined signals
//   zuzuu session trace <id> [--json]    ordered per-action records from
//                                        the captured OTLP blob
//
// inspect = { session, trace: {spans, tools, duration}, signals: {<module>:
// counts} } — the span count reads the stored OTLP blob; the signals re-mine
// the HOST transcript through the proven adapters' mineSignals and map the
// superset onto modules via each module's sessionSignals hook. Fail-soft
// throughout: a gone blob/transcript degrades to warnings, never a throw.
//
// sessionTraceData = { sessionId, actions: [{kind, label, ts, status?}] }
// — walks the same OTLP blob into ordered per-action records (turn | tool |
// other) for the transcript renderer. Fail-soft: missing blob → empty list.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readIndex, resolveTrace, paths } from '../core/store.mjs';
import { transcriptsFor, mineHostSession } from '../knowledge/distill.mjs';
import { modulesOf, invoke } from '../module/registry.mjs';
import * as registry from '../capture/adapters/registry.mjs';
import { git, branchExists } from '../sessions/git.mjs';
import { mainBranch, sessionBranchName } from '../sessions/session-git.mjs';

/** Pure: the sessions list with state labels — the web Sessions section source. */
export function sessionsListData(cwd = process.cwd()) {
  const { sessions } = readIndex(cwd);
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
    })),
  };
}

/** Count spans across an OTLP/JSON NDJSON blob (one export request per line). */
function countTraceSpans(file) {
  let spans = 0;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const req = JSON.parse(line);
    for (const rs of req.resourceSpans ?? []) {
      for (const ss of rs.scopeSpans ?? []) spans += (ss.spans ?? []).length;
    }
  }
  return spans;
}

/** Walk all spans from an OTLP/JSON NDJSON blob into a flat array, ordered by
 *  startTimeUnixNano. Returns [] on any read/parse error (fail-soft).
 *  Each span: { name, startNs, endNs, statusCode, attributes: [{key,value}] } */
function readTraceSpans(file) {
  const all = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const req = JSON.parse(line);
    for (const rs of req.resourceSpans ?? []) {
      for (const ss of rs.scopeSpans ?? []) {
        for (const sp of ss.spans ?? []) all.push(sp);
      }
    }
  }
  // Sort by start time (numeric; OTLP stores nanoseconds as strings)
  all.sort((a, b) => {
    const na = Number(BigInt(a.startTimeUnixNano || '0'));
    const nb = Number(BigInt(b.startTimeUnixNano || '0'));
    return na - nb;
  });
  return all;
}

/** Map an OTLP span into a SessionTraceAction record.
 *  - SESSION root span → skipped (returns null)
 *  - TURN spans (name starts with "turn:") → kind "turn"
 *  - TOOL_CALL spans (have gen_ai.tool.name attribute) → kind "tool"
 *  - anything else → kind "other"
 * @param {object} sp  raw OTLP span object
 * @returns {{ kind: string, label: string, ts: string, status?: string }|null}
 */
function spanToAction(sp) {
  const name = sp.name ?? '';
  // Skip the SESSION root (no parentSpanId)
  if (!sp.parentSpanId) return null;

  const attrs = {};
  for (const a of sp.attributes ?? []) {
    const v = a.value;
    attrs[a.key] = v?.stringValue ?? v?.intValue ?? v?.doubleValue ?? v?.boolValue ?? null;
  }

  // ts = ISO timestamp from startTimeUnixNano (ns → ms → ISO)
  const ns = sp.startTimeUnixNano ? BigInt(sp.startTimeUnixNano) : 0n;
  const ts = new Date(Number(ns / 1_000_000n)).toISOString();

  // status: OTLP code 0=UNSET, 1=OK, 2=ERROR
  const code = sp.status?.code ?? 0;
  const status = code === 2 ? 'error' : code === 1 ? 'ok' : undefined;

  // kind + label
  if (name.startsWith('turn:') || name.startsWith('turn ')) {
    return { kind: 'turn', label: name.replace(/^turn:\s*/, '').trim() || name, ts, ...(status ? { status } : {}) };
  }
  const toolName = attrs['gen_ai.tool.name'] ?? attrs['host.tool.name'];
  if (toolName) {
    return { kind: 'tool', label: String(toolName), ts, ...(status ? { status } : {}) };
  }
  // Check if name looks like a tool call (e.g. "Bash", "Write", etc.)
  if (attrs['gen_ai.operation.name'] === 'execute_tool') {
    return { kind: 'tool', label: name, ts, ...(status ? { status } : {}) };
  }
  return { kind: 'other', label: name, ts, ...(status ? { status } : {}) };
}

/**
 * Map an OTLP span to a SessionTreeNode record (without children — caller threads the tree).
 * Keeps spanId and parentSpanId for tree construction; maps kind/label/status same as spanToAction.
 * SESSION root span (no parentSpanId) → kind 'session', parentSpanId absent.
 * @param {object} sp  raw OTLP span object
 * @returns {{ spanId: string, parentSpanId?: string, kind: string, label: string, ts: string, status?: string }}
 */
function spanToNode(sp) {
  const name = sp.name ?? '';
  const attrs = {};
  for (const a of sp.attributes ?? []) {
    const v = a.value;
    attrs[a.key] = v?.stringValue ?? v?.intValue ?? v?.doubleValue ?? v?.boolValue ?? null;
  }
  const ns = sp.startTimeUnixNano ? BigInt(sp.startTimeUnixNano) : 0n;
  const ts = new Date(Number(ns / 1_000_000n)).toISOString();
  const code = sp.status?.code ?? 0;
  const status = code === 2 ? 'error' : code === 1 ? 'ok' : undefined;

  let kind;
  let label;
  if (!sp.parentSpanId) {
    kind = 'session';
    label = name;
  } else if (name.startsWith('turn:') || name.startsWith('turn ')) {
    kind = 'turn';
    label = name.replace(/^turn:\s*/, '').trim() || name;
  } else {
    const toolName = attrs['gen_ai.tool.name'] ?? attrs['host.tool.name'];
    if (toolName) {
      kind = 'tool';
      label = String(toolName);
    } else if (attrs['gen_ai.operation.name'] === 'execute_tool') {
      kind = 'tool';
      label = name;
    } else {
      kind = 'other';
      label = name;
    }
  }

  const node = { spanId: sp.spanId ?? '', kind, label, ts, ...(status ? { status } : {}) };
  if (sp.parentSpanId) node.parentSpanId = sp.parentSpanId;
  return node;
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

// ── On-demand session content (U1) ──────────────────────────────────────────
// Resolves a session's HOST transcript (via the same adapter path resolution
// distill uses) and asks the adapter's extractContent for ordered DISPLAY nodes
// (agent text + tool input/output). Persists nothing new — the trace blob still
// stores byte counts only; this re-reads the raw host file at display time.
//
// Two display-time protections applied HERE (not in the adapters):
//   - redaction: the no-secret-reads guardrail rule's `pattern:` is read at
//     runtime from .zuzuu/guardrails/items/no-secret-reads.md and run over every
//     text/input/output, replacing matches with REDACTION_MARKER.
//   - size cap: each tool output is capped at MAX_TOOL_OUTPUT chars; when cut,
//     the node carries truncated:true.

const REDACTION_MARKER = '[redacted]';
const MAX_TOOL_OUTPUT = 4000;

/** Read the no-secret-reads guardrail rule's `pattern:` field at runtime (the
 *  redaction regex is the project's, never hardcoded). Returns a RegExp (global)
 *  or null when the rule file is absent/unparseable/empty. Fail-soft. */
export function redactionRegex(agentDir) {
  try {
    const file = join(agentDir, 'guardrails', 'items', 'no-secret-reads.md');
    const text = readFileSync(file, 'utf8');
    // The pattern lives as an indented `pattern: "<regex>"` line in frontmatter.
    const m = text.match(/^\s*pattern:\s*(.+)$/m);
    if (!m) return null;
    let raw = m[1].trim();
    // Strip surrounding quotes (double or single), un-escaping a double-quoted scalar.
    if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
      try { raw = JSON.parse(raw); } catch { raw = raw.slice(1, -1); }
    } else if (raw.startsWith("'") && raw.endsWith("'") && raw.length >= 2) {
      raw = raw.slice(1, -1);
    }
    if (!raw) return null;
    return new RegExp(raw, 'g');
  } catch {
    return null;
  }
}

/** Apply the redaction regex to a string (fail-soft: no regex → unchanged). */
function redact(s, re) {
  if (typeof s !== 'string' || !s || !re) return s;
  re.lastIndex = 0;
  return s.replace(re, REDACTION_MARKER);
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

// ── session diff: "what changed" (the git-native wedge) ────────────────────
// Every session is a `zz/session-*` branch off mainBranch (squash-merged on end).
// "What this session changed" resolves to a base/tip range:
//   • live/leftover branch exists → mainBranch...branch (three-dot: what the
//     session introduced since it diverged) — the reliable, high-value case;
//   • merged/past (branch gone) → best-effort from the recorded git.commit
//     (`git show <commit>`); unresolvable → { available:false }.
// All git via the fail-soft argv `git()` wrapper — never throws.

const MAX_FILE_DIFF = 200_000; // size cap for one file's unified diff

/** Resolve a session record to a diff range, or null when none is available. */
function resolveDiffRange(cwd, s) {
  const branch = sessionBranchName(s.id);
  if (branchExists(cwd, branch)) {
    const base = mainBranch(cwd);
    if (base && base !== branch) return { kind: 'branch', base, tip: branch };
  }
  const commit = s.git?.commit;
  if (commit && git(['rev-parse', '-q', '--verify', `${commit}^{commit}`], cwd).ok) {
    return { kind: 'commit', base: `${commit}~1`, tip: commit };
  }
  return null;
}

/** git args for a numstat/name-status read over a resolved range. */
function diffArgs(range, flag) {
  return range.kind === 'branch'
    ? ['diff', flag, `${range.base}...${range.tip}`]
    : ['show', flag, '--format=', range.tip];
}

function parseNumstat(out) {
  const map = new Map();
  for (const line of (out || '').split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const [a, d, ...rest] = parts;
    const path = rest.join('\t');
    map.set(path, { additions: a === '-' ? 0 : Number(a) || 0, deletions: d === '-' ? 0 : Number(d) || 0 });
  }
  return map;
}

function parseNameStatus(out) {
  const map = new Map();
  for (const line of (out || '').split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    const status = (parts[0] || 'M')[0]; // R100/C75 → R/C
    const path = parts[parts.length - 1];
    if (path) map.set(path, status);
  }
  return map;
}

const matchSession = (sessions, idArg) => {
  const exact = sessions.filter((s) => s.id === idArg);
  return (exact.length ? exact : sessions.filter((s) => String(s.id).startsWith(idArg)))[0] ?? null;
};

/** `{ sessionId, available, base?, tip?, totals:{files,additions,deletions}, files:[{path,status,additions,deletions}] }` */
export function sessionDiffData(cwd, idArg) {
  if (!idArg) return null;
  const s = matchSession(readIndex(cwd).sessions, idArg);
  if (!s) return null;
  const empty = { sessionId: s.id, available: false, files: [], totals: { files: 0, additions: 0, deletions: 0 } };
  const range = resolveDiffRange(cwd, s);
  if (!range) return empty;
  try {
    const num = parseNumstat(git(diffArgs(range, '--numstat'), cwd).out);
    const names = parseNameStatus(git(diffArgs(range, '--name-status'), cwd).out);
    const files = [];
    let additions = 0;
    let deletions = 0;
    for (const [path, c] of num) {
      files.push({ path, status: names.get(path) ?? 'M', additions: c.additions, deletions: c.deletions });
      additions += c.additions;
      deletions += c.deletions;
    }
    for (const [path, status] of names) {
      if (!num.has(path)) files.push({ path, status, additions: 0, deletions: 0 });
    }
    files.sort((a, b) => a.path.localeCompare(b.path));
    return { sessionId: s.id, available: true, base: range.base, tip: range.tip, totals: { files: files.length, additions, deletions }, files };
  } catch {
    return empty;
  }
}

/** `{ sessionId, path, diff }` — the unified diff for ONE file, size-capped. */
export function sessionFileDiffData(cwd, idArg, path) {
  if (!idArg || !path) return null;
  const s = matchSession(readIndex(cwd).sessions, idArg);
  if (!s) return null;
  const range = resolveDiffRange(cwd, s);
  if (!range) return { sessionId: s.id, path, diff: '' };
  try {
    const args = range.kind === 'branch'
      ? ['diff', `${range.base}...${range.tip}`, '--', path]
      : ['show', '--format=', range.tip, '--', path];
    let diff = git(args, cwd).out || '';
    let truncated = false;
    if (diff.length > MAX_FILE_DIFF) {
      diff = diff.slice(0, MAX_FILE_DIFF);
      truncated = true;
    }
    return { sessionId: s.id, path, diff, ...(truncated ? { truncated: true } : {}) };
  } catch {
    return { sessionId: s.id, path, diff: '' };
  }
}

const fmtDur = (ms) => (ms < 60_000 ? `${(ms / 1000).toFixed(0)}s` : `${(ms / 60_000).toFixed(1)}m`);

/** `zuzuu sessions [--json]` — the recorded-sessions list with state labels. */
export function sessions(args = {}) {
  const cwd = process.cwd();
  const d = sessionsListData(cwd);
  if (args.json) { console.log(JSON.stringify(d)); return; }
  if (!d.sessions.length) {
    console.log('no recorded sessions yet — run `zuzuu capture`, or just start your agent (live capture)');
    return;
  }
  console.log('  STATE      HOST          DUR     T/TOOLS/ERR  STARTED               SESSION');
  for (const s of d.sessions) {
    const dur = fmtDur(s.durationMs || 0).padStart(6);
    const cnt = `${s.counts.turns}/${s.counts.tools}/${s.counts.errors}`.padEnd(11);
    const started = (s.startedAt ?? '').slice(0, 19).padEnd(20);
    console.log(`  ${s.state.padEnd(10)} ${s.host.padEnd(13)} ${dur}  ${cnt}  ${started}  ${String(s.id).slice(0, 8)}`);
  }
  console.log(`\n${d.sessions.length} session(s) — inspect one: zuzuu session inspect <id>`);
}

/** `zuzuu session inspect <id> [--json]` — print one session's document. */
export function sessionInspect(args = {}) {
  const cwd = process.cwd();
  const id = args._?.[1];
  const d = sessionInspectData(cwd, id);
  if (!d) {
    console.error(id ? `no recorded session matching '${id}'` : 'usage: zuzuu session inspect <id> [--json]');
    process.exit(1);
  }
  if (args.json) { console.log(JSON.stringify(d)); return; }
  const s = d.session;
  console.log(`${s.id} — ${s.host} · ${s.state}`);
  console.log(`  started: ${s.startedAt ?? '?'}  ended: ${s.endedAt ?? '?'}  dur: ${fmtDur(s.durationMs || 0)}`);
  console.log(`  git: ${s.git?.commit ? s.git.commit.slice(0, 8) : '-'} (${s.git?.branch ?? '-'})  generation: ${s.generation ?? '-'}`);
  console.log(`  trace: ${d.trace.spans ?? '?'} span(s) · ${d.trace.tools} tool(s) · ${fmtDur(d.trace.duration || 0)}`);
  const sigs = Object.entries(d.signals);
  if (sigs.length) {
    console.log('  signals:');
    for (const [module, counts] of sigs) {
      const parts = Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' · ');
      console.log(`    ${module.padEnd(13)} ${parts}`);
    }
  }
  for (const w of d.warnings) console.log(`  ⚠ ${w}`);
}

/** `zuzuu session tree <id> [--json]` — nested SESSION→TURN→TOOL tree. */
export function sessionTree(args = {}) {
  const cwd = process.cwd();
  const id = args._?.[1];
  const d = sessionTreeData(cwd, id);
  if (!d) {
    console.error(id ? `no recorded session matching '${id}'` : 'usage: zuzuu session tree <id> [--json]');
    process.exit(1);
  }
  if (args.json) { console.log(JSON.stringify(d)); return; }
  if (!d.root) { console.log(`${d.sessionId}: no trace tree (blob missing or empty)`); return; }
  console.log(`${d.sessionId}: session tree`);
  function printNode(node, depth) {
    const indent = '  '.repeat(depth);
    const status = node.status ? ` [${node.status}]` : '';
    const ts = node.ts.slice(11, 19); // HH:MM:SS
    console.log(`${indent}${ts}  ${node.kind.padEnd(7)}  ${node.label}${status}`);
    for (const child of node.children ?? []) printNode(child, depth + 1);
  }
  printNode(d.root, 0);
}

/** `zuzuu session content <id> [--json]` — ordered DISPLAY content nodes read
 *  on demand from the host transcript (agent text + tool input/output). */
export function sessionContent(args = {}) {
  const cwd = process.cwd();
  const id = args._?.[1];
  const d = sessionContentData(cwd, id);
  if (!d) {
    console.error(id ? `no recorded session matching '${id}'` : 'usage: zuzuu session content <id> [--json]');
    process.exit(1);
  }
  if (args.json) { console.log(JSON.stringify(d)); return; }
  if (!d.nodes.length) { console.log(`${d.sessionId}: no content (transcript missing or host thin)`); return; }
  console.log(`${d.sessionId}: ${d.nodes.length} content node(s)`);
  for (const n of d.nodes) {
    const ts = n.ts ? n.ts.slice(11, 19) : '--:--:--';
    if (n.kind === 'tool') {
      const status = n.status ? ` [${n.status}]` : '';
      console.log(`  ${ts}  tool   ${n.label}${status}`);
      if (n.toolInput) console.log(`           in:  ${n.toolInput.split('\n')[0].slice(0, 100)}`);
      if (n.toolOutput) console.log(`           out: ${n.toolOutput.split('\n')[0].slice(0, 100)}${n.truncated ? ' …(truncated)' : ''}`);
    } else {
      console.log(`  ${ts}  ${n.kind === 'agent_text' ? 'agent' : 'user '}  ${(n.text || '').split('\n')[0].slice(0, 100)}`);
    }
  }
}

/** `zuzuu session trace <id> [--json]` — ordered per-action records. */
export function sessionTrace(args = {}) {
  const cwd = process.cwd();
  const id = args._?.[1];
  const d = sessionTraceData(cwd, id);
  if (!d) {
    console.error(id ? `no recorded session matching '${id}'` : 'usage: zuzuu session trace <id> [--json]');
    process.exit(1);
  }
  if (args.json) { console.log(JSON.stringify(d)); return; }
  if (!d.actions.length) { console.log(`${d.sessionId}: no trace actions (blob missing or empty)`); return; }
  console.log(`${d.sessionId}: ${d.actions.length} action(s)`);
  for (const a of d.actions) {
    const status = a.status ? ` [${a.status}]` : '';
    const ts = a.ts.slice(11, 19); // HH:MM:SS
    console.log(`  ${ts}  ${a.kind.padEnd(5)}  ${a.label}${status}`);
  }
}

/** `zuzuu session diff <id> [--json] [--file <path>]` — what the session changed
 *  (files + per-file unified diff), resolved from its git branch / merge commit. */
export function sessionDiff(args = {}) {
  const cwd = process.cwd();
  const id = args._?.[1];
  const file = args.file;
  if (file) {
    const d = sessionFileDiffData(cwd, id, file);
    if (!d) {
      console.error(id ? `no recorded session matching '${id}'` : 'usage: zuzuu session diff <id> --file <path> [--json]');
      process.exit(1);
    }
    if (args.json) { console.log(JSON.stringify(d)); return; }
    console.log(d.diff || `${d.sessionId}: no diff for ${file}`);
    return;
  }
  const d = sessionDiffData(cwd, id);
  if (!d) {
    console.error(id ? `no recorded session matching '${id}'` : 'usage: zuzuu session diff <id> [--json] [--file <path>]');
    process.exit(1);
  }
  if (args.json) { console.log(JSON.stringify(d)); return; }
  if (!d.available) { console.log(`${d.sessionId}: diff not available (branch merged or gone)`); return; }
  if (!d.files.length) { console.log(`${d.sessionId}: no changes`); return; }
  console.log(`${d.sessionId}: ${d.totals.files} file(s)  +${d.totals.additions} −${d.totals.deletions}`);
  for (const f of d.files) {
    console.log(`  ${f.status}  +${f.additions} −${f.deletions}  ${f.path}`);
  }
}
