// zuzuu/cli/index.mjs — the `zz` veneer: a thin router over the one api.
//
// what: parse argv → call `api` (or init/observe) → render brief TOON. The CLI
//       is the host; it owns NO logic — every verb is a one-liner onto the
//       façade. `kernel ← capabilities ← pipelines ← hosts/cli`: this is the
//       outermost layer, importing inward only.
// why:  AXI — brief-by-default, content-first, TOON output (~40% fewer tokens),
//       no blocking prompts (review is explicit subcommands, not a wizard),
//       structured one-line errors. The agent drives zz; keep every turn cheap.
// how:  a flat switch; `run(argv, io)` returns an exit code and writes via the
//       injected `log` (testable without a process). Zero-dep.

import { open } from '../api.mjs';
import { initHome } from './init.mjs';
import { sessionCommand } from './session.mjs';
import { enable, disable } from './enable.mjs';
import { doctor, status, explain } from './doctor.mjs';
import { code } from './code.mjs';
import { web } from './web.mjs';
import { runHook } from '../hosts/hook.mjs';
import { observe } from '../pipelines/observe.mjs';
import { digestText } from '../pipelines/digest.mjs';
import { toon } from '../kernel/toon.mjs';

const MODULES = ['knowledge', 'memory', 'actions', 'instructions', 'guardrails'];

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

const HELP = `zz — your project's brain (envelopes, queried/run/grown, human-gated)

  zz init                       scaffold .zuzuu/ into this repo (git-citizen)
  zz enable / disable           install/remove the lifecycle + guardrails hooks
  zz query <module> [text]      search a module  (--from <addr> · --tag t · --full)
  zz act <module> <id> [--k v]  run a runnable zu
  zz check [module]             integrity — broken links · orphans · stale
  zz observe                    mine real sessions → proposals (the cold-start)
  zz enhance [module]           propose growth from the event log + sessions
  zz review [module]            list pending proposals
  zz review approve <m> <id>    apply a proposal  (the human gate)
  zz review reject  <m> <id>    archive a proposal
  zz module [list | <m> generations | <m> rollback <n>]
  zz session [status|merge|continue|discard --yes|worktree …|manifest|restore|label]
  zz doctor / status / explain  health · inventory · porcelain
  zz code [dir] / web           launch OpenCode (bundled host) · the workbench
  zz digest                     the session-start brief`;

