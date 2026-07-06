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
//
// BINDING DISPATCH (§I.1/§I.6, notes/validate.mjs's `bindingOf`): a note's `binding`
// picks HOW it runs — absent/`shell` is everything above, unchanged. `mcp` and `agent`
// dispatch BEFORE the run lock/gate/timeout machinery (nothing actually runs, so
// nothing to lock or log): `mcp` is a clean, explicit stub (the MCP client is a
// follow-on build — no fake success); `agent` would delegate the note's PROMPT
// (`promptOf`) to the host over the ACP lane, but ACP is daemon-only today
// (`web/src/server/acp.ts` — not reachable from this CLI process), so the CLI binding
// returns a structured `{needsHost:true}` requirement rather than silently no-opping
// OR headless-spawning a host session behind the interactive-first doctrine's back.
// See docs/guide/Tools.md for the full model + what a hosted daemon does instead.
//
// SECRETS (§J.3/§J.5, use/secrets.mjs): a note's `secrets: [name]` list is resolved
// HERE — before the lock, before spawnSync — each name gated by its OWN `type: secret`
// declaration's scope allowlist + operator-only/agent-allowed actor. The resolved
// VALUE goes straight into the child's env (runGated's `secretsEnv`, merged after
// `inputs`); it never rides `inputs`, never rides `runs.jsonl` (logRun's `secretNames`
// extends its own redaction set with whatever those names resolved to). This is the
// placeholder-injection pattern (browser-use): an agent-run tool's context only ever
// holds the NAME — the tool layer (this file) is the only reader of the actual value.
// S3 (audit 2026-07-03-secrets-review.md): the RETURN value's stdout/stderr are the
// one surface the value CAN legitimately reach (a tool echoing `$ZZ_<NAME>`) — those
// two fields are redacted (notes/log.mjs's `redactText`) before `act()` returns, using
// the SAME values just injected into the child's env. Every other field of the return
// (`secretsResolved`, etc.) only ever held the NAME to begin with. See docs/guide/Secrets.md.

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve as resolvePath, sep } from 'node:path';
import { parse } from '../notes/note.mjs';
import { itemPath, repoRoot } from '../notes/store.mjs';
import { logRun, redactText } from '../notes/log.mjs';
import { gate } from '../guardrails/gate.mjs';
import { acquireRunLock, LOCK_GRACE_MS } from './run-lock.mjs';
import { bindingOf } from '../notes/validate.mjs';
import { resolveSecret } from './secrets.mjs';

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
 * `opts.gateActor` (optional — the wake-source rung's KTD2 decoupling) OVERRIDES
 * `actor` for JUST that gate posture, independent of whatever `actor` itself means to
 * the caller (e.g. `grow/run.mjs` keeps `actor:'operator'` for its own write
 * authorization while passing `gateActor:'agent'` for an unattended run's steps) —
 * see `guardrails/gate.mjs`'s `gate()` doc comment for the full rationale.
 * @returns {{ ran, exitCode?, success?, stdout?, stderr?, denied?, timedOut?, error? }}
 */
export function runGated(home, module, command, { allow = null, inputs = {}, cwd, timeout, actor = 'operator', secretsEnv = {}, gateActor } = {}) {
  // the gate applies to curated runs too — a deny rule blocks them. No explicit
  // module → it enforces both `instructions` (the default) and legacy `guardrails`.
  const verdict = gate({ home, actor, gateActor }, { tool: 'Bash', input: { command } });
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
  // secrets (§J.3, the placeholder-injection/browser-use pattern): pre-resolved
  // `{ZZ_<NAME>: value}` pairs, built by act() BEFORE this call — never derived from
  // `inputs`, so a caller can't smuggle a fake value in under a colliding key. Merged
  // LAST, so a resolved secret always wins over any same-named input. This is the ONE
  // place the real value touches an env object; it never rides `inputs` (which
  // `logRun` below writes to runs.jsonl, redacted or not).
  for (const [k, v] of Object.entries(secretsEnv)) env[k] = v;
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
 * rather than letting two invocations' children interleave. `ctx.via` (optional) is
 * the composing workflow's `module:id` — set only by `use/workflow.mjs`'s note-ref
 * composition (§I rung 1); it rides straight into `logRun`'s `via` marker and is
 * absent (undefined) for every normal, non-composed call, so a standalone `zz act`'s
 * `runs.jsonl` entry is unchanged. Dispatches by the note's `binding` (shell/agent/mcp
 * — see this file's header comment); `needsHost:true` marks the agent-binding's
 * structured "run this via a host session" requirement.
 *
 * SECRETS (§J.3/§J.5): a shell-binding note's `secrets: [name]` list is resolved HERE,
 * before the run lock — each name through `use/secrets.mjs`'s `resolveSecret`, gated
 * by ITS OWN `type: secret` declaration (scope allowlist + operator-only/agent-allowed
 * actor). ANY resolution failure refuses the WHOLE run before it starts (fail-closed —
 * never a partially-secreted run). The resolved values are substituted into the
 * CHILD's env as `ZZ_<NAME>` at the injection site (runGated, above) — this function
 * (and everything above it: the caller, an agent's context, `secretsResolved` on the
 * return value) only ever sees the NAME, never the value; `logRun` redacts the names'
 * env values out of the logged `inputs` too (§J.3: "the agent's context/transcript/
 * staged notes only ever hold `secret:name`" — the placeholder-injection pattern).
 * `ctx.gateActor` (optional — KTD2, see guardrails/gate.mjs) rides straight through to
 * the gate call inside `runGated`, below, decoupled from `ctx.actor` — absent, the
 * gate posture derives from `ctx.actor` exactly as before.
 * @returns {{ ok, ran, exitCode?, success?, stdout?, stderr?, timedOut?, error?, denied?, running?, needsHost?, secretsResolved? }}
 */
export function act(ctx, id, inputs = {}) {
  const { home, module, manifest, actor = 'operator', via, gateActor } = ctx;
  const path = itemPath(home, module, id);
  if (!existsSync(path)) return { ok: false, ran: false, error: `no note '${module}:${id}'` };
  const { ok, note } = parse(readFileSync(path, 'utf8'), { id });
  if (!ok || !note) return { ok: false, ran: false, error: `unparseable note '${id}'` };

  // binding dispatch (see header comment) — mcp/agent never reach the run lock or
  // runGated: nothing actually ran, so there is nothing to lock, time out, or log.
  const binding = bindingOf(note);
  if (binding === 'mcp') {
    return { ok: false, ran: false, error: 'mcp binding: client not yet implemented (follow-on build)' };
  }
  if (binding === 'agent') {
    return {
      ok: false, ran: false, needsHost: true,
      error: 'agent binding requires a host session — run via the workbench / zz host (ACP is daemon-only today; a hosted daemon dispatches this over ACP — see docs/guide/Tools.md)',
    };
  }

  if (!note.run) return { ok: false, ran: false, error: `note '${id}' is not runnable (no run)` };

  // secrets (§J.3): resolve BEFORE the lock — a denial must never spawn anything, let
  // alone hold a lock while doing it. `caller` is this tool's own address (the SAME
  // shape a scope entry's `module:tool` / `tool:x` forms match against).
  const secretNames = Array.isArray(note.secrets) ? note.secrets : [];
  const secretsEnv = {};
  for (const name of secretNames) {
    const r = resolveSecret(home, name, { caller: `${module}:${id}`, actor });
    if (!r.ok) return { ok: false, ran: false, error: `secret '${name}': ${r.error}` };
    secretsEnv[`ZZ_${name}`] = r.value;
  }

  // the run lock's staleness window is THIS run's own resolved timeout + grace — a
  // held lock younger than that is presumed a genuinely running note; older, its
  // holder almost certainly crashed past its own timeout, so it's stolen.
  const lock = acquireRunLock(home, module, id, resolveTimeoutMs(note.timeout) + LOCK_GRACE_MS);
  if (!lock.ok) return { ok: false, ran: false, ...lock };
  try {
    // policy: the note's own policy narrows the module default (never widens)
    const policy = { ...(manifest.policy ?? {}), ...(note.policy ?? {}) };
    const r = runGated(home, module, note.run, { allow: policy.run?.allow ?? null, inputs, timeout: note.timeout, actor, secretsEnv, gateActor });
    if (!r.ran) return { ok: false, ...r };
    // S3 (audit 2026-07-03-secrets-review.md) — a resolved secret's value must never
    // survive into the RETURNED stdout/stderr: that return IS the caller's context (an
    // agent-actor's dispatch reply included — the daemon relays this straight back),
    // and a tool that echoes `$ZZ_<NAME>` would otherwise leak the plaintext into it.
    // runs.jsonl was already safe (logRun never records stdout/stderr) — the RETURN
    // was not. Redact using the SAME resolved values that were just injected into the
    // child's env (secretsEnv, built above) — not a re-read of process.env by name
    // (readDeclaredSecretEnvValues), since that only covers resolves_from: env/fly;
    // this covers every resolves_from kind uniformly. Unconditional (not actor-gated):
    // an operator's own terminal shouldn't echo the plaintext back through this API
    // either — "ideally always" per the audit's own fix note.
    const secretValues = Object.values(secretsEnv);
    const safeR = secretValues.length
      ? { ...r, stdout: redactText(r.stdout, secretValues), stderr: redactText(r.stderr, secretValues) }
      : r;
    logRun(home, module, id, { inputs, exitCode: r.exitCode, success: r.success, timedOut: r.timedOut, actor, via, secretNames });
    // `secretsResolved` is NAMES only (never values) — the audit trail a higher layer
    // (serve/api.mjs's `act` wrapper, which may write) can use to touch each
    // declaration's `last_used`; use/ itself never writes (architecture rule 6).
    return { ok: r.success, ...safeR, ...(secretNames.length ? { secretsResolved: secretNames } : {}) };
  } finally {
    lock.release();
  }
}
