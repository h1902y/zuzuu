// src/grow/tick.mjs — the wake source's TICK CORE (U3, docs/plans/2026-07-06-001-
// feat-wake-source-tick-plan.md): the standalone evaluator that, once a founder has
// opted a Project INTO autonomy, fires DUE ENABLED triggers once (idempotent) through
// the existing gated `fireTrigger`→`startRun` path with the UNATTENDED fail-closed
// posture (KTD2, `grow/run.mjs`), and advances the runs it's responsible for. Never
// spawns an agent (KTD3 — an agent-binding step structurally returns `needsHost` and
// fails cleanly; see `use/act.mjs`).
//
// what: `tick(home, {now})` → `{fired, skipped, denied}`. Reads the opt-in
//       (`grow/autonomy.mjs`) — absent/falsey means do NOTHING (R1, fail-closed
//       opt-in). Otherwise: every ENABLED `type:trigger` note is a candidate; a cron
//       trigger is due when `cronDue(on.expr, now)` AND this minute-window hasn't
//       already fired (the `tick-state.mjs` watermark); a note-change trigger fires
//       once per row newly matching `on.where` that hasn't already fired. Each due
//       candidate fires through `fireTrigger(…, {unattended:true})` — the SAME gated
//       `run start` triggers always used, now carrying KTD2's unattended marker so its
//       STEPS gate fail-closed. Then `advanceAll` ticks forward this tick's fresh
//       fires plus any earlier tick-fired run still `running`/`waiting` — NEVER a
//       human's attended run (see `advanceLingering`, below, for why that boundary is
//       load-bearing, not incidental).
// why:  §I.2 B4's own line — "a laptop must not fire triggers unattended" — is drawn
//       ON PURPOSE; this file is the opt-in, fail-closed crossing of it (R1-R5). It
//       adds NO new execution authority: firing is exactly one `run start` under a
//       name, identical to a human's `zz trigger fire`, and stepping through
//       `advanceAll` is identical to a human's `zz run advance --all` — the ONLY new
//       thing is WHO calls them (a tick instead of a person) and the CONSEQUENT
//       fail-closed gate posture that follows from nobody being present to watch.
// how:  the DECISION is pure (`decideTick`, below) — testable with plain data, no
//       disk/db. The IO shell (`tick`, below) does exactly the I/O the decision can't:
//       read triggers + current note-change matches, call `decideTick`, fire the
//       result through the real write door, persist the watermark IMMEDIATELY after
//       each fire (never batched — a crash between two fires can't lose the first
//       one's record), then advance. A project-wide TICK LOCK (`tick-state.mjs`,
//       reusing `use/run-lock.mjs`'s primitive) serializes the decide→fire→persist
//       section across two overlapping ticks — the watermark alone only protects two
//       SEQUENTIAL calls in one process; the lock is what makes it hold for two
//       genuinely concurrent ones. Bounded throughout (see the MAX_* constants) —
//       no unbounded scan, no unbounded fan-out, no unbounded advance.

import { searchRows } from '../notes/rows.mjs';
import { search } from '../notes/index.mjs';
import { isTriggerEnabled, triggerMatches, fireTrigger } from './trigger.mjs';
import { advanceAll, RUNS_MODULE } from './run.mjs';
import { cronDue } from './cron-match.mjs';
import { isAutonomyEnabled } from './autonomy.mjs';
import {
  acquireTickLock, readWatermark, writeWatermark, minuteKey, markCronFired, markRowFired, appendTickLog,
} from './tick-state.mjs';

// ── bounds (R5's "bounded per-tick work", R-2/R-5's mitigations) ────────────────
export const MAX_TRIGGERS_PER_TICK = 500;      // how many type:trigger notes one tick evaluates
export const MAX_NOTE_CHANGE_SCAN = 200;       // per note-change trigger: how many currently-matching rows it looks at (ordered by addr)
export const MAX_FIRES_PER_TICK = 25;          // total fires (cron windows + note-change rows combined) in one tick
export const MAX_RUNS_ADVANCED_PER_TICK = 50;  // distinct run ids advanced in one tick (fresh fires + lingering)
export const MAX_STEPS_PER_RUN_PER_TICK = 50;  // advanceAll's own bounded-loop cap, per run, per tick

