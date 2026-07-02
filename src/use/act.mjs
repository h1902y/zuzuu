// src/use/act.mjs — run a runnable note, gated.
//
// what: the `act` verb — execute a note's `run` under its `policy`, capture the
//       normalized result, and log a run event. One call = run + capture + log
//       (AXI: combine operations).
// why:  the actions layer. A curated, reusable procedure the agent can invoke —
//       distinct from the agent's ad-hoc session shell (gated separately).
// how:  EVERY run is first evaluated by the guardrails gate (a deny rule blocks
//       it — so a poisoned action note can't `rm -rf /`). Then the run.allow
//       command-axis — OUR layer: an explicit allowlist, plus repo-local scripts
//       (`./x`, or an absolute path UNDER the repo root) — an absolute path
//       OUTSIDE the repo is denied. Captures {stdout, stderr, exitCode, success}.
//       Zero-dep. Runs are gated + allowlisted, not OS-sandboxed.
//
// THE SAFETY FLOOR (§I rung 3): every run gets a TIMEOUT (spawnSync has no bound of
// its own); the gate fails CLOSED for an unattended `agent` actor (guardrails/
// gate.mjs); run-log inputs are redacted (notes/log.mjs); and act() refuses a SECOND
// concurrent run of the same note (use/run-lock.mjs) rather than letting two
// invocations' children interleave.

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve as resolvePath, sep } from 'node:path';
import { parse } from '../notes/note.mjs';
import { itemPath, repoRoot } from '../notes/store.mjs';
import { logRun } from '../notes/log.mjs';
import { gate } from '../guardrails/gate.mjs';
import { acquireRunLock, LOCK_GRACE_MS } from './run-lock.mjs';

// A run's `timeout:` field (seconds) is clamped into this window — no note, however
// trusted, can opt OUT of a bound (spawnSync with no timeout can hang forever); the
// default covers the vast majority of curated actions without the note author having
// to think about it.
export const DEFAULT_TIMEOUT_S = 120;
export const MAX_TIMEOUT_S = 600;

/** Resolve a declared `timeout:` (seconds, possibly absent/garbage) to a clamped
 *  MILLISECOND value for spawnSync. Non-numeric/non-positive → the default; anything
 *  over the cap is clamped down, never up. */
export function resolveTimeoutMs(raw) {
  const n = Number(raw);
  const seconds = Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_S;
  return Math.min(seconds, MAX_TIMEOUT_S) * 1000;
}

/** A repo-local script: a path that resolves to within the repo root. */
function underRepo(cmd, root) {
  if (!cmd.includes('/')) return false; // a bare command name must be on the allowlist
  const abs = resolvePath(root, cmd);
  return abs === root || abs.startsWith(root + sep);
}

/** Split a `run` command into [cmd, ...args] (naive whitespace split — v1). */
function tokenize(run) {
  return String(run).trim().split(/\s+/).filter(Boolean);
}

/**
 * Run ONE command under the execution gate: the guardrails gate (a deny blocks) +
 * the run.allow allowlist (allowlisted command OR a repo-local script) + a TIMEOUT
 * (every run gets one — `opts.timeout`, seconds, clamped by resolveTimeoutMs). The
 * shared primitive for `act` (one note) and the workflow runner (one step). No
 * logging here.
 * `opts.actor` ('operator' default | 'agent') rides into the guardrails gate — an
 * unattended agent actor fails CLOSED on a malformed rule / engine error / `ask`
 * verdict (see guardrails/gate.mjs); an interactive operator keeps the original
 * fail-open, ask-passes contract (a human is present to see the run and decide).
 * @returns {{ ran, exitCode?, success?, stdout?, stderr?, denied?, timedOut?, error? }}
 */
export function runGated(home, module, command, { allow = null, inputs = {}, cwd, timeout, actor = 'operator' } = {}) {
  // the gate applies to curated runs too — a deny rule blocks them. No explicit
  // module → it enforces both `instructions` (the default) and legacy `guardrails`.
  const verdict = gate({ home, actor }, { tool: 'Bash', input: { command } });
  if (verdict && verdict.action === 'deny') {
    return { ran: false, denied: true, error: `blocked by rule ${verdict.rule}: ${verdict.reason}` };
  }
  const root = cwd ?? repoRoot();
  const [cmd, ...args] = tokenize(command);
  // the run.allow command-axis — allowlisted, or a repo-local script. An absolute
  // path OUTSIDE the repo (e.g. /bin/sh) does NOT bypass the allowlist.
  if (allow && !allow.includes(cmd) && !underRepo(cmd, root)) {
    return { ran: false, denied: true, error: `command '${cmd}' not in run.allow` };
  }
  const env = { ...process.env };
  for (const [k, v] of Object.entries(inputs)) env[`ZZ_${k}`] = String(v);
  const ms = resolveTimeoutMs(timeout);
  // killSignal: SIGKILL — SIGTERM (spawnSync's default) is catchable/ignorable; a
  // run that installed a trap (or a hung child of the child) must actually die.
  const r = spawnSync(cmd, args, { cwd: root, env, encoding: 'utf8', timeout: ms, killSignal: 'SIGKILL' });
  if (r.error?.code === 'ETIMEDOUT') {
    return {
      ran: true, timedOut: true, success: false, exitCode: r.status,
      error: `run timed out after ${ms}ms (SIGKILL)`, stdout: r.stdout ?? '', stderr: r.stderr ?? '',
    };
  }
  return { ran: true, exitCode: r.status, success: r.status === 0, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/**
 * Run a note. Fail-soft return — never throws. `ctx.actor` (stamped at the dispatch
 * boundary — serve/dispatch.mjs's `invoke` always supplies it) rides into the
 * guardrails gate via runGated — see its doc comment for the fail-open/fail-closed
 * split. Refuses a concurrent run of the SAME note (the run lock, use/run-lock.mjs)
 * rather than letting two invocations' children interleave.
 * @returns {{ ok, ran, exitCode?, success?, stdout?, stderr?, timedOut?, error?, denied?, running? }}
 */
export function act(ctx, id, inputs = {}) {
  const { home, module, manifest, actor = 'operator' } = ctx;
  const path = itemPath(home, module, id);
  if (!existsSync(path)) return { ok: false, ran: false, error: `no note '${module}:${id}'` };
  const { ok, note } = parse(readFileSync(path, 'utf8'), { id });
  if (!ok || !note) return { ok: false, ran: false, error: `unparseable note '${id}'` };
  if (!note.run) return { ok: false, ran: false, error: `note '${id}' is not runnable (no run)` };

  // the run lock's staleness window is THIS run's own resolved timeout + grace — a
  // held lock younger than that is presumed a genuinely running note; older, its
  // holder almost certainly crashed past its own timeout, so it's stolen.
  const lock = acquireRunLock(home, module, id, resolveTimeoutMs(note.timeout) + LOCK_GRACE_MS);
  if (!lock.ok) return { ok: false, ran: false, ...lock };
  try {
    // policy: the note's own policy narrows the module default (never widens)
    const policy = { ...(manifest.policy ?? {}), ...(note.policy ?? {}) };
    const r = runGated(home, module, note.run, { allow: policy.run?.allow ?? null, inputs, timeout: note.timeout, actor });
    if (!r.ran) return { ok: false, ...r };
    logRun(home, module, id, { inputs, exitCode: r.exitCode, success: r.success, timedOut: r.timedOut, actor });
    return { ok: r.success, ...r };
  } finally {
    lock.release();
  }
}
