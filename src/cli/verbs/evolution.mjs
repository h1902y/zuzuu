// src/cli/verbs/evolution.mjs — the `evolution` plane: grow the Project
// (observe → stage → review → evolve) + the `gen` generation lineage.
// One row per command; composed into THE table by ../commands.mjs.

import { open } from '../../serve/api.mjs';
import { captureSignals } from '../../hosts/capture.mjs';
import { observe } from '../../grow/observe.mjs';
import { observeRuns } from '../../grow/runs-miner.mjs';
import { listTriggers, showTrigger, fireTrigger, setTriggerEnabled } from '../../grow/trigger.mjs';
import { renderNoteDiff } from '../../use/diff.mjs';
import { toon } from '../../notes/toon.mjs';
import { fail, emit, list, fieldPairs, flag } from '../args.mjs';

// `zz trigger …`'s addr parsing — the SAME `module:id` shape every trigger fn expects.
function splitTriggerAddr(addr) {
  const s = String(addr ?? '');
  const i = s.indexOf(':');
  return i > 0 && i < s.length - 1 ? { module: s.slice(0, i), id: s.slice(i + 1) } : null;
}

// post-write integrity nudge: after a gated write, surface any broken links so the
// reviewer sees the consequence (the LSP-after-edit / auto-check pattern). Returns the
// nudge STRING (or null) — the caller decides how to surface it: human mode prints it
// as a prose 2nd line; --json mode rides it on the document as `warnings` (the single-
// emit invariant — a 2nd stdout line would break the daemon's JSON.parse).
function integrityWarning(zz) {
  // `check` is PROJECT-WIDE (it ignores the module arg) — so run it ONCE and read the
  // total. The old per-module reduce summed the same project-wide count M times (an
  // M× over-count, and M× the full corpus scan).
  const mods = zz.modules();
  if (!mods.length) return null;
  const c = zz.check(mods[0].id);
  const broken = c.ok ? c.value.broken.length : 0;
  return broken ? `⚠ ${broken} broken link(s) after this change — run zz check` : null;
}

// ── gen: the per-module generation lineage ───────────────────────────────────────
// Canonical handlers for the `gen …` namespace. The `module <m> generations|diff|
// rollback` key-first forms (daemon-shelled + human muscle-memory) delegate to these
// as deprecating aliases — one source of truth for the generation reads/writes.
// (Exported: verbs/data.mjs's `module` handler dispatches the deprecated forms here.)

export function genLog({ args, cwd, log, json }) {
  const rows = open(cwd).timeline({ module: args._[0] || '', limit: Number(args.limit) || 50 });
  emit(log, json, rows, ['timeline', rows, ['at', 'module', 'gen', 'active', 'from']]);
  return 0;
}
export function genList({ args, cwd, log, json }) {
  const m = args._[0];
  if (!m) return fail(log, 'usage: zz gen list <module>', json);
  const g = open(cwd).generations(m);
  emit(log, json, { active: g.active, generations: g.generations ?? [] },
    ['generations', (g.generations ?? []).map((x) => ({ n: x.n, active: x.n === g.active, from: (x.mintedFrom || []).join('|') })), ['n', 'active', 'from']]);
  return 0;
}
export function genDiff({ args, cwd, log, json }) {
  const [m, a, b] = args._;
  if (!m) return fail(log, 'usage: zz gen diff <module> <a> <b>', json);
  const r = open(cwd).diff(m, Number(a), Number(b));
  if (!r.ok) return fail(log, r.error || 'diff failed', json);
  emit(log, json, r.changes, ['diff', r.changes, ['status', 'id']]);
  return 0;
}
export function genRollback({ args, cwd, log, json }) {
  const [m, n] = args._;
  if (!m) return fail(log, 'usage: zz gen rollback <module> <n>', json);
  const r = open(cwd).rollback(m, Number(n));
  if (!r.ok) return fail(log, r.error || 'rollback failed', json);
  emit(log, json, { module: m, rolledTo: Number(n), ok: true }, ['rollback', [{ module: m, generation: n }], ['module', 'generation']]);
  return 0;
}
export function genMint({ args, cwd, log, json }) {
  const m = args._[0];
  if (!m) return fail(log, 'usage: zz gen mint <module> [--from id,id]', json);
  const mintedFrom = list(args.from);
  const g = open(cwd).mintGeneration(m, { mintedFrom });
  emit(log, json, { id: String(g.n), module: m, mintedFrom: g.mintedFrom ?? mintedFrom },
    ['mint', [{ module: m, generation: g.n }], ['module', 'generation']]);
  return 0;
}

