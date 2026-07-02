// src/cli/verbs/evolution.mjs — the `evolution` plane: grow the Project
// (observe → stage → review → evolve) + the `gen` generation lineage.
// One row per command; composed into THE table by ../commands.mjs.

import { open } from '../../serve/api.mjs';
import { captureSignals } from '../../hosts/capture.mjs';
import { observe } from '../../grow/observe.mjs';
import { renderNoteDiff } from '../../use/diff.mjs';
import { toon } from '../../notes/toon.mjs';
import { fail, emit, list, fieldPairs } from '../args.mjs';

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
