// src/grow/tick-state.mjs — the wake-source tick's MACHINE state (KTD4, docs/plans/
// 2026-07-06-001-feat-wake-source-tick-plan.md): the fire-once watermark, the
// tick-level serialization lock, and the tick-decision log. `grow/tick.mjs` (U3) is
// the only consumer.
//
// what: three small pieces of state, all keyed to `notes/store.mjs`'s `stateDir(home)`
//       (out-of-repo, XDG, per-project, survives index rebuilds, no git churn — the
//       SAME class of dir as the gate log and run-locks, never the tracked `.zuzuu/`
//       tree): (1) the WATERMARK — per cron-trigger the last-fired minute-window key,
//       per note-change-trigger the set of already-fired row addrs; (2) the TICK LOCK
//       — one project-wide advisory lock guarding the decide→fire→persist-watermark
//       critical section, so two overlapping ticks (the web daemon's interval racing
//       a manual `zz tick --once`, or two hosts) can never both decide the SAME cron
//       window or note-change row is unfired and fire it twice; (3) the DECISION LOG
//       — an append-only JSONL trail of what each tick fired/skipped/denied (R6,
//       observability).
// why:  the watermark is high-frequency MACHINE state, not durable brain content — it
//       has no business in a git-tracked note (KTD4). The lock is what makes the
//       watermark's read-then-write actually atomic across two REAL processes (a
//       watermark file alone only protects two SEQUENTIAL calls in one process; two
//       genuinely concurrent ticks could both read "unfired" before either writes).
// how:  the watermark is one JSON file (`readJson`/`writeJson`, notes/store.mjs's one
//       convention). The lock REUSES `use/run-lock.mjs`'s exact primitive (atomic
//       `mkdirSync`, refuse-fast, steal-if-stale) under a synthetic key that can never
//       collide with a real run id (`runs` module ids are never `__tick__`) — no new
//       lock mechanism, one less thing to get subtly wrong. The log is a plain
//       `appendFileSync`, mirroring `notes/log.mjs`'s own JSONL-append convention.

import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stateDir, readJson, writeJson } from '../notes/store.mjs';
import { acquireRunLock } from '../use/run-lock.mjs';

const watermarkPath = (home) => join(stateDir(home), 'tick-watermark.json');
const tickLogPath = (home) => join(stateDir(home), 'tick.log.jsonl');

// The tick's own critical section never executes a step (it only MATERIALIZES run
// notes via `startRun` — fast, no child process) — a generous-but-bounded staleness
// window is plenty; a genuinely wedged holder past this is presumed crashed.
const TICK_LOCK_STALE_MS = 2 * 60_000;
// A synthetic (module,id) pair for the shared run-lock primitive — 'runs' module ids
// are always `<workflowId>-<8 hex>` (grow/run.mjs's `newRunId`), so this can never
// collide with a real run.
const TICK_LOCK_MODULE = '__tick__';
const TICK_LOCK_ID = 'lock';

/** Acquire the project-wide tick lock. Refuse-fast (never blocks) — see this file's
 *  header. `{ok:false}` means another tick is already inside its critical section;
 *  the caller contributes nothing this round rather than double-deciding. */
export function acquireTickLock(home) {
  return acquireRunLock(home, TICK_LOCK_MODULE, TICK_LOCK_ID, TICK_LOCK_STALE_MS);
}

const EMPTY_WATERMARK = { cron: {}, noteChange: {} };

/** Read the watermark, or the empty shape if it doesn't exist yet / is corrupt
 *  (fail-soft, like every other JSON read in this codebase — a corrupt watermark
 *  file just means "nothing recorded yet", never a crash). */
export function readWatermark(home) {
  const wm = readJson(watermarkPath(home), null);
  if (!wm || typeof wm !== 'object') return { cron: {}, noteChange: {} };
  return {
    cron: wm.cron && typeof wm.cron === 'object' ? wm.cron : {},
    noteChange: wm.noteChange && typeof wm.noteChange === 'object' ? wm.noteChange : {},
  };
}

/** Persist the watermark. Called from INSIDE the tick lock, immediately after each
 *  successful fire decision is recorded — never batched to the end of a tick — so a
 *  crash between two fires never loses the first one's watermark entry. */
export function writeWatermark(home, wm) {
  writeJson(watermarkPath(home), wm);
}

/** The floored minute-window key `cronDue`'s own local-time semantics imply — cron's
 *  finest grain is one minute, so "already fired for this window" means "already
 *  fired for this (year,month,day,hour,minute) tuple", in the SAME local time
 *  `cron-match.mjs`'s `cronDue` reads `date` with. */
export function minuteKey(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

/** Mark a cron trigger's window as fired (in place) — a SINGLE last-fired key is
 *  enough (cron windows only ever move forward), not a growing set. */
export function markCronFired(wm, addr, windowKey) {
  wm.cron[addr] = windowKey;
  return wm;
}

/** Mark one note-change row as fired for a trigger (in place) — a growing set,
 *  because unlike a cron window a row's addr never expires on its own. */
export function markRowFired(wm, addr, rowAddr) {
  const set = new Set(wm.noteChange[addr] ?? []);
  set.add(rowAddr);
  wm.noteChange[addr] = [...set];
  return wm;
}

/** Append one tick's decision summary to the JSONL log (R6, observability) —
 *  fail-soft: a logging failure never breaks the tick it's recording. */
export function appendTickLog(home, entry) {
  try {
    const dir = stateDir(home);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    appendFileSync(tickLogPath(home), `${JSON.stringify(entry)}\n`);
  } catch { /* observability, never load-bearing */ }
}

/** Read the tick log's lines (oldest first), for `zz doctor`/tests — tolerant of a
 *  missing file (no tick has ever run) and skips any corrupt line. */
export function readTickLog(home) {
  const p = tickLogPath(home);
  if (!existsSync(p)) return [];
  const out = [];
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* a corrupt line is skipped, not fatal */ }
  }
  return out;
}
