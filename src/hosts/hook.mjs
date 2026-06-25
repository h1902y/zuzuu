// src/hosts/hook.mjs — the host lifecycle callback (Design B).
//
// what: the command a host invokes on lifecycle/tool events. It maps every
//       host's events onto one open/turn/end path + the PreToolUse gate. It
//       SIGNALS — it never builds spans (v2 mines transcripts directly).
// why:  this is how the loop stays fed and bounded without driving the host:
//       open → ground (digest) + start the session branch; turn → checkpoint;
//       end → squash-merge + OBSERVE (mine the just-finished session into
//       proposals); PreToolUse → enforce the guardrails gate.
// how:  fail-open EVERYWHERE (a hook must never break the host — every branch is
//       try-wrapped, runHook always exits 0). The gate emitting no decision =
//       the host's normal permission flow. Zero-dep.

import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { homeDir, repoRoot, stateDir } from '../notes/store.mjs';
import { gate, toPreToolUseDecision } from '../guardrails/gate.mjs';
import { sessionGitEnabled, openSession, checkpoint, closeSession } from '../sessions/session-git.mjs';
import { inSessionWorktree } from '../sessions/session-worktree.mjs';
import { observe } from '../grow/observe.mjs';
import { captureSignals } from './capture.mjs';
import { digestText } from '../serve/digest.mjs';
import { open as apiOpen } from '../serve/api.mjs';

// Host event vocabularies, mapped to one path (verified per-host wire data):
// Claude SessionStart/Stop/SessionEnd · OpenCode session.created/idle/deleted
// Gemini SessionStart/AfterAgent/SessionEnd · Codex SessionStart/UserPromptSubmit/Stop
const OPEN = new Set(['SessionStart', 'session.created', 'session_start']);
const TURN = new Set(['Stop', 'session.idle', 'AfterAgent', 'UserPromptSubmit', 'turn_end']);
const END = new Set(['SessionEnd', 'session.deleted', 'session_shutdown']);
const GATE = new Set(['PreToolUse', 'BeforeTool']);

const safeName = (id) => `guardrails-${String(id || 'unknown').replace(/[^A-Za-z0-9._-]/g, '_').slice(-120) || 'unknown'}.jsonl`;

/**
 * The guardrails gate. Returns the host's block decision, or null = fail-open
 * (engine error / no match / no rules → the host's normal flow). Logs matches.
 */
export function gateDecision({ host = 'claude-code', payload = {}, cwd = process.cwd() } = {}) {
  try {
    const home = homeDir(repoRoot(cwd));
    const verdict = gate({ home, module: 'guardrails' }, { tool: payload.tool_name, input: payload.tool_input });
    if (verdict) {
      try {
        const state = stateDir(home);
        mkdirSync(state, { recursive: true });
        appendFileSync(join(state, safeName(payload.session_id)), JSON.stringify({ at: new Date().toISOString(), host, tool: payload.tool_name, ...verdict }) + '\n');
      } catch { /* logging must not affect the gate */ }
    }
    return toPreToolUseDecision(verdict); // null-safe
  } catch { return null; } // fail open
}

/** Write the session-start brief to the XDG state dir's digest.md (every host reads it). */
export function writeDigest(cwd = process.cwd()) {
  try {
    const text = digestText(cwd);
    if (!text || !text.trim()) return;
    const state = stateDir(homeDir(repoRoot(cwd)));
    mkdirSync(state, { recursive: true });
    writeFileSync(join(state, 'digest.md'), text);
  } catch { /* grounding is best-effort */ }
}

/** Claude Code's SessionStart additionalContext (inline grounding), or null. */
function sessionStartContext(cwd = process.cwd()) {
  try {
    const text = digestText(cwd);
    return text && text.trim() ? { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } } : null;
  } catch { return null; }
}

/**
 * The host-agnostic lifecycle dispatch. Drives the session branch + grounding +
 * (on end) the observe mine. Pure-ish (injected cwd) for tests. Fail-open per branch.
 */
export function handleHook({ event, payload = {}, cwd = process.cwd(), host = 'claude-code' }) {
  const id = payload.session_id;
  if (OPEN.has(event)) {
    // In a daemon-owned worktree the agent is already on its branch — defer.
    try { if (id && sessionGitEnabled(cwd) && !inSessionWorktree(cwd)) openSession(cwd, id); } catch { /* git trouble never blocks grounding */ }
    try { apiOpen(cwd).registry.touch(); } catch { /* auto-track is best-effort, never blocks the host */ }
    writeDigest(cwd);
  } else if (TURN.has(event)) {
    try { if (sessionGitEnabled(cwd)) checkpoint(cwd); } catch { /* fail-open — commits only on the session branch */ }
  } else if (END.has(event)) {
    try { if (sessionGitEnabled(cwd) && !inSessionWorktree(cwd)) closeSession(cwd, {}); } catch { /* fail-open */ }
    try { observe(homeDir(repoRoot(cwd)), { cwd, sessions: captureSignals({ cwd, scope: 'last' }) }); } catch { /* mining is best-effort */ }
    writeDigest(cwd);
  } else {
    return { event, skipped: 'unhandled event' };
  }
  return { event, id, host };
}

/**
 * CLI entry. Gate events read the tool call from stdin (Claude) and print a
 * decision; lifecycle events drive handleHook. ALWAYS exits 0.
 */
export function runHook(event, { host = 'claude-code', session, cwd = process.cwd() } = {}) {
  let payload = {};
  if ((host === 'opencode' || host === 'pi') && !GATE.has(event)) {
    payload = { session_id: session };
  } else {
    try { payload = JSON.parse(readFileSync(0, 'utf8')); } catch { /* no/garbage stdin */ }
  }
  try {
    if (GATE.has(event)) {
      const decision = gateDecision({ host, payload, cwd });
      if (decision) process.stdout.write(JSON.stringify(decision));
    } else {
      try { handleHook({ event, payload, host, cwd }); } catch { /* never blocks the host */ }
      if (event === 'SessionStart' && host === 'claude-code') {
        try { const ctx = sessionStartContext(cwd); if (ctx) process.stdout.write(JSON.stringify(ctx)); } catch { /* fail-open */ }
      }
    }
  } catch { /* never break the agent */ }
  process.exit(0);
}