/**
 * The PURE decision: given already-fetched trigger entries, the tick's `now`, and the
 * current watermark, decide what fires and what doesn't. NO disk/db access — every
 * `entries[i]` already carries whatever IO its kind needed (a cron trigger's
 * `cronExpr`; a note-change trigger's CURRENT `matchingAddrs`, pre-fetched and already
 * bounded by the caller). This is the seam `tests/unit/tick.test.mjs` exercises
 * directly, without a real project.
 * @param {Array<{addr,module,id,enabled,kind,cronExpr?,matchingAddrs?}>} entries
 * @param {Date} now
 * @param {{cron:Record<string,string>, noteChange:Record<string,string[]>}} watermark
 * @returns {{toFire:Array, skipped:Array}}
 */
export function decideTick(entries, now, watermark) {
  const toFire = [];
  const skipped = [];
  for (const t of entries) {
    if (!t.enabled) { skipped.push({ addr: t.addr, kind: t.kind ?? null, reason: 'disabled' }); continue; }

    if (t.kind === 'cron') {
      if (!cronDue(t.cronExpr, now)) { skipped.push({ addr: t.addr, kind: t.kind, reason: 'not-due' }); continue; }
      const windowKey = minuteKey(now);
      if ((watermark.cron ?? {})[t.addr] === windowKey) {
        skipped.push({ addr: t.addr, kind: t.kind, reason: 'already-fired', windowKey });
        continue;
      }
      toFire.push({ addr: t.addr, module: t.module, id: t.id, kind: 'cron', windowKey });
      continue;
    }

    if (t.kind === 'note-change') {
      const already = new Set((watermark.noteChange ?? {})[t.addr] ?? []);
      const newRows = (Array.isArray(t.matchingAddrs) ? t.matchingAddrs : []).filter((a) => !already.has(a));
      if (!newRows.length) { skipped.push({ addr: t.addr, kind: t.kind, reason: 'no-new-rows' }); continue; }
      for (const rowAddr of newRows) toFire.push({ addr: t.addr, module: t.module, id: t.id, kind: 'note-change', rowAddr });
      continue;
    }

    // `manual` · `ingress` · a malformed/missing `on.kind` — no notion of "due"; the
    // wake source only ever fires the two local event kinds (R2), never these.
    skipped.push({ addr: t.addr, kind: t.kind ?? null, reason: 'unsupported-kind' });
  }
  return { toFire, skipped };
}

// ── IO: assemble entries for decideTick from the live project ──────────────────

function gatherEntries(home) {
  const { items } = searchRows(home, { type: 'trigger', limit: MAX_TRIGGERS_PER_TICK });
  return items.map((t) => {
    const addr = `${t.module}:${t.id}`;
    const enabled = isTriggerEnabled(t);
    const kind = t.on?.kind ?? null;
    if (kind === 'cron') return { addr, module: t.module, id: t.id, enabled, kind, cronExpr: t.on?.expr };
    if (kind === 'note-change') {
      // only an ENABLED trigger's matches are worth fetching — a disabled one is
      // skipped by decideTick before matchingAddrs would ever be consulted.
      const matches = enabled ? triggerMatches(home, t, { sampleSize: MAX_NOTE_CHANGE_SCAN }) : { sample: [] };
      return { addr, module: t.module, id: t.id, enabled, kind, matchingAddrs: matches.sample };
    }
    return { addr, module: t.module, id: t.id, enabled, kind };
  });
}

// ── IO: lingering unattended runs — never a human's attended run (see header) ──

/** Non-terminal (`running`/`waiting`) runs stamped `gate_actor:'agent'` — i.e. runs
 *  the wake source itself is responsible for advancing. Deliberately EXCLUDES an
 *  attended (unmarked) run: that run's steps gate FAIL-OPEN because a human was
 *  expected to be present when it started; auto-advancing it from an unattended tick
 *  would run those steps fail-open with nobody watching — precisely the actor/gate
 *  conflation KTD2 exists to prevent. Only the tick (or a human) may advance those. */
function lingeringUnattendedRunIds(home) {
  const ids = new Set();
  for (const status of ['running', 'waiting']) {
    const rows = search(home, {
      module: RUNS_MODULE, type: 'run', status, where: [{ key: 'gate_actor', value: 'agent' }],
      limit: MAX_RUNS_ADVANCED_PER_TICK,
    });
    for (const r of rows) ids.add(r.addr.slice(RUNS_MODULE.length + 1));
  }
  return [...ids];
}

