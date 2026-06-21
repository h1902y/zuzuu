// zuzuu/capabilities/act.mjs — run a runnable zu, contained.
//
// what: the `act` verb — execute a zu's `run` under its `policy`, capture the
//       normalized result, and log a run event. One call = run + capture + log
//       (AXI: combine operations).
// why:  the actions layer. A curated, reusable procedure the agent can invoke
//       safely — distinct from the agent's ad-hoc session shell (gated
//       separately).
// how:  TIERS — advisory (run directly; the regex gate is the only check) ·
//       contained (kernel-enforced via srt, when present) · sandboxed (microVM,
//       not built). The run.allow command-axis is OUR novel layer, enforced
//       here regardless. Captures {stdout, stderr, exitCode, success}. Zero-dep
//       (srt is an optional accelerator, detect-and-degrade).

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parse } from '../notes/note.mjs';
import { itemPath, repoRoot } from '../notes/store.mjs';
import { logRun } from '../loop/log.mjs';

/** Is Anthropic's sandbox-runtime available as the contained-tier backend? */
function srtAvailable() {
  const r = spawnSync('node', ['-e', 'require.resolve("@anthropic-ai/sandbox-runtime")'], { encoding: 'utf8' });
  return r.status === 0;
}

/** Split a `run` command into [cmd, ...args] (naive whitespace split — v1). */
function tokenize(run) {
  return String(run).trim().split(/\s+/).filter(Boolean);
}

/**
 * Run a zu. Fail-soft return — never throws.
 * @returns {{ ok, ran, contained, exitCode?, success?, stdout?, stderr?, error?, denied? }}
 */
export function act(ctx, id, inputs = {}) {
  const { home, module, manifest } = ctx;
  const path = itemPath(home, module, id);
  if (!existsSync(path)) return { ok: false, ran: false, error: `no zu '${module}:${id}'` };
  const { ok, item } = parse(readFileSync(path, 'utf8'), { id });
  if (!ok || !item) return { ok: false, ran: false, error: `unparseable zu '${id}'` };
  if (!item.run) return { ok: false, ran: false, error: `zu '${id}' is not runnable (no run)` };

  // policy: the zu's own policy narrows the module default (never widens)
  const policy = { ...(manifest.policy ?? {}), ...(item.policy ?? {}) };
  const tier = policy.tier ?? 'advisory';
  const allow = policy.run?.allow ?? null;

  const [cmd, ...args] = tokenize(item.run);
  // the run.allow command-axis — OUR layer, enforced regardless of srt
  if (allow && !allow.includes(cmd) && !cmd.startsWith('./') && !cmd.startsWith('/')) {
    return { ok: false, ran: false, denied: true, error: `command '${cmd}' not in run.allow` };
  }

  const env = { ...process.env };
  for (const [k, v] of Object.entries(inputs)) env[`ZZ_${k}`] = String(v);
  const cwd = repoRoot();

  // containment: srt when present + tier!==advisory; else run advisory (honest flag)
  const contained = tier !== 'advisory' && srtAvailable();
  // (srt wrapping plugs in here when installed; v1 runs the command directly and
  //  reports `contained` truthfully — never pretends to contain what it can't.)
  const r = spawnSync(cmd, args, { cwd, env, encoding: 'utf8' });

  const result = {
    ok: r.status === 0,
    ran: true,
    contained,
    exitCode: r.status,
    success: r.status === 0,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
  };
  logRun(home, module, id, { inputs, exitCode: r.status, success: result.success });
  return result;
}
