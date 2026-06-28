// src/metal/git.mjs — the one git primitive.
//
// what: `git(args, cwd, input) -> {ok, code, out, err}` — a single, safe-by-
//       construction git invocation (argv array only, never a shell string, never
//       throws), plus `out()`, the stdout-or-null reader sugar over it.
// why:  the metal was scattered — three independent `git()` wrappers (sessions,
//       store, generation) plus inline spawns. This is THE one. It carries the
//       richest contract: `code` distinguishes a clean merge (0) from a conflict (1)
//       from a fatal/usage error (128) — the discriminator the session engine's
//       merge-tree mergeability probe depends on. Promoting THIS one verbatim is what
//       lets the safety-critical session characterization stay byte-identical.
// how:  spawnSync over an argv array. The only importer of node:child_process for git
//       in the note/session core. Zero-dep.

import { spawnSync } from 'node:child_process';

/** One git call — argv array only (no shell), never throws.
 *  `code` is the raw exit status (null when git couldn't be spawned). Most callers
 *  only need `ok`; the merge-tree mergeability probe (sessions/session-git.mjs) needs
 *  the exact code to tell a clean merge (0) from a conflict (1) from a fatal/usage
 *  error (128/129) — it must NEVER report a probe error as a conflict. */
export function git(args, cwd, input) {
  try {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', input });
    return { ok: r.status === 0 && !r.error, code: r.status, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
  } catch (e) {
    return { ok: false, code: null, out: '', err: String(e) };
  }
}

/** stdout-or-null convenience: the trimmed stdout on success, null otherwise.
 *  Preserves the ergonomics of the old per-file wrappers (store/generation), which
 *  read a single value and treated any non-zero exit as "no value". */
export const out = (args, cwd, input) => {
  const r = git(args, cwd, input);
  return r.ok ? r.out : null;
};
