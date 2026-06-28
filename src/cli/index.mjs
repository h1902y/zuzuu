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
  // the deprecation sink: STDERR-only (injectable for tests), kept OFF `log` so the
  // daemon's JSON.parse-of-stdout stays clean even when an old verb routes via an alias.
  const warn = io.warn ?? ((s) => process.stderr.write(s.endsWith('\n') ? s : s + '\n'));
  const cwd = io.cwd ?? process.cwd();
  let [verb, ...rest] = argv;
  if (verb === undefined || verb === '--help' || verb === '-h') verb = 'help';
  const args = parseArgs(rest);
  const json = !!args.json;   // global: emit machine-readable JSON instead of TOON (the daemon JSON.parses stdout)

  if (verb === 'help') { log(helpText()); return 0; }

  const matched = resolve([verb, ...args._]);
  if (!matched) return fail(log, `unknown verb '${verb}' — try: zz help`);

  // a deprecating alias → its canonical row: one stderr note, then dispatch the SAME
  // handler. The MATCHED path's length (the words actually typed) sets how many leading
  // positionals belong to the path, so a namespaced handler sees clean args (`note fold
  // m s d` → ['m','s','d'], exactly like the old `merge m s d`).
  let target = matched;
  if (matched.alias) {
    warn(`zz: '${matched.path.join(' ')}' is deprecated — use '${matched.alias.join(' ')}'`);
    target = COMMANDS.find((c) => c.path.length === matched.alias.length && c.path.every((p, i) => p === matched.alias[i]));
    if (!target) return fail(log, `alias '${matched.path.join(' ')}' has no canonical target`);
  }
  // THE MOAT boundary (Rung 8): the CLI process is the OPERATOR entry — a human at the
  // terminal, or the workbench daemon (a fresh `zz` process a human triggered). Handlers
  // `open(cwd)` here, and the façade defaults actor:'operator', so every write surface the
  // CLI reaches is operator-stamped. The only actor that's stamped explicitly is `agent`
  // (the host hook). (Caveat: the agent shelling `zz <writeverb>` via Bash also lands here
  // as a fresh operator process — the in-process actor check can't tell it apart; that Bash
  // path is closed by the guardrails execution gate in Rung 9, not this boundary.)
  const ctx = { args: { ...args, _: args._.slice(matched.path.length - 1) }, cwd, log, json, rest, verb, warn };

  try {
    return await target.handler(ctx);
  } catch (e) {
    return fail(log, e?.message ?? String(e));
  }
}