export async function run(argv, io = {}) {
  const log = io.log ?? console.log;
  const cwd = io.cwd ?? process.cwd();
  const [verb, ...rest] = argv;
  const args = parseArgs(rest);

  try {
    switch (verb) {
      case undefined:
      case 'help':
      case '--help':
      case '-h':
        log(HELP); return 0;

      case 'init': {
        const r = initHome(cwd);
        log(toon('init', [{ home: r.home, created: r.created.length, skipped: r.skipped.length }], ['home', 'created', 'skipped']));
        if (r.created.length) log(`created: ${r.created.join(', ')}`);
        return 0;
      }

      case 'query': {
        const zz = open(cwd);
        const [module, ...words] = args._;
        if (!module) return fail(log, 'usage: zz query <module> [text]');
        const opts = { text: words.join(' '), tag: args.tag || '', full: !!args.full, depth: Number(args.depth) || 0, from: args.from || '', limit: Number(args.limit) || 50, dryRun: !!args['dry-run'] };
        const r = zz.query(module, opts);
        if (!r.ok) return fail(log, r.error);
        const v = r.value;
        if (v.kind === 'count') { log(toon('count', [{ total: v.total }], ['total'])); return 0; }
        const rows = v.rows ?? [];
        log(toon('zus', rows, ['addr', 'type', 'title', 'status'], rows.length ? ['zz act <m> <id>', 'zz query <m> --from <addr>'] : []));
        return 0;
      }

      case 'act': {
        const zz = open(cwd);
        const [module, id] = args._;
        if (!module || !id) return fail(log, 'usage: zz act <module> <id> [--key value]');
        const { _: _drop, ...inputs } = args;
        const r = zz.act(module, id, inputs);
        if (!r.ok) return fail(log, r.error);
        const v = r.value;
        if (!v.ran) return fail(log, v.error || 'did not run');
        log(toon('run', [{ id, success: v.success, exit: v.exitCode, contained: v.contained }], ['id', 'success', 'exit', 'contained']));
        if (v.stdout) log(v.stdout.trimEnd());
        if (v.stderr) log(v.stderr.trimEnd());
        return v.success ? 0 : 1;
      }

      case 'check': {
        const zz = open(cwd);
        const mods = args._[0] ? [args._[0]] : zz.modules().map((m) => m.id);
        const rows = [];
        for (const m of mods) {
          const r = zz.check(m);
          if (!r.ok) continue;
          const v = r.value;
          rows.push({ module: m, broken: v.broken.length, orphans: v.orphans.length, stale: v.stale.length });
        }
        log(toon('integrity', rows, ['module', 'broken', 'orphans', 'stale']));
        return 0;
      }

      case 'observe': {
        const zz = open(cwd);
        const r = observe(zz.home, { cwd, scope: args.scope || 'all' });
        log(toon('observe', [{ mined: r.sessionsMined, candidates: r.candidates, proposed: r.proposed }], ['mined', 'candidates', 'proposed']));
        if (r.proposals.length) log(toon('proposals', r.proposals.map((p) => ({ module: p.module, id: p.target, score: p.score })), ['module', 'id', 'score'], ['zz review <module>']));
        return 0;
      }

      case 'enhance': {
        const zz = open(cwd);
        const mods = args._[0] ? [args._[0]] : MODULES;
        // observe (transcript miner) + each module's enhance (event-log miner)
        const obs = observe(zz.home, { cwd });
        let total = obs.proposed;
        const rows = [{ source: 'observe', proposed: obs.proposed }];
        for (const m of mods) {
          const r = zz.enhance(m);
          const n = r.ok ? r.value.proposed : 0;
          if (n) rows.push({ source: m, proposed: n });
          total += n;
        }
        log(toon('enhance', rows, ['source', 'proposed']));
        log(`${total} proposal(s) queued — review with: zz review`);
        return 0;
      }

      case 'review': {
        const zz = open(cwd);
        const [sub, m, id] = args._;
        if (sub === 'approve' || sub === 'reject') {
          if (!m || !id) return fail(log, `usage: zz review ${sub} <module> <id>`);
          // accept the human handle (the proposal's target) OR the raw propId
          const match = zz.proposals(m).find((p) => (p.target ?? p.id) === id || p.id === id);
          if (!match) return fail(log, `no pending proposal '${id}' in ${m}`);
          const r = sub === 'approve' ? zz.approve(m, match.id) : zz.reject(m, match.id, args.reason || '');
          if (!r.ok) return fail(log, r.error);
          log(toon('review', [{ action: sub, module: m, id }], ['action', 'module', 'id']));
          return 0;
        }
        // list pending across modules (or one)
        const mods = sub ? [sub] : zz.modules().map((x) => x.id);
        const rows = [];
        for (const mod of mods) for (const p of zz.proposals(mod)) rows.push({ module: mod, id: p.target ?? p.id, op: p.op, score: p.score ?? 0 });
        rows.sort((a, b) => b.score - a.score);
        log(toon('pending', rows, ['module', 'id', 'op', 'score'], rows.length ? ['zz review approve <m> <id>', 'zz review reject <m> <id>'] : []));
        return 0;
      }

      case 'module': {
        const zz = open(cwd);
        const [m, action, n] = args._;
        if (!m || m === 'list') {
          log(toon('modules', zz.modules().map((x) => ({ id: x.id, type: x.zu_type ?? '', capabilities: (x.capabilities || []).join('|') })), ['id', 'type', 'capabilities']));
          return 0;
        }
        if (action === 'generations') {
          const g = zz.generations(m);
          log(toon('generations', (g.generations ?? []).map((x) => ({ n: x.n, active: x.n === g.active, items: x.items ? Object.keys(x.items).length : '' })), ['n', 'active', 'items']));
          return 0;
        }
        if (action === 'rollback') {
          const r = zz.rollback(m, Number(n));
          if (!r.ok) return fail(log, r.error || 'rollback failed');
          log(`rolled ${m} back to generation ${n}`);
          return 0;
        }
        return fail(log, 'usage: zz module [list | <m> generations | <m> rollback <n>]');
      }

      case 'session':
        return sessionCommand(args, cwd, log);

      case 'doctor':
        return doctor(cwd, log);
      case 'status':
        return status(cwd, log);
      case 'explain':
        return explain(args._[0], log);
      case 'code':
        return code({ ...args, _: args._ }, { log });
      case 'web':
        return web({ ...args, _: args._ }) ?? 0;

      case 'enable': {
        const r = enable(cwd);
        log(toon('enable', [{ path: r.path, installed: r.installed }], ['path', 'installed']));
        return 0;
      }
      case 'disable': {
        const r = disable(cwd);
        log(toon('disable', [{ path: r.path, removed: r.removed }], ['path', 'removed']));
        return 0;
      }
      case 'hook': {
        // the host lifecycle callback — reads stdin, always exits 0 (own process)
        runHook(args._[0], { host: args.host || 'claude-code', session: args.session, cwd });
        return 0; // unreachable (runHook exits), but keeps the switch total
      }

      case 'digest': {
        const text = digestText(cwd);
        log(text || '(empty brain — run `zz init`)');
        return 0;
      }

      default:
        return fail(log, `unknown verb '${verb}' — try: zz help`);
    }
  } catch (e) {
    return fail(log, e?.message ?? String(e));
  }
}

function fail(log, msg) {
  log(toon('error', [{ message: msg }], ['message']));
  return 1;
}
