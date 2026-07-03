// src/grow/runs-miner.mjs — runs.jsonl → failure/flake evidence → staged proposals.
//
// what: observe's SIBLING. `grow/observe.mjs` mines session TRANSCRIPTS (what was
//       SAID/done in a conversation); this mines `notes/log.mjs`'s `runs.jsonl` (what
//       actually RAN — every `act()`/`runWorkflow()` execution, gated + logged). Same
//       shape: a PURE analysis step (`mineRuns`) feeding a staging step (`observeRuns`)
//       that routes through `grow/stage.mjs`, never a direct write.
// why:  MODEL.md has named `runs.jsonl` "observe's feedback edge" since the safety
//       floor landed, but nothing ever walked it — self-correction was DESIGNED, not
//       wired (§I: "Zus that run", rung 2). This closes that gap: a runnable note
//       that keeps failing now surfaces as a gated proposal, not silence.
// how:  group runs.jsonl events by the note they ran (`module:id`), compute evidence
//       (attempts, failures, a TRAILING consecutive-failure streak, timeouts, first/
//       last seen), flag notes crossing a threshold, and stage ONE aggregate proposal
//       per flagged note — never one per failed run (§I.2 B2: review fatigue is the
//       moat's real enemy; the gate must scale by AGGREGATION, not clicks). The miner
//       does NOT know the fix — it can only say a note has been failing and needs a
//       look; a human/agent decides the actual remedy at review. Zero-dep, fail-soft.

import { read } from '../notes/log.mjs';
import { listModules } from '../notes/module.mjs';
import { stageChange, listStaged } from './stage.mjs';

// ── thresholds (documented, exported — no magic numbers hiding in the logic) ───────
// Crossing EITHER flags a note. Deliberately conservative: a note must show a genuine
// pattern (not one bad run) before it costs the human a review click.
export const CONSECUTIVE_FAILURE_THRESHOLD = 3;  // ≥3 failures IN A ROW (the trailing streak)
export const FAILURE_RATE_THRESHOLD = 0.5;       // ≥50% failure rate...
export const FAILURE_RATE_MIN_RUNS = 4;          // ...over at least this many runs (a 1-of-1 miss isn't a pattern)

// The proposal shape (see `synthesizeProposal` below for the full reasoning): an
// `update` setting this `health` value. Exported so a reader (the review UI, a test)
// doesn't have to re-derive the literal.
export const HEALTH_NEEDS_ATTENTION = 'needs-attention';

/** Normalize a `ts` (ISO string | epoch ms number | absent) to epoch ms, or null when
 *  it can't be interpreted. Production callers never set `ts` today (notes/log.mjs's
 *  `logRun` accepts it but no real call site passes one) — this stays tolerant of
 *  either shape rather than assuming one, and null is an honest "not recorded". */
function toEpochMs(ts) {
  if (ts == null) return null;
  if (typeof ts === 'number') return Number.isFinite(ts) ? ts : null;
  const n = Date.parse(ts);
  return Number.isFinite(n) ? n : null;
}

/** Summarize one note's runs — already filtered to that note, in FILE-APPEND (i.e.
 *  chronological) order, since `notes/log.mjs`'s `read()` streams `runs.jsonl` in the
 *  order each line was appended. */
function summarize(module, note, runs) {
  const addr = `${module}:${note}`;
  const totalRuns = runs.length;
  const failures = runs.filter((r) => r.success === false).length;
  const timedOut = runs.filter((r) => !!r.timedOut).length;
  const failureRate = totalRuns ? failures / totalRuns : 0;

  // The TRAILING consecutive-failure streak: walk backward from the most recent run
  // (last in file-append order) until a success breaks it. This is "is it failing
  // RIGHT NOW", not "how many failures has it ever had" — a note that failed 5 times
  // last month and has passed every run since has a streak of 0.
  let consecutiveFailureStreak = 0;
  for (let i = runs.length - 1; i >= 0; i--) {
    if (runs[i].success === false) consecutiveFailureStreak++;
    else break;
  }

  const stamped = runs.map((r) => ({ raw: r.ts, ms: toEpochMs(r.ts) })).filter((t) => t.ms != null);
  const firstSeen = stamped.length ? stamped.reduce((a, b) => (a.ms <= b.ms ? a : b)).raw : null;
  const lastSeen = stamped.length ? stamped.reduce((a, b) => (a.ms >= b.ms ? a : b)).raw : null;

  return { module, note, addr, totalRuns, failures, failureRate, consecutiveFailureStreak, timedOut, firstSeen, lastSeen };
}

/**
 * Mine `runs.jsonl` (one module, or every module in the Project) into per-note
 * EVIDENCE. PURE — reads via `notes/log.mjs`'s `read`, stages nothing, hermetically
 * testable without touching `stage.mjs` at all.
 * @param {string} home
 * @param {{module?: string|null, sinceTs?: string|number|null}} opts  `sinceTs` — an
 *   ISO string or epoch-ms number — excludes only events with a KNOWN ts older than
 *   it; an event with no ts (the common case) is KEPT rather than silently dropped,
 *   since excluding it would make `--since` blind to untimestamped runs.
 * @returns {Array<{module,note,addr,totalRuns,failures,failureRate,consecutiveFailureStreak,timedOut,firstSeen,lastSeen}>}
 */
