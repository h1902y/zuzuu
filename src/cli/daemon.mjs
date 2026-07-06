// src/cli/daemon.mjs — `zz daemon`: the dedicated tick host (KTD1's SECOND host,
// docs/plans/2026-07-06-001-feat-wake-source-tick-plan.md).
//
// what: a long-lived `zz` process that loops the U3 tick core (`grow/tick.mjs`'s
//       `tick(home, {now})`) IN-PROCESS on a cadence, until SIGINT/SIGTERM. The web
//       daemon (a later unit) hosts the SAME core by shelling `zz tick --once` from an
//       out-of-process `setInterval` (it must never import src/); this is the OTHER
//       host KTD1 promises — a dedicated process that calls `tick()` directly, because
//       it IS a `zz` process ("one core, two hosts").
// why:  R8's shared core needs its own standalone host, not only the web workbench's —
//       a founder who isn't running the workbench still wants the wake source awake.
//       Adds NO new authority: every tick still goes through `tick()`'s own opt-in gate
//       (R1), per-trigger enabled gate, fail-closed step posture, and cross-process
//       idempotency lock (tick-state.mjs) — this file is only the loop + lifecycle
//       around that already-gated core.
// how:  `setInterval` + an in-process re-entrancy guard (skip a tick if the previous
//       call in THIS process hasn't returned yet — `tick()`'s own lock already
//       protects the decide→fire→persist section across PROCESSES; this just avoids
//       piling up overlapping in-process calls behind a slow advance). SIGINT/SIGTERM
//       let an in-flight tick finish, then resolve — never torn down mid-write.
//       Injectable `proc`/`log`/`onTick` so tests never touch a real signal or a real
//       30s wall-clock interval.

import { tick } from '../grow/tick.mjs';

export const DEFAULT_INTERVAL_MS = 30_000;

/**
 * Run one tick, swallowing (and logging) any error so a single bad tick never kills
 * the daemon loop — the next interval just tries again. Guarded against overlap: a
 * still-in-flight call is skipped, not queued.
 * @returns {boolean} whether this call actually ran a tick (false = skipped, overlap)
 */
function tickOnceGuarded(home, state, log, onTick) {
  if (state.inFlight) return false;
  state.inFlight = true;
  try {
    const r = tick(home, { now: new Date() });
    onTick(r);
    log(`tick: fired ${r.fired.length} skipped ${r.skipped.length} denied ${r.denied.length}`);
  } catch (e) {
    log(`tick error: ${e?.message ?? e}`);
  } finally {
    state.inFlight = false;
  }
  return true;
}

/**
 * Run the dedicated tick host until stopped (SIGINT/SIGTERM). Resolves to an exit code
 * (0) once shutdown completes — the CLI row awaits this directly.
 * @param {string} home
 * @param {{intervalMs?:number, log?:(s:string)=>void, onTick?:(r:object)=>void, proc?:object}} [opts]
 *   `proc` defaults to the real `process` (injectable — tests pass a fake EventEmitter
 *   so a unit test never registers a handler on the real process signals).
 * @returns {Promise<number>}
 */
export function runDaemon(home, { intervalMs = DEFAULT_INTERVAL_MS, log = () => {}, onTick = () => {}, proc = process } = {}) {
  const state = { inFlight: false };
  return new Promise((resolveExit) => {
    log(`zz daemon: awake, ticking every ${intervalMs}ms`);
    tickOnceGuarded(home, state, log, onTick); // fire immediately on start, not only after the first interval
    const handle = setInterval(() => tickOnceGuarded(home, state, log, onTick), intervalMs);
    let stopping = false;
    const shutdown = (signal) => {
      if (stopping) return; // a second signal mid-shutdown is a no-op, not a re-entry
      stopping = true;
      clearInterval(handle);
      log(`zz daemon: received ${signal} — shutting down`);
      resolveExit(0);
    };
    proc.once('SIGINT', () => shutdown('SIGINT'));
    proc.once('SIGTERM', () => shutdown('SIGTERM'));
  });
}
