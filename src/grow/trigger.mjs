// src/grow/trigger.mjs — triggers as notes: a gated, versioned way to NAME an
// automation (§I rung 4 / §I.4 #7).
//
// what: a `type: trigger` note names WHEN something should fire (`on: {kind, …}`) and
//       WHAT to fire (`run: <workflow-module:id>`). This file supplies the three things
//       the CLI door (`zz trigger …`, near `observe`/`observe-runs` in
//       cli/verbs/evolution.mjs) needs: `listTriggers`/`showTrigger` (reads),
//       `triggerMatches` (the blast-radius safety affordance, §I.2 B2 / Apollo),
//       `fireTrigger` (explicit, manual firing — resolves the trigger's `run` target
//       and starts a durable run), and `setTriggerEnabled` (the SECOND gate, §I.4 #7).
// why:  §I rung 4 is EXPLICITLY the trigger NOTE, not a scheduler: this project's own
//       break book (§I.2 B4) draws the line — "no unattended ingress on a laptop." A
//       trigger here is inert until a human (or the future hosted daemon) fires it;
//       firing it is exactly `zz run start` under a name, never a new execution path.
// how:  `on.kind` shape validation lives in `notes/validate.mjs` (the pre-write gate
//       every note passes through, not just triggers) — this file is runtime logic
//       OVER an already-valid trigger note: read it, compute its blast radius (reusing
//       `notes/index.mjs`'s search/count — the SAME where-clause machinery `zz query
//       --where` uses), and fire it through `grow/run.mjs`'s durable runner. Zero-dep,
//       fail-soft (a malformed trigger fails cleanly with a named error, never throws).
//
// THE FIRE SEMANTICS (documented choice — §I.4's "decide: I recommend…"): `trigger
// fire` starts exactly ONE durable run, passing the trigger's declared `inputs` plus —
// for a `note-change` trigger — the matched-note CONTEXT (`MATCHED_COUNT` +
// `MATCHED_SAMPLE`, the same blast-radius numbers `trigger show`/`--dry-run` preview).
// It does NOT fire once per matching row: that's a BATCH concern (bulk fan-out), a
// different (future, undesigned) shape from "fire this named automation now." A cron
// trigger fired manually just runs its target once — `on.expr` is read by nothing
// local; it exists so a trigger note is ready for the deferred hosted scheduler
// without a schema migration later.
//
// THE FIRE PATH ALWAYS GOES THROUGH THE DURABLE RUNNER (`grow/run.mjs`'s `startRun`):
// every fired run passes the SAME gate, timeout, and generation-pinning a manual `zz
// run start` gets — triggers add NO new execution authority (§I rung 4's own words).
// A consequence, honestly documented rather than special-cased: `startRun` only
// accepts a `type: workflow` target, so a trigger's `run:` must point at a workflow
// note, not a bare action — firing a trigger aimed at an action refuses with the SAME
// "is not a workflow" error a human seeing `zz run start` on that address would get.
// Wrapping a single action as a trivial one-step workflow is the documented pattern
// (see docs/guide/Workflows.md) — no special-case unwrapping is built here.
//
// DEFERRED (hosted-tier, §I.2 B4 — NOT built this pass, see MODEL.md too):
//   - the unattended SCHEDULER — a daemon tick firing `cron` triggers on their `expr`.
//   - INGRESS webhooks — `/ingress/<trigger-id>` binding an inbound HTTP call to a
//     trigger note.
//   - note-change AUTO-FIRING — a daemon watching the index for rows a trigger's
//     filter newly matches and firing without a human/cron in the loop.
// A laptop must not fire triggers unattended (the honest boundary, §I.2 B4) — this
// pass makes the trigger NOTE a first-class gated/versioned object you can list,
// inspect (with blast-radius), enable/disable, and fire EXPLICITLY. Nothing here ever
// fires on its own.

import { readNote } from '../notes/repo.mjs';
import { search, count } from '../notes/index.mjs';
import { searchRows } from '../notes/rows.mjs';
import { WHERE_OPS } from '../notes/validate.mjs';
import { patchNote } from './edit.mjs';
import { startRun } from './run.mjs';

// `run: 'module:id'` — the SAME shape `use/workflow.mjs`'s `splitAddr` parses; a local
// copy (not an import) would duplicate it a third time, so this file — already inside
// grow/, which may freely depend on use/ — imports the real one instead.
import { splitAddr } from '../use/workflow.mjs';

