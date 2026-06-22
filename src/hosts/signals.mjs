// src/hosts/signals.mjs — shared cross-host signal primitives.
//
// what: the one `norm`, destructive-shape set, and shell-call assembler every
//       adapter shares, so each host's mineSignals emits the SAME superset
//       (`{commands, files, failures, sequences, correctionTurns,
//       destructiveFailures}`) from its own raw transcript.
// why:  DRY + real-wire-built — adding a host means mapping its log to a list of
//       shell calls; the assembly (sequences, destructive detection) is uniform.
// how:  pure, zero-dep. Harvested from v1's proven capture/adapters/signals.mjs.

import { readFileSync } from 'node:fs';

/** Read a JSON-lines file → array of parsed objects (corrupt lines skipped). */
export function readJsonl(file) {
  try {
    return readFileSync(file, 'utf8').split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

/** Extract a shell command from a tool-call's `arguments` (parsed if a JSON
 *  string), trying `keys` in order: a string is returned, an array space-joined. */
export function argCommand(args, keys = ['command', 'cmd']) {
  const a = typeof args === 'string' ? (() => { try { return JSON.parse(args); } catch { return {}; } })() : args ?? {};
  for (const k of keys) {
    if (typeof a[k] === 'string') return a[k];
    if (Array.isArray(a[k])) return a[k].join(' ');
  }
  return '';
}

export const norm = (cmd) => String(cmd).trim().replace(/\s+/g, ' ').slice(0, 200);

export const SEQ_SEP = ' && '; // joins adjacent shell commands into a 2-gram label
const DESTRUCTIVE_SHAPES = [/\brm\s+-[a-z]*r/, /git\s+push\s+.*--force/, /DROP\s+TABLE/i, /chmod\s+-R/];
export const isDestructive = (cmd) => DESTRUCTIVE_SHAPES.some((re) => re.test(cmd));

/** The empty superset — an unminable / malformed / prompt-only host returns this. */
export function emptySignals() {
  return { commands: [], files: [], failures: [], sequences: [], correctionTurns: [], destructiveFailures: [] };
}

/**
 * Assemble the signal superset from an ordered list of shell tool calls.
 * @param {Array<{cmd:string, failed:boolean, tool?:string}>} shellCalls — transcript order
 */
export function assembleSignals(shellCalls) {
  const out = emptySignals();
  const order = [];
  for (const call of shellCalls) {
    const cmd = norm(call.cmd);
    if (!cmd) continue;
    const failed = !!call.failed;
    const tool = call.tool || 'bash';
    out.commands.push({ cmd, failed });
    order.push(cmd);
    if (failed) {
      out.failures.push(tool);
      if (isDestructive(cmd)) out.destructiveFailures.push({ cmd, tool });
    }
  }
  for (let i = 0; i + 1 < order.length; i++) out.sequences.push(order[i] + SEQ_SEP + order[i + 1]);
  return out;
}
