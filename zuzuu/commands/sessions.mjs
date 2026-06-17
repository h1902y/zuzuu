// zuzuu/commands/sessions.mjs — the sessions observability CLI surface (overhaul
// Part A, 2026-06-13; per-action trace records added U6 2026-06-15). Split into
// single-responsibility modules under ./sessions/ (2026-06-17): trace-blob
// walking (trace.mjs), display-time redaction (redact.mjs), the data layer
// (data.mjs), and the git-diff layer (diff.mjs). This file is the CLI handlers
// that render those documents; the data functions are re-exported below so the
// daemon + tests keep importing them from here unchanged.
//
//   zuzuu sessions [--json]              recorded sessions w/ state labels
//   zuzuu session inspect <id> [--json]  one session: trace summary +
//                                        per-module mined signals
//   zuzuu session trace <id> [--json]    ordered per-action records from
//                                        the captured OTLP blob

import { readIndex } from '../core/store.mjs';
import { setSessionLabel } from '../sessions/labels.mjs';
import {
  matchSession,
  sessionsListData,
  sessionTreeData,
  sessionTraceData,
  sessionInspectData,
  sessionContentData,
} from './sessions/data.mjs';
import {
  sessionDiffData,
  sessionFileDiffData,
  sessionFileAuthorsData,
} from './sessions/diff.mjs';

// Re-export the data surface so existing importers (daemon, tests) are unaffected.
export {
  sessionsListData,
  sessionTreeData,
  sessionTraceData,
  sessionInspectData,
  sessionContentData,
} from './sessions/data.mjs';
export {
  sessionDiffData,
  sessionFileDiffData,
  sessionFileAuthorsData,
  fileAuthorsFromNodes,
} from './sessions/diff.mjs';
export { redactionRegex } from './sessions/redact.mjs';

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

/** `zuzuu session label <id> --text "<label>" [--json]` — set/clear a user name
 *  for a session (a blank --text clears it). Persisted outside the index so it
 *  survives re-capture. */
export function sessionLabel(args = {}) {
  const cwd = process.cwd();
  const id = args._?.[1];
  const s = id ? matchSession(readIndex(cwd).sessions, id) : null;
  if (!s) {
    console.error(id ? `no recorded session matching '${id}'` : 'usage: zuzuu session label <id> --text "<label>" [--json]');
    process.exit(1);
  }
  setSessionLabel(cwd, s.id, args.text ?? '');
  const label = String(args.text ?? '').trim() || null;
  const d = { sessionId: s.id, label };
  if (args.json) { console.log(JSON.stringify(d)); return; }
  console.log(label ? `labelled ${s.id}: ${label}` : `cleared label for ${s.id}`);
}

/** `zuzuu session diff <id> [--json] [--file <path>] [--authors]` — what the
 *  session changed (files + per-file unified diff), resolved from its git branch
 *  / merge commit. `--authors` (W2b): trace-linked diff — each changed file → the
 *  turn that wrote it (the last tool node whose toolInput mentions the path). */
export function sessionDiff(args = {}) {
  const cwd = process.cwd();
  const id = args._?.[1];
  const file = args.file;
  // --authors: trace-linked diff (changed file → the turn that wrote it).
  if (args.authors) {
    const d = sessionFileAuthorsData(cwd, id);
    if (!d) {
      console.error(id ? `no recorded session matching '${id}'` : 'usage: zuzuu session diff <id> --authors [--json]');
      process.exit(1);
    }
    if (args.json) { console.log(JSON.stringify(d)); return; }
    const entries = Object.entries(d.authors);
    if (!entries.length) { console.log(`${d.sessionId}: no trace-linked authors (diff or transcript unavailable)`); return; }
    console.log(`${d.sessionId}: ${entries.length} file author(s)`);
    for (const [path, a] of entries) {
      const ts = a.ts ? a.ts.slice(11, 19) : '--:--:--';
      console.log(`  ${ts}  ${a.turn.padEnd(10)}  ${path}`);
    }
    return;
  }
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