// ── enabled — a tolerant boolean read (mirrors validate.mjs's COERCIBLE.bool: a CLI
// `--field enabled=true` staged via `zz stage` with no coercion lands as the STRING
// "true", not a real boolean — see validate.mjs's header comment on the same field) ──
const ENABLED_TRUE = new Set(['true', 'yes', '1']);
export function isTriggerEnabled(trigger) {
  const v = trigger?.enabled;
  if (typeof v === 'boolean') return v;
  return ENABLED_TRUE.has(String(v ?? '').toLowerCase());
}

// ── the note-change filter grammar — parses the SAME string clause `'key<op>value'`
// cli/args.mjs's `parseWhere` does (`zz query --where`), off the SAME WHERE_OPS
// constant (notes/validate.mjs — audit 2026-07-03-triggers-review.md NIT 1: this used
// to be an independently-mirrored `CLAUSE_OPS` array with nothing pinning it equal to
// `parseWhere`'s). NOT an import of `parseWhere` itself: cli/ imports grow/ (this
// file), so importing cli/args.mjs back would cycle — importing the shared OPS
// constant from notes/ (which both cli/ and grow/ may freely import downward) avoids
// that while still killing the duplication. A structured `{key, op?, value}` clause
// needs no parsing at all. ─────────────────────────────────────────────────────────
// Exported so a test can pin it against cli/args.mjs's `parseWhere` directly (audit
// 2026-07-03-triggers-review.md NIT 1's "a test asserting the two parsers accept the
// identical op set") — not otherwise used outside this file.
export function parseClauseString(pair) {
  for (const op of WHERE_OPS) { // longest first
    const at = pair.indexOf(op);
    if (at > 0) return { key: pair.slice(0, at), op, value: pair.slice(at + op.length) };
  }
  return null;
}
function normalizeWhere(where) {
  if (!Array.isArray(where)) return [];
  return where.map((c) => {
    if (typeof c === 'string') return parseClauseString(c);
    if (c && typeof c === 'object' && typeof c.key === 'string') return { key: c.key, op: c.op || '=', value: c.value };
    return null;
  }).filter(Boolean);
}

/**
 * The blast-radius safety affordance (§I.2 B2 / Apollo's "current matches: N"): for a
 * `note-change` trigger, the COUNT (and a small SAMPLE) of notes its filter currently
 * matches — "this trigger would fire on N notes right now." Reuses the SAME index
 * query path `zz query --where` uses (`notes/index.mjs`'s `search`/`count`), so the
 * grammar can never drift from the one the CLI's filter flag parses.
 *
 * Any other `on.kind` (manual · cron · ingress) has no notion of "matching notes" — it
 * returns `applicable:false` rather than a meaningless 0, so a caller can render "n/a"
 * instead of a misleading zero.
 * @param {string} home
 * @param {object} trigger  a `type: trigger` note (or its `on` alone — either works)
 * @returns {{applicable:boolean, count:number, sample:string[]}}
 */
export function triggerMatches(home, trigger, { sampleSize = 5 } = {}) {
  const on = trigger?.on;
  if (!on || on.kind !== 'note-change') return { applicable: false, count: 0, sample: [] };
  const filters = { module: on.module || '', type: on.type || '', where: normalizeWhere(on.where) };
  const total = count(home, filters);
  const rows = search(home, { ...filters, limit: sampleSize });
  return { applicable: true, count: total, sample: rows.map((r) => r.addr) };
}

/**
 * `zz trigger list` — every `type: trigger` note in the Project (any module — a
 * trigger is not confined to a dedicated module, unlike `runs`), with its enabled
 * state and blast-radius count. Read-only.
 * @returns {Array<{addr,module,id,title,onKind,run,enabled,blastRadius}>}
 */
export function listTriggers(home) {
  const { items } = searchRows(home, { type: 'trigger', limit: 10000 });
  return items.map((t) => {
    const m = t.on?.kind === 'note-change' ? triggerMatches(home, t) : null;
    return {
      addr: `${t.module}:${t.id}`, module: t.module, id: t.id, title: t.title ?? '',
      onKind: t.on?.kind ?? null, run: t.run ?? null, enabled: isTriggerEnabled(t),
      blastRadius: m ? m.count : null,
    };
  });
}