export function mineRuns(home, { module = null, sinceTs = null } = {}) {
  const modules = module ? [module] : listModules(home).map((m) => m.id);
  const sinceMs = toEpochMs(sinceTs);
  const evidence = [];
  for (const mod of modules) {
    const byNote = new Map();
    for (const e of read(home, mod, 'runs')) {
      if (e.event !== 'run' || !e.note) continue; // runs.jsonl also carries `query` events (RUNS set) — not evidence
      if (sinceMs != null) {
        const ms = toEpochMs(e.ts);
        if (ms != null && ms < sinceMs) continue;
      }
      const list = byNote.get(e.note) ?? [];
      list.push(e);
      byNote.set(e.note, list);
    }
    for (const [note, runs] of byNote) evidence.push(summarize(mod, note, runs));
  }
  return evidence;
}

/** Does this note's evidence cross either threshold? Exported so a caller (the CLI's
 *  `--dry-run` render, a test) doesn't re-derive the rule. */
export function needsAttention(ev, opts = {}) {
  const streakT = opts.consecutiveFailureThreshold ?? CONSECUTIVE_FAILURE_THRESHOLD;
  const rateT = opts.failureRateThreshold ?? FAILURE_RATE_THRESHOLD;
  const minRuns = opts.failureRateMinRuns ?? FAILURE_RATE_MIN_RUNS;
  return ev.consecutiveFailureStreak >= streakT || (ev.totalRuns >= minRuns && ev.failureRate >= rateT);
}

/**
 * Build the (not-yet-staged) proposal for one flagged note's evidence.
 *
 * CRITICAL — the miner does not know the FIX. It is not an LLM; it cannot read the
 * note's `run:` command and diagnose why it's failing. So the shape it stages is
 * deliberately minimal: an `update` setting a `health` field (a tolerated custom
 * key — `actions`/workflow-holding modules ship SCHEMALESS, so this rides the
 * envelope's tolerance cleanly) to `needs-attention`, carrying the evidence and a
 * human-readable rationale. It never touches `status` — that's a separate lifecycle
 * some modules give typed meaning to, and the miner has no business asserting a
 * note is "archived" or "active". A human/agent decides the actual remedy at review.
 *
 * `change` stays a FIXED value regardless of the evolving evidence numbers — that is
 * what makes `stage.mjs`'s own content-hash id (`op+module+target+change`) already
 * collapse a re-run over the same still-failing note to the SAME staged id (the
 * evidence/rationale ride outside the hash, so they can't cause a duplicate).
 */
function synthesizeProposal(ev) {
  const pct = Math.round(ev.failureRate * 100);
  const why = ev.consecutiveFailureStreak >= CONSECUTIVE_FAILURE_THRESHOLD
    ? `${ev.consecutiveFailureStreak} failures in a row`
    : `${pct}% failure rate over ${ev.totalRuns} runs`;
  const since = ev.firstSeen ? ` since ${ev.firstSeen}` : '';
  const rationale = `'${ev.addr}' has failed ${ev.failures}/${ev.totalRuns} runs${since} (${why}) — review it.`;
  return {
    module: ev.module, op: 'update', target: ev.note,
    change: { health: HEALTH_NEEDS_ATTENTION },
    rationale,
    evidence: [{
      kind: 'run-failures', totalRuns: ev.totalRuns, failures: ev.failures,
      failureRate: ev.failureRate, consecutiveFailureStreak: ev.consecutiveFailureStreak,
      timedOut: ev.timedOut, firstSeen: ev.firstSeen, lastSeen: ev.lastSeen,
    }],
    score: ev.consecutiveFailureStreak * 10 + ev.failures,
  };
}

/** True when a PENDING proposal the runs-miner itself staged already exists for this
 *  note. Belt + suspenders atop `stageChange`'s own exact-content dedup (which already
 *  collapses re-staging via the fixed `change` shape, see `synthesizeProposal`): this
 *  guard also stops a re-run from staging a SECOND row if the proposal shape ever
 *  changes under a future edit, and skips the (harmless but wasted) `stageChange` call
 *  entirely on the common re-run path. Scoped to `source.producer === 'runs-miner'` so
 *  it never treats an unrelated proposal on the same note (observe's, or a human's
 *  `zz stage`) as a block. */
function hasPendingRunsProposal(home, module, target) {
  return listStaged(home, module).some((p) => p.target === target && p.source?.producer === 'runs-miner');
}

/**
 * Mine + synthesize + stage — the full loop. Never writes the Project directly;
 * routes every proposal through `grow/stage.mjs`, exactly like `observe()`. Aggregate:
 * ONE proposal per failing note, never one per failed run (§I.2 B2).
 * @param {string} home
 * @param {{module?, sinceTs?, dryRun?}} opts  `dryRun` computes evidence + the
 *   candidate proposals but stages nothing (candidates are still returned, so a
 *   caller can print "what WOULD be staged").
 * @returns {{ evidence, flagged, candidates, proposed, staged }}
 */
export function observeRuns(home, opts = {}) {
  const evidence = mineRuns(home, opts);
  const flagged = evidence.filter((ev) => needsAttention(ev, opts));
  const candidates = flagged.map(synthesizeProposal);
  const staged = [];
  if (!opts.dryRun) {
    for (const c of candidates) {
      if (hasPendingRunsProposal(home, c.module, c.target)) continue;
      const source = { producer: 'runs-miner', kind: 'run-failures', locator: { kind: 'note', module: c.module, note: c.target } };
      const rec = stageChange(home, c.module, {
        op: c.op, target: c.target, change: c.change,
        rationale: c.rationale, evidence: c.evidence, source, score: c.score,
      });
      // B1(a): `{error}` (no `.id`) is a refusal (a poisoned type:secret value), not a
      // staged record.
      if (rec && rec.id && !rec.duplicate) staged.push({ module: c.module, ...rec });
    }
  }
  return { evidence, flagged: flagged.length, candidates, proposed: staged.length, staged };
}