export const evolutionRows = [
  {
    path: ['observe'], plane: 'evolution', json: true, permission: 'write', agentInvokable: true,
    usage: 'observe', summary: 'mine real sessions → staged changes (the cold-start)',
    handler: ({ args, cwd, log, json }) => {
      const zz = open(cwd);
      const sessions = captureSignals({ cwd, scope: args.scope || 'all' });
      const r = observe(zz.home, { cwd, sessions });
      const staged = r.staged.map((p) => ({ module: p.module, id: p.target, score: p.score }));
      emit(log, json, { ok: true, mined: r.sessionsMined, candidates: r.candidates, proposed: r.proposed, staged },
        ['observe', [{ mined: r.sessionsMined, candidates: r.candidates, proposed: r.proposed }], ['mined', 'candidates', 'proposed']]);
      if (r.staged.length && !json) log(toon('staged', staged, ['module', 'id', 'score'], ['zz review <module>']));
      return 0;
    },
  },
  {
    // observe's SIBLING (§I rung 2, "Zus that run"): the feedback edge MODEL.md always
    // named — runs.jsonl → failure/flake evidence → staged proposals — now actually
    // wired. Same shape as `observe`: agent-invokable (a mine + a stage, never a
    // direct write), so it stays OUT of the execution gate's deny set alongside it.
    path: ['observe-runs'], plane: 'evolution', json: true, permission: 'write', agentInvokable: true,
    usage: 'observe-runs [module] [--since <iso>] [--dry-run]',
    summary: "mine runs.jsonl → failure/flake evidence → staged proposals (observe's sibling)",
    handler: ({ args, cwd, log, json }) => {
      const zz = open(cwd);
      const [module] = args._;
      const dryRun = flag(args['dry-run']);
      const r = observeRuns(zz.home, { module: module || null, sinceTs: args.since ?? null, dryRun });
      const staged = r.staged.map((p) => ({ module: p.module, id: p.target, score: p.score }));
      const evidenceRows = r.evidence.map((e) => ({
        note: e.addr, runs: e.totalRuns, failures: e.failures,
        streak: e.consecutiveFailureStreak, rate: `${Math.round(e.failureRate * 100)}%`,
      }));
      emit(log, json, { ok: true, mined: r.evidence.length, flagged: r.flagged, proposed: r.proposed, dryRun, staged, evidence: r.evidence },
        ['observe-runs', [{ mined: r.evidence.length, flagged: r.flagged, proposed: r.proposed }], ['mined', 'flagged', 'proposed']]);
      if (!json) {
        if (evidenceRows.length) log(toon('evidence', evidenceRows, ['note', 'runs', 'failures', 'streak', 'rate']));
        if (dryRun && r.candidates.length) {
          log('dry-run — nothing staged:');
          const would = r.candidates.map((c) => ({ module: c.module, target: c.target, op: c.op, rationale: c.rationale }));
          log(toon('would-stage', would, ['module', 'target', 'op', 'rationale']));
        } else if (r.staged.length) {
          log(toon('staged', staged, ['module', 'id', 'score'], ['zz review <module>']));
        }
      }
      return 0;
    },
  },

  // ── trigger: automation itself is a gated, versioned note (§I rung 4) ─────────────
  // A trigger NAMES an automation (`on: {kind,…}` + `run: <workflow>`) — it adds no new
  // execution authority: `fire` is exactly `run start` under a name, and `enable`/
  // `disable` is exactly a note edit (the second gate, §I.4 #7). There is no `trigger
  // create` row — creating one is `zz note create <m> <id> --type trigger …` (the
  // operator lane) or an agent STAGES it via `zz stage` → `zz review approve` (the
  // gate) — see grow/trigger.mjs's header for the full model + what's deferred
  // (the unattended scheduler + ingress, both hosted-tier).
  {
    path: ['trigger', 'list'], plane: 'evolution', json: true, permission: 'read', agentInvokable: true,
    usage: 'trigger list [--json]', summary: 'every trigger note — on-kind · run target · enabled · blast-radius count',
    handler: ({ cwd, log, json }) => {
      const rows = listTriggers(open(cwd).home);
      const view = rows.map((t) => ({ addr: t.addr, on: t.onKind ?? '', run: t.run ?? '', enabled: t.enabled, matches: t.blastRadius ?? '' }));
      emit(log, json, { ok: true, triggers: rows }, ['triggers', view, ['addr', 'on', 'run', 'enabled', 'matches'], ['zz trigger show <m:id>', 'zz trigger fire <m:id>']]);
      return 0;
    },
  },
  {
    path: ['trigger', 'show'], plane: 'evolution', json: true, permission: 'read', agentInvokable: true,
    usage: 'trigger show <module:id>', summary: 'one trigger note + its blast-radius preview (Apollo-style "current matches: N")',
    io: { params: ['addr'], flags: {} },
    handler: ({ args, cwd, log, json }) => {
      const addr = splitTriggerAddr(args._[0]);
      if (!addr) return fail(log, 'usage: zz trigger show <module:id>', json);
      const r = showTrigger(open(cwd).home, addr.module, addr.id);
      if (!r.ok) return fail(log, r.error, json);
      const row = { addr: args._[0], on: r.trigger.on?.kind ?? '', run: r.trigger.run ?? '', enabled: r.enabled, matches: r.matches.applicable ? r.matches.count : 'n/a' };
      emit(log, json, { ok: true, trigger: r.trigger, enabled: r.enabled, matches: r.matches },
        ['trigger', [row], ['addr', 'on', 'run', 'enabled', 'matches']]);
      return 0;
    },
  },
  {
    // manual/explicit only (§I rung 4's scope) — never agent-invokable, mirroring
    // `run start`/`run advance`: firing is a write (it starts a durable run), so it
    // rides the operator lane exactly like the durable runner it delegates to.
    path: ['trigger', 'fire'], plane: 'evolution', json: true, permission: 'write', agentInvokable: false,
    usage: 'trigger fire <module:id> [--dry-run] [--force]',
    summary: 'fire a trigger NOW — one durable run via the same gate `run start` uses (refuses if disabled unless --force)',
    io: { params: ['addr'], flags: { 'dry-run': '--dry-run', force: '--force' } },
    handler: ({ args, cwd, log, json }) => {
      const addr = splitTriggerAddr(args._[0]);
      if (!addr) return fail(log, 'usage: zz trigger fire <module:id> [--dry-run] [--force]', json);
      const dryRun = flag(args['dry-run']);
      const force = flag(args.force);
      const r = fireTrigger(open(cwd).home, addr.module, addr.id, { dryRun, force });
      if (!r.ok) return fail(log, r.error, json);
      const row = { addr: args._[0], fires: r.wouldFire, dryRun, runId: r.runId ?? '(dry-run)' };
      emit(log, json, r, ['fire', [row], ['addr', 'fires', 'dryRun', 'runId'], r.runId ? [`zz run advance ${r.runId}`] : []]);
      return 0;
    },
  },
  {
    path: ['trigger', 'enable'], plane: 'evolution', json: true, permission: 'write', agentInvokable: false,
    usage: 'trigger enable <module:id>', summary: 'the second gate (§I.4 #7) — let a reviewed-in trigger fire',
    io: { params: ['addr'], flags: {} },
    handler: ({ args, cwd, log, json }) => {
      const addr = splitTriggerAddr(args._[0]);
      if (!addr) return fail(log, 'usage: zz trigger enable <module:id>', json);
      const r = setTriggerEnabled(open(cwd).home, addr.module, addr.id, true);
      if (!r.ok) return fail(log, r.error, json);
      emit(log, json, { ok: true, addr: args._[0], enabled: true }, ['trigger', [{ addr: args._[0], enabled: true }], ['addr', 'enabled']]);
      return 0;
    },
  },
  {
    path: ['trigger', 'disable'], plane: 'evolution', json: true, permission: 'write', agentInvokable: false,
    usage: 'trigger disable <module:id>', summary: 'turn a trigger off without deleting it',
    io: { params: ['addr'], flags: {} },
    handler: ({ args, cwd, log, json }) => {
      const addr = splitTriggerAddr(args._[0]);
      if (!addr) return fail(log, 'usage: zz trigger disable <module:id>', json);
      const r = setTriggerEnabled(open(cwd).home, addr.module, addr.id, false);
      if (!r.ok) return fail(log, r.error, json);
      emit(log, json, { ok: true, addr: args._[0], enabled: false }, ['trigger', [{ addr: args._[0], enabled: false }], ['addr', 'enabled']]);
      return 0;
    },
  },

  {
    path: ['stage'], plane: 'evolution', json: true, permission: 'write', agentInvokable: true,
    usage: 'stage <m> --op create|update|delete|deprecate|relate|unrelate [--target <id>] --field k=v', summary: 'stage a change (a pending proposal)',
    io: { params: ['module'], flags: { op: '--op', target: '--target', change: '--change' } }, // catalog: the daemon stages via --change <json>
    handler: ({ args, cwd, log, json, rest }) => {
      // the write entry-door: a UI (or human) stages a change → a PENDING proposal
      // the review gate governs. A thin door over the complete grow/stage engine.
      const zz = open(cwd);
      const [module] = args._;
      const op = args.op;
      if (!module || !op) return fail(log, 'usage: zz stage <module> --op create|update|delete|deprecate|relate|unrelate --target <id> [--field k=v …] [--change <json>]', json);
      // create/update/delete/deprecate operate on a --target note; relate/unrelate carry
      // the edge in --change ({from,type,to}), so they need no --target.
      if ((op === 'create' || op === 'update' || op === 'delete' || op === 'deprecate') && !args.target) return fail(log, `--target <id> is required for op '${op}'`, json);
      // the change body: --change <json> (the machine path) OR repeated --field k=v (human sugar)
      let change = {};
      if (args.change) { try { change = JSON.parse(args.change); } catch { return fail(log, 'invalid --change JSON', json); } }
      else change = fieldPairs(rest);
      const rec = zz.stage(module, { op, target: args.target, change });
      if (!rec) return fail(log, `invalid op '${op}' (create|update|delete|deprecate|relate|unrelate)`, json);
      // B1(a) (audit 2026-07-03-secrets-review.md): a poisoned type:secret proposal is
      // refused HERE, at stage time — `{error}` (no `.id`), never written to staged/.
      if (rec.error) return fail(log, rec.error, json);
      const handle = { id: rec.id, op: rec.op, module: rec.module, target: rec.target, status: rec.status, score: rec.score, duplicate: !!rec.duplicate };
      emit(log, json, handle, ['staged', [{ id: rec.id, op: rec.op, target: rec.target ?? '', status: rec.status }], ['id', 'op', 'target', 'status'], ['zz review ' + module]]);
      return 0;
    },
  },
  {
    path: ['review'], plane: 'evolution', json: true, permission: 'gate', agentInvokable: false,
    // `review` is ONE row: the bare form lists/reads (allowed), but `approve`/`apply` LAND
    // changes — the execution gate denies those two subcommands to the agent. Declared here
    // so the deny set stays table-driven (writeVerbPaths reads `writeSubcommands`).
    writeSubcommands: ['approve', 'apply'],
    usage: 'review [module | plan <m> | apply <m> | approve <m> <id> | reject <m> <id>]',
    summary: 'THE human gate — list · preview · apply staged changes',
    handler: ({ args, cwd, log, json }) => {
      const zz = open(cwd);
      const [sub, m, id] = args._;
      if (sub === 'plan') {
        if (!m) return fail(log, 'usage: zz review plan <module>');
        const p = zz.plan(m);
        if (!p.count) { log(`nothing staged in ${m}`); return 0; }
        for (const mem of p.members) log(mem.error ? `! ${mem.addr}: ${mem.error}` : renderNoteDiff(mem.addr, mem.diff));
        log(`\nplan ${p.planId} — ${p.count} change(s) → one generation. apply: zz review apply ${m} ${p.planId}`);
        return 0;
      }
      if (sub === 'apply') {
        if (!m) return fail(log, 'usage: zz review apply <module> [plan-id]', json);
        const r = zz.apply(m, id);
        if (!r.ok) return fail(log, r.error, json);
        // single-emit: the integrity nudge rides as a `warnings` field under --json,
        // and as a 2nd prose line in human mode — never a 2nd stdout line either way.
        const warning = integrityWarning(zz);
        emit(log, json, { module: r.module, applied: r.applied, generation: r.generation, ...(warning ? { warnings: [warning] } : {}) },
          ['apply', [{ module: r.module, applied: r.applied, generation: r.generation }], ['module', 'applied', 'generation']]);
        if (warning && !json) log(warning);
        return 0;
      }
      if (sub === 'approve' || sub === 'reject') {
        if (!m || !id) return fail(log, `usage: zz review ${sub} <module> <id>`, json);
        // accept the human handle (the staged change's target) OR the raw stageId
        const match = zz.staged(m).find((p) => (p.target ?? p.id) === id || p.id === id);
        if (!match) return fail(log, `no pending staged change '${id}' in ${m}`, json);
        const r = sub === 'approve' ? zz.approve(m, match.id) : zz.reject(m, match.id, args.reason || '');
        if (!r.ok) return fail(log, r.error, json);
        // single-emit: the post-approve integrity nudge rides as a `warnings` field on
        // the JSON document (a 2nd stdout line would break the daemon's JSON.parse) and
        // as a 2nd prose line in human mode. reject never nudges (it lands nothing).
        const warning = sub === 'approve' ? integrityWarning(zz) : null;
        emit(log, json, { action: sub, module: m, id, ok: true, ...(warning ? { warnings: [warning] } : {}) }, ['review', [{ action: sub, module: m, id }], ['action', 'module', 'id']]);
        if (warning && !json) log(warning);
        return 0;
      }
      // list pending across modules (or one)
      const mods = sub ? [sub] : zz.modules().map((x) => x.id);
      const rows = [];
      for (const mod of mods) for (const p of zz.staged(mod)) rows.push({ module: mod, id: p.target ?? p.id, op: p.op, score: p.score ?? 0 });
      rows.sort((a, b) => b.score - a.score);
      emit(log, json, rows, ['pending', rows, ['module', 'id', 'op', 'score'], rows.length ? ['zz review approve <m> <id>', 'zz review reject <m> <id>'] : []]);
      return 0;
    },
  },

  // ── gen: the per-module generation lineage — the Tier-2 `gen …` namespace ──
  {
    path: ['gen', 'log'], plane: 'evolution', json: true, permission: 'read', agentInvokable: true,
    usage: 'gen log [module]', summary: 'the generation timeline — how the brain evolved',
    handler: genLog,
  },
  {
    path: ['gen', 'list'], plane: 'evolution', json: true, permission: 'read', agentInvokable: true,
    usage: 'gen list <m>', summary: "a module's generation lineage + the active one",
    handler: genList,
  },
  {
    path: ['gen', 'diff'], plane: 'evolution', json: true, permission: 'read', agentInvokable: true,
    usage: 'gen diff <m> <a> <b>', summary: 'diff two generations of a module',
    handler: genDiff,
  },
  {
    path: ['gen', 'rollback'], plane: 'evolution', json: true, permission: 'admin', agentInvokable: false,
    usage: 'gen rollback <m> <n>', summary: 'roll a module back to generation n (pointer-flip)',
    handler: genRollback,
  },
  {
    path: ['gen', 'mint'], plane: 'evolution', json: true, permission: 'admin', agentInvokable: false,
    usage: 'gen mint <m> [--from id,id]', summary: "freeze a module's current items into a new generation",
    handler: genMint,
    io: { params: ['module'], flags: { from: '--from' } },
  },
];
