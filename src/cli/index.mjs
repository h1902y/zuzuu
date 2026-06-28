// src/cli/index.mjs — the `zz` veneer: a thin router over the command table.
//
// what: parse argv → resolve the command by LONGEST-PREFIX match against the
//       declarative table (`commands.mjs`) → build a `ctx` → call its handler.
//       The CLI is the host; it owns NO logic — every verb is a one-liner onto
//       the façade, and the table is the single source of truth the router AND
//       `zz help` both read. `notes ← use · loop ← serve ← hosts · cli`: this is
//       the outermost layer, importing inward only.
// why:  AXI — brief-by-default, content-first, TOON output (~40% fewer tokens),
//       no blocking prompts (review is explicit subcommands, not a wizard),
//       structured one-line errors. A hand-maintained switch + a hand-maintained
//       HELP drift apart; one table can't. The agent drives zz; keep turns cheap.
// how:  `run(argv, io)` returns an exit code and writes via the injected `log`
//       (testable without a process). The table rows do the work. Zero-dep.

import { COMMANDS, helpText, fail } from './commands.mjs';

/** Minimal flag parse: --k v / --flag → { _: positional[], k: v|true }. */
function parseArgs(rest) {
  const out = { _: [] };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = rest[i + 1];
      if (next == null || next.startsWith('--')) out[k] = true;
      else { out[k] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

/** The row whose `path` is the longest prefix of the command words. Single-element
 *  paths degenerate to a first-token match; multi-element paths (e.g. a future
 *  `module items`) win over a shorter prefix — the reserved-keyword resolution. */
function resolve(words) {
  let best = null;
  for (const cmd of COMMANDS) {
    if (cmd.path.length <= words.length && cmd.path.every((p, i) => p === words[i])
        && (!best || cmd.path.length > best.path.length)) best = cmd;
  }
  return best;
}

export async function run(argv, io = {}) {
  const log = io.log ?? console.log;
  const cwd = io.cwd ?? process.cwd();
  let [verb, ...rest] = argv;
  if (verb === undefined || verb === '--help' || verb === '-h') verb = 'help';
  const args = parseArgs(rest);
  const json = !!args.json;   // global: emit machine-readable JSON instead of TOON (the daemon JSON.parses stdout)

  if (verb === 'help') { log(helpText()); return 0; }

  const cmd = resolve([verb, ...args._]);
  if (!cmd) return fail(log, `unknown verb '${verb}' — try: zz help`);

  try {
    return await cmd.handler({ args, cwd, log, json, rest, verb });
  } catch (e) {
    return fail(log, e?.message ?? String(e));
  }
}
