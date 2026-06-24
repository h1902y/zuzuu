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

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve as resolvePath, sep } from 'node:path';
import { parse } from '../notes/note.mjs';
import { itemPath, repoRoot } from '../notes/store.mjs';
import { logRun } from '../notes/log.mjs';
import { gate } from '../guardrails/gate.mjs';

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
 * Run a note. Fail-soft return — never throws.
 * @returns {{ ok, ran, exitCode?, success?, stdout?, stderr?, error?, denied? }}
 */
export function act(ctx, id, inputs = {}) {
  const { home, module, manifest } = ctx;
  const path = itemPath(home, module, id);
  if (!existsSync(path)) return { ok: false, ran: false, error: `no note '${module}:${id}'` };
  const { ok, note } = parse(readFileSync(path, 'utf8'), { id });
  if (!ok || !note) return { ok: false, ran: false, error: `unparseable note '${id}'` };
  if (!note.run) return { ok: false, ran: false, error: `note '${id}' is not runnable (no run)` };

  // policy: the note's own policy narrows the module default (never widens)
  const policy = { ...(manifest.policy ?? {}), ...(note.policy ?? {}) };
  const allow = policy.run?.allow ?? null;

  // the guardrails gate applies to curated runs too — a deny rule blocks them
  const verdict = gate({ home, module: 'guardrails' }, { tool: 'Bash', input: { command: note.run } });
  if (verdict && verdict.action === 'deny') {
    return { ok: false, ran: false, denied: true, error: `blocked by guardrail ${verdict.rule}: ${verdict.reason}` };
  }

  const cwd = repoRoot();
  const [cmd, ...args] = tokenize(note.run);
  // the run.allow command-axis — OUR layer: allowlisted, or a repo-local script.
  // An absolute path OUTSIDE the repo (e.g. /bin/sh) does NOT bypass the allowlist.
  if (allow && !allow.includes(cmd) && !underRepo(cmd, cwd)) {
    return { ok: false, ran: false, denied: true, error: `command '${cmd}' not in run.allow` };
  }

  const env = { ...process.env };
  for (const [k, v] of Object.entries(inputs)) env[`ZZ_${k}`] = String(v);

  const r = spawnSync(cmd, args, { cwd, env, encoding: 'utf8' });

  const result = {
    ok: r.status === 0,
    ran: true,
    exitCode: r.status,
    success: r.status === 0,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
  logRun(home, module, id, { inputs, exitCode: r.status, success: result.success });
  return result;
}