/**
 * `zz tick [--once]` — fire due enabled triggers once and advance the runs. Does
 * NOTHING (fail-closed) unless this Project has opted into autonomy
 * (`grow/autonomy.mjs`). Idempotent across overlapping calls (the tick lock +
 * watermark); bounded (the MAX_* constants above); never spawns an agent (an
 * agent-binding step inside an unattended run structurally returns `needsHost` and
 * fails that step — see `use/act.mjs`).
 * @param {string} home
 * @param {{now?:Date}} [opts]
 * @returns {{fired:Array, skipped:Array, denied:Array}}
 */
export function tick(home, { now = new Date() } = {}) {
  const result = { fired: [], skipped: [], denied: [] };
  if (!isAutonomyEnabled(home)) return result; // R1 — the fail-closed opt-in, absolute

  const lock = acquireTickLock(home);
  if (!lock.ok) {
    // another tick is already inside its critical section — refuse fast rather than
    // risk double-deciding the SAME window/row; its decision stands, this call
    // contributes nothing (R5, idempotency across overlapping ticks). Logged (unlike
    // the opt-in-off early return above) — two hosts fighting over this lock (R-2) is
    // exactly the scenario a founder debugging "why didn't my tick fire" needs to see.
    result.skipped.push({ addr: null, kind: null, reason: 'tick-already-running' });
    appendTickLog(home, { ts: now.toISOString(), fired: 0, skipped: 1, denied: 0, firedAddrs: [], deniedAddrs: [], note: 'tick-already-running' });
    return result;
  }

  const firedRunIds = [];
  try {
    const watermark = readWatermark(home);
    const decision = decideTick(gatherEntries(home), now, watermark);
    result.skipped.push(...decision.skipped);

    const toFireNow = decision.toFire.slice(0, MAX_FIRES_PER_TICK);
    for (const deferred of decision.toFire.slice(MAX_FIRES_PER_TICK)) {
      result.skipped.push({ addr: deferred.addr, kind: deferred.kind, reason: 'tick-budget' });
    }

    for (const f of toFireNow) {
      let outcome;
      try { outcome = fireTrigger(home, f.module, f.id, { force: false, unattended: true }); }
      catch (e) { outcome = { ok: false, error: String(e?.message ?? e) }; }

      // Marked CONSUMED regardless of success — a fire ATTEMPT, not just a fire
      // SUCCESS, is what the watermark remembers. Otherwise a permanently-broken
      // trigger (a malformed run target, a workflow that no longer exists) would
      // retry-storm on every single tick forever; `denied` + the tick log are the
      // observability trail a founder uses to notice and fix it (R6) — not an
      // infinite unattended retry loop (R-2's runaway-loop risk).
      if (f.kind === 'cron') markCronFired(watermark, f.addr, f.windowKey);
      else markRowFired(watermark, f.addr, f.rowAddr);
      writeWatermark(home, watermark);

      if (outcome.ok) {
        firedRunIds.push(outcome.runId);
        result.fired.push({ addr: f.addr, kind: f.kind, runId: outcome.runId, window: f.windowKey ?? null, row: f.rowAddr ?? null });
      } else {
        result.denied.push({ addr: f.addr, kind: f.kind, error: outcome.error ?? 'fire failed', window: f.windowKey ?? null, row: f.rowAddr ?? null });
      }
    }
  } finally {
    lock.release(); // release BEFORE advancing — advancing is protected per-run by run-lock.mjs already
  }

  const lingering = lingeringUnattendedRunIds(home).filter((id) => !firedRunIds.includes(id));
  const toAdvance = [...firedRunIds, ...lingering].slice(0, MAX_RUNS_ADVANCED_PER_TICK);
  for (const runId of toAdvance) {
    // best-effort: advanceAll's own bounded loop can return ok:false (failed workflow,
    // a genuine tick error, or the maxTicks cap) — the run NOTE is the durable state
    // either way, so a later tick simply picks the still-non-terminal run back up.
    try { advanceAll(home, runId, 'operator', { maxTicks: MAX_STEPS_PER_RUN_PER_TICK }); } catch { /* see above */ }
  }

  appendTickLog(home, {
    ts: now.toISOString(),
    fired: result.fired.length, skipped: result.skipped.length, denied: result.denied.length,
    firedAddrs: result.fired.map((f) => f.addr), deniedAddrs: result.denied.map((f) => f.addr),
  });
  return result;
}