/**
 * `zz trigger show <module:id>` — one trigger note + its blast-radius preview.
 * @returns {{ok, error?, trigger?, enabled?, matches?}}
 */
export function showTrigger(home, module, id) {
  const t = readNote(home, module, id);
  if (!t) return { ok: false, error: `no note '${module}:${id}'` };
  if (t.type !== 'trigger') return { ok: false, error: `'${module}:${id}' is not a trigger` };
  return { ok: true, trigger: t, enabled: isTriggerEnabled(t), matches: triggerMatches(home, t) };
}

/**
 * `zz trigger enable|disable <module:id>` — the SECOND gate (§I.4 #7): a trigger may
 * be reviewed-in (landed through `zz stage`→`zz review approve`, or written directly by
 * an operator) yet stay `enabled:false` until a human explicitly flips it. This is
 * itself just a note edit — `grow/edit.mjs`'s `patchNote`, the SAME scoped-write path
 * `zz note set` uses — so it lands through the one write door (operator-only; commit()
 * refuses a non-operator actor before any write happens).
 * @returns {{ok, error?, op?, note?}}
 */
export function setTriggerEnabled(home, module, id, enabled, actor = 'operator') {
  const t = readNote(home, module, id);
  if (!t) return { ok: false, error: `no note '${module}:${id}'` };
  if (t.type !== 'trigger') return { ok: false, error: `'${module}:${id}' is not a trigger` };
  return patchNote(home, module, id, 'enabled', !!enabled, actor);
}

// For a note-change trigger, ride the blast-radius numbers along as the fired run's
// CONTEXT (§I.4's "trigger inputs + the matched-note context") — the same convention
// `grow/run.mjs`'s `withIdempotencyKey` uses (an uppercase key merged into `inputs`,
// so it reaches the executing step as `ZZ_MATCHED_COUNT`/`ZZ_MATCHED_SAMPLE` for an
// inline `run:` step, or rides `inputs` verbatim for a `note:` composition step).
function withMatchContext(inputs, matches) {
  if (!matches?.applicable) return inputs;
  return { ...inputs, MATCHED_COUNT: String(matches.count), MATCHED_SAMPLE: matches.sample.join(',') };
}

/**
 * `zz trigger fire <module:id> [--dry-run] [--force]` — fire a trigger EXPLICITLY,
 * right now. Resolves the trigger's `run:` target and starts ONE durable run through
 * `grow/run.mjs`'s `startRun` — the exact same gate, timeout, and generation-pinning a
 * manual `zz run start` gets (triggers add no new execution authority). REFUSES a
 * disabled trigger unless `force:true` (the second gate, still overridable by an
 * explicit human override — never by a note-change match alone). `dryRun:true`
 * computes everything (including the blast-radius preview) WITHOUT starting a run.
 * @param {string} home
 * @param {string} module
 * @param {string} id
 * @param {{dryRun?:boolean, force?:boolean, actor?:string}} [opts]
 * @returns {{ok, error?, refused?, dryRun?, wouldFire?, inputs?, matches?, runId?, run?}}
 */
export function fireTrigger(home, module, id, { dryRun = false, force = false, actor = 'operator' } = {}) {
  const trigger = readNote(home, module, id);
  if (!trigger) return { ok: false, error: `no note '${module}:${id}'` };
  if (trigger.type !== 'trigger') return { ok: false, error: `'${module}:${id}' is not a trigger` };
  if (!isTriggerEnabled(trigger) && !force) {
    return { ok: false, refused: true, error: `trigger '${module}:${id}' is disabled — 'zz trigger enable ${module}:${id}' first, or pass --force` };
  }
  const target = splitAddr(trigger.run);
  if (!target) return { ok: false, error: `trigger '${module}:${id}' has a malformed run target '${trigger.run}' (needs 'module:id')` };

  const matches = triggerMatches(home, trigger);
  const inputs = withMatchContext(trigger.inputs && typeof trigger.inputs === 'object' ? trigger.inputs : {}, matches);
  const wouldFire = `${target.module}:${target.id}`;
  if (dryRun) return { ok: true, dryRun: true, wouldFire, inputs, matches };

  const started = startRun(home, target.module, target.id, inputs, actor);
  if (!started.ok) return { ok: false, error: started.error, refused: started.refused, wouldFire };
  return { ok: true, wouldFire, inputs, matches, runId: started.runId, run: started.run };
}
