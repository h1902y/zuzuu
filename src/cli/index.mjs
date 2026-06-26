// src/cli/index.mjs — the `zz` veneer: a thin router over the one api.
//
// what: parse argv → call `api` (or init/observe) → render brief TOON. The CLI
//       is the host; it owns NO logic — every verb is a one-liner onto the
//       façade. `notes ← use · loop ← serve ← hosts · cli`: this is the
//       outermost layer, importing inward only.
// why:  AXI — brief-by-default, content-first, TOON output (~40% fewer tokens),
//       no blocking prompts (review is explicit subcommands, not a wizard),
//       structured one-line errors. The agent drives zz; keep every turn cheap.
// how:  a flat switch; `run(argv, io)` returns an exit code and writes via the
//       injected `log` (testable without a process). Zero-dep.

import { open } from '../serve/api.mjs';
import { initHome } from './init.mjs';
import { sessionCommand } from './session.mjs';
import { registryCommand } from './registry.mjs';
import { enable, disable } from './enable.mjs';
import { doctor, status, explain } from './doctor.mjs';
import { code } from './code.mjs';
import { web } from './web.mjs';
import { runHook } from '../hosts/hook.mjs';
import { captureSignals } from '../hosts/capture.mjs';
import { observe } from '../grow/observe.mjs';
import { digestText } from '../serve/digest.mjs';
import { openerText, closerText, steerText, writeHandoff, parkItem, clearParking } from '../serve/steering.mjs';
import { renderNoteDiff } from '../use/diff.mjs';
import { toon } from '../notes/toon.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { itemPath } from '../notes/store.mjs';
import { parse } from '../notes/note.mjs';


/** Read a landed note's `source` provenance pointer off disk (U6 / R6) — the search
 *  index only carries the indexed columns, so the record view's "born here" link
 *  reads the frontmatter directly. Returns null when absent/unreadable (fail-soft). */
function readNoteSource(home, module, id) {
  try {
    const p = itemPath(home, module, id);
    if (!existsSync(p)) return null;
    const { note } = parse(readFileSync(p, 'utf8'), { id });
    return note?.source ?? null;
  } catch { return null; }
}

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

const HELP = `zz — your repo's Project (envelopes, queried/run/grown, human-gated)

  zz init                       scaffold .zuzuu/ into this repo (git-citizen)
  zz enable / disable           install/remove the lifecycle + guardrails hooks
  zz query <module> [text]      search  (--from walk · --to backlinks · --as-of <n> · --tag t · --full)
  zz log [module]               the generation timeline — how the brain evolved
  zz act <module> <id> [--k v]  run a runnable note
  zz flow <module> <id>         run a workflow note (a DAG of gated run-steps)
  zz view <module> <id>         read a note body windowed (--offset n · --limit n)
  zz patch <m> <id> <key> <v>   set one frontmatter field  ·  zz append <m> <id> <text>
  zz check [module]             integrity — broken links · orphans · stale
  zz validate [module]          schema-check every note (type-keyed invariants)
  zz observe                    mine real sessions → staged changes (the cold-start)
  zz stage <m> --op create|update --target <id> --field k=v   stage a change (a pending proposal)
  zz review [module]            list staged changes awaiting the gate
  zz review plan <m>            preview the module's pending set as one change-set
  zz review apply <m> [plan]    apply the set as ONE generation (all-or-nothing)
  zz review approve <m> <id>    apply a single staged change  (the human gate)
  zz review reject  <m> <id>    archive a staged change
  zz rename <m> <old> <new>     rename a note + rewrite every inbound link
  zz merge <m> <src> <dst>      merge two notes (re-point referrers to dst)
  zz refactor <m> --field k --from v --to v   rewrite a field across the module
  zz module [list | overview | items <k> | item <k> <id> | schema <k> | <m> generations | <m> diff <a> <b> | <m> rollback <n>]
  zz session [status|merge|continue|discard --yes|worktree …|label]
  zz doctor / status / explain  health · inventory · porcelain
  zz code [dir] / web           launch OpenCode (bundled host) · the workbench
  zz digest                     the session-start brief (agent-facing)
  zz start                      the recommended session opener (paste as your first message)
  zz wrap [--note <text>]       the recommended session closer; --note saves a handoff
  zz steer [--park <item>]      stay on scope: drift signals · parking lot · guidance to pin`;

export async function run(argv, io = {}) {
  const log = io.log ?? console.log;
  const cwd = io.cwd ?? process.cwd();
  const [verb, ...rest] = argv;
  const args = parseArgs(rest);
  const json = !!args.json;   // global: emit machine-readable JSON instead of TOON (the daemon JSON.parses stdout)

  try {
    switch (verb) {
      case undefined:
      case 'help':
      case '--help':
      case '-h':
        log(HELP); return 0;

      case 'init': {
        const r = initHome(cwd);
        emit(log, json, { ok: true, home: r.home, created: r.created, skipped: r.skipped },
          ['init', [{ home: r.home, created: r.created.length, skipped: r.skipped.length }], ['home', 'created', 'skipped']]);
        if (r.created.length && !json) log(`created: ${r.created.join(', ')}`);
        return 0;
      }

      case 'validate': {
        const bad = open(cwd).validate(args._[0] || '');
        if (!bad.length) { log('all notes valid'); return 0; }
        log(toon('invalid', bad.map((b) => ({ addr: b.addr, errors: b.errors.join('; ') })), ['addr', 'errors']));
        return 1;
      }

      case 'log': {
        const rows = open(cwd).timeline({ module: args._[0] || '', limit: Number(args.limit) || 50 });
        log(toon('timeline', rows, ['at', 'module', 'gen', 'active', 'from']));
        return 0;
      }

      case 'query': {
        const zz = open(cwd);
        const [module, ...words] = args._;
        if (!module) return fail(log, 'usage: zz query <module> [text]');
        if (args['as-of'] !== undefined) {
          const r = zz.asOf(module, Number(args['as-of']));
          if (!r.ok) return fail(log, r.error);
          log(toon(`notes@gen${r.generation}`, r.notes, ['addr', 'type', 'title', 'status']));
          return 0;
        }
        const opts = { text: words.join(' '), tag: args.tag || '', full: !!args.full, depth: Number(args.depth) || 0, from: args.from || '', to: args.to || '', limit: Number(args.limit) || 50, dryRun: !!args['dry-run'] };
        const r = zz.query(module, opts);
        if (!r.ok) return fail(log, r.error);
        const v = r.value;
        if (v.kind === 'count') { log(toon('count', [{ total: v.total }], ['total'])); return 0; }
        const rows = v.rows ?? [];
        if (v.kind === 'backlinks') {
          log(toon('backlinks', rows, ['addr', 'type'], rows.length ? [] : []));
          if (!rows.length) log(`0 notes link to ${v.addr} — it's unreferenced (an orphan candidate; see zz check)`);
          return 0;
        }
        // explicit empty-result signal (absence is itself signal — SWE-agent ACI)
        if (!rows.length) {
          const what = v.kind === 'related' ? `no notes related to ${v.addr}` : `0 results${opts.text ? ` for "${opts.text}"` : ''}`;
          log(`${what} — try broader terms, --from <addr> (neighbors), --to <addr> (backlinks), or zz check for orphans`);
          return 0;
        }
        const cols = rows.some((r) => r.snippet) ? ['addr', 'type', 'title', 'snippet'] : ['addr', 'type', 'title', 'status'];
        log(toon('notes', rows, cols, ['zz act <m> <id>', 'zz query <m> --from <addr>']));
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
        log(toon('run', [{ id, success: v.success, exit: v.exitCode }], ['id', 'success', 'exit']));
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
        const sessions = captureSignals({ cwd, scope: args.scope || 'all' });
        const r = observe(zz.home, { cwd, sessions });
        const staged = r.staged.map((p) => ({ module: p.module, id: p.target, score: p.score }));
        emit(log, json, { ok: true, mined: r.sessionsMined, candidates: r.candidates, proposed: r.proposed, staged },
          ['observe', [{ mined: r.sessionsMined, candidates: r.candidates, proposed: r.proposed }], ['mined', 'candidates', 'proposed']]);
        if (r.staged.length && !json) log(toon('staged', staged, ['module', 'id', 'score'], ['zz review <module>']));
        return 0;
      }

      case 'stage': {
        // the write entry-door: a UI (or human) stages a change → a PENDING proposal
        // the review gate governs. A thin door over the complete grow/stage engine.
        const zz = open(cwd);
        const [module] = args._;
        const op = args.op;
        if (!module || !op) return fail(log, 'usage: zz stage <module> --op create|update --target <id> [--field k=v …] [--change <json>]', json);
        if ((op === 'create' || op === 'update') && !args.target) return fail(log, `--target <id> is required for op '${op}'`, json);
        // the change body: --change <json> (the machine path) OR repeated --field k=v (human sugar,
        // scanned from raw argv so multiples accumulate — parseArgs would keep only the last)
        let change = {};
        if (args.change) { try { change = JSON.parse(args.change); } catch { return fail(log, 'invalid --change JSON', json); } }
        else for (let i = 0; i < rest.length; i++) {
          if (rest[i] === '--field' && rest[i + 1] != null) {
            const eq = rest[i + 1].indexOf('=');
            if (eq > 0) change[rest[i + 1].slice(0, eq)] = rest[i + 1].slice(eq + 1);
            i++;
          }
        }
        const rec = zz.stage(module, { op, target: args.target, change });
        if (!rec) return fail(log, `invalid op '${op}' (create|update|delete|relate|deprecate)`, json);
        const handle = { id: rec.id, op: rec.op, module: rec.module, target: rec.target, status: rec.status, score: rec.score, duplicate: !!rec.duplicate };
        emit(log, json, handle, ['staged', [{ id: rec.id, op: rec.op, target: rec.target ?? '', status: rec.status }], ['id', 'op', 'target', 'status'], ['zz review ' + module]]);
        return 0;
      }


      case 'review': {
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
          if (!m) return fail(log, 'usage: zz review apply <module> [plan-id]');
          const r = zz.apply(m, id);
          if (!r.ok) return fail(log, r.error);
          log(toon('apply', [{ module: r.module, applied: r.applied, generation: r.generation }], ['module', 'applied', 'generation']));
          integrityNudge(zz, log);
          return 0;
        }
        if (sub === 'approve' || sub === 'reject') {
          if (!m || !id) return fail(log, `usage: zz review ${sub} <module> <id>`, json);
          // accept the human handle (the staged change's target) OR the raw stageId
          const match = zz.staged(m).find((p) => (p.target ?? p.id) === id || p.id === id);
          if (!match) return fail(log, `no pending staged change '${id}' in ${m}`, json);
          const r = sub === 'approve' ? zz.approve(m, match.id) : zz.reject(m, match.id, args.reason || '');
          if (!r.ok) return fail(log, r.error, json);
          emit(log, json, { action: sub, module: m, id, ok: true }, ['review', [{ action: sub, module: m, id }], ['action', 'module', 'id']]);
          if (sub === 'approve' && !json) integrityNudge(zz, log);   // a 2nd line would break the daemon's JSON.parse
          return 0;
        }
        // list pending across modules (or one)
        const mods = sub ? [sub] : zz.modules().map((x) => x.id);
        const rows = [];
        for (const mod of mods) for (const p of zz.staged(mod)) rows.push({ module: mod, id: p.target ?? p.id, op: p.op, score: p.score ?? 0 });
        rows.sort((a, b) => b.score - a.score);
        emit(log, json, rows, ['pending', rows, ['module', 'id', 'op', 'score'], rows.length ? ['zz review approve <m> <id>', 'zz review reject <m> <id>'] : []]);
        return 0;
      }

      case 'flow': {
        const [m, id] = args._;
        if (!m || !id) return fail(log, 'usage: zz flow <module> <id>');
        const { _: _d, ...inputs } = args;
        const r = open(cwd).flow(m, id, inputs);
        if (!r.ok && !r.steps) return fail(log, r.error);
        log(toon('flow', r.steps, ['id', 'success', 'exitCode']));
        if (!r.ok) { log(`✗ failed at step '${r.failedStep}'${r.compensations?.length ? ` — compensated ${r.compensations.length} step(s)` : ''}`); return 1; }
        return 0;
      }

      case 'view': {
        const [m, id] = args._;
        if (!m || !id) return fail(log, 'usage: zz view <module> <id> [--offset n] [--limit n]');
        const r = open(cwd).view(m, id, { offset: Number(args.offset) || 0, limit: Number(args.limit) || 0 });
        if (!r.ok) return fail(log, r.error);
        log(toon('view', [{ addr: r.addr, title: r.title ?? '', lines: r.total, shown: `${r.offset}–${r.offset + r.shown}${r.partial ? ' (PARTIAL)' : ''}` }], ['addr', 'title', 'lines', 'shown']));
        if (r.body) log(r.body);
        return 0;
      }

      case 'patch': {
        const [m, id, key, ...rest] = args._;
        if (!m || !id || !key || !rest.length) return fail(log, 'usage: zz patch <module> <id> <key> <value>');
        const r = open(cwd).patch(m, id, key, rest.join(' '));
        if (!r.ok) return fail(log, r.error);
        log(`patched ${m}:${id} ${key}`);
        return 0;
      }

      case 'append': {
        const [m, id, ...rest] = args._;
        if (!m || !id || !rest.length) return fail(log, 'usage: zz append <module> <id> <text>');
        const r = open(cwd).append(m, id, rest.join(' '));
        if (!r.ok) return fail(log, r.error);
        log(`appended to ${m}:${id}`);
        return 0;
      }

      case 'rename': {
        const [m, oldId, newId] = args._;
        if (!m || !oldId || !newId) return fail(log, 'usage: zz rename <module> <old-id> <new-id>');
        const r = open(cwd).rename(m, oldId, newId);
        if (!r.ok) return fail(log, r.error);
        log(`renamed ${r.renamed} — ${r.refs} referrer(s) updated, ${r.generations.length} generation(s)`);
        return 0;
      }

      case 'merge': {
        const [m, src, dst] = args._;
        if (!m || !src || !dst) return fail(log, 'usage: zz merge <module> <src-id> <dst-id>');
        const r = open(cwd).merge(m, src, dst);
        if (!r.ok) return fail(log, r.error);
        log(`merged ${r.merged} — ${r.refs} referrer(s) re-pointed`);
        return 0;
      }

      case 'refactor': {
        const [m] = args._;
        if (!m || !args.field || args.from === undefined || args.to === undefined) return fail(log, 'usage: zz refactor <module> --field <key> --from <v> --to <v>');
        const r = open(cwd).refactor(m, args.field, args.from, args.to);
        if (!r.ok) return fail(log, r.error);
        log(`refactored ${m}.${r.field} — ${r.changed} note(s) rewritten`);
        return 0;
      }

      case 'module': {
        const zz = open(cwd);
        const [a, b, c] = args._;

        // subcommand-first reads (what the web daemon shells): overview · items <key> · item <key> <id> · schema <key>
        if (a === 'overview') {
          const rows = zz.modules().map((mod) => ({
            key: mod.id, title: mod.title ?? mod.id, note_type: mod.note_type ?? '',
            items: (zz.query(mod.id, { text: '', limit: 10000 }).value?.rows ?? []).length,
            pending: zz.staged(mod.id).length, capabilities: mod.capabilities ?? [],
          }));
          emit(log, json, rows, ['overview', rows, ['key', 'items', 'pending']]);
          return 0;
        }
        if (a === 'items') {
          if (!b) return fail(log, 'usage: zz module items <key>', json);
          const r = zz.query(b, { text: '', full: true, limit: 10000 });
          if (!r.ok) return fail(log, r.error, json);
          const items = (r.value.rows ?? []).map((row) => ({ id: row.addr.split(':').pop(), module: b, kind: row.type, title: row.title ?? '', status: row.status ?? '', body: row.body ?? '' }));
          // shape: { items, errors } + `kind` — the daemon's moduleEnvelopeItems passes this
          // straight through as the shared ModuleItem[] (otherwise it degrades to peek)
          emit(log, json, { items, errors: [] }, ['items', items, ['id', 'kind', 'title', 'status']]);
          return 0;
        }
        if (a === 'item') {
          if (!b || !c) return fail(log, 'usage: zz module item <key> <id>', json);
          const r = zz.query(b, { text: '', full: true, limit: 10000 });
          if (!r.ok) return fail(log, r.error, json);
          const row = (r.value.rows ?? []).find((x) => x.addr.split(':').pop() === c);
          if (!row) return fail(log, `no note '${c}' in ${b}`, json);
          // Provenance (U6 / R6): the search row carries only the indexed columns, so
          // lift the note's `source` pointer (where it was born — see evolve.projectChange)
          // straight off disk so the record view can render its "born here" link.
          const src = readNoteSource(zz.home, b, c);
          const item = { id: c, module: b, kind: row.type, title: row.title ?? '', status: row.status ?? '', body: row.body ?? '', ...(src ? { source: src } : {}) };
          emit(log, json, item, ['item', [{ id: c, kind: row.type, title: row.title ?? '' }], ['id', 'kind', 'title']]);
          return 0;
        }
        if (a === 'schema') {
          if (!b) return fail(log, 'usage: zz module schema <key>', json);
          const mod = zz.modules().find((x) => x.id === b);
          const fields = Array.isArray(mod?.fields) ? mod.fields : [];  // U10 surfaces a module.md `fields` block here; absent ⇒ schemaless
          emit(log, json, { key: b, fields }, ['schema', fields, ['name', 'type']]);
          return 0;
        }

        // key-first (existing): list | <m> generations | <m> diff <a> <b> | <m> rollback <n>
        const [m, action, n] = args._;
        if (!m || m === 'list') {
          const rows = zz.modules().map((x) => ({ id: x.id, type: x.note_type ?? '', capabilities: (x.capabilities || []).join('|') }));
          emit(log, json, rows, ['modules', rows, ['id', 'type', 'capabilities']]);
          return 0;
        }
        if (action === 'generations') {
          const g = zz.generations(m);
          emit(log, json, { active: g.active, generations: g.generations ?? [] },
            ['generations', (g.generations ?? []).map((x) => ({ n: x.n, active: x.n === g.active, from: (x.mintedFrom || []).join('|') })), ['n', 'active', 'from']]);
          return 0;
        }
        if (action === 'rollback') {
          const r = zz.rollback(m, Number(n));
          if (!r.ok) return fail(log, r.error || 'rollback failed', json);
          emit(log, json, { module: m, rolledTo: Number(n), ok: true }, ['rollback', [{ module: m, generation: n }], ['module', 'generation']]);
          return 0;
        }
        if (action === 'diff') {
          const r = zz.diff(m, Number(n), Number(args._[3]));
          if (!r.ok) return fail(log, r.error || 'diff failed', json);
          emit(log, json, r.changes, ['diff', r.changes, ['status', 'id']]);
          return 0;
        }
        return fail(log, 'usage: zz module [list | overview | items <k> | item <k> <id> | schema <k> | <m> generations | <m> diff <a> <b> | <m> rollback <n>]', json);
      }

      case 'session':
        return sessionCommand(args, cwd, log);

      case 'registry':
        return registryCommand(args, cwd, log);

      case 'subscribe': {
        const m = args._[0];
        if (!m) return fail(log, 'usage: zz subscribe <module>', json);
        try {
          const r = open(cwd).registry.subscribe(m);
          if (!r.ok) return fail(log, r.error, json);
          emit(log, json, r, ['subscribe', [{ module: r.module, staged: r.staged }], ['module', 'staged']]);
          return 0;
        } catch (e) { return fail(log, e.message, json); }
      }

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
        emit(log, json, { ok: true, path: r.path, installed: r.installed },
          ['enable', [{ path: r.path, installed: r.installed }], ['path', 'installed']]);
        return 0;
      }
      case 'disable': {
        const r = disable(cwd);
        emit(log, json, { ok: true, path: r.path, removed: r.removed },
          ['disable', [{ path: r.path, removed: r.removed }], ['path', 'removed']]);
        return 0;
      }
      case 'hook': {
        // the host lifecycle callback — reads stdin, always exits 0 (own process)
        runHook(args._[0], { host: args.host || 'claude-code', session: args.session, cwd });
        return 0; // unreachable (runHook exits), but keeps the switch total
      }

      case 'digest': {
        const text = digestText(cwd);
        log(text || '(empty Project — run `zz init`)');
        return 0;
      }

      case 'start': {
        log(openerText(cwd) || '(no Project — run `zz init`)');
        return 0;
      }

      case 'wrap': {
        if (args.note) writeHandoff(open(cwd).home, args.note);
        log(closerText(cwd) || '(no Project — run `zz init`)');
        if (args.note) log('\n(handoff saved — `zz start` will surface it next session)');
        return 0;
      }

      case 'steer': {
        const home = open(cwd).home;
        if (args.clear) { clearParking(home); log('parking lot cleared'); return 0; }
        if (args.park) { parkItem(home, args.park); log(`parked: ${args.park}`); return 0; }
        log(steerText(cwd));
        return 0;
      }

      default:
        return fail(log, `unknown verb '${verb}' — try: zz help`);
    }
  } catch (e) {
    return fail(log, e?.message ?? String(e));
  }
}

function fail(log, msg, json = false) {
  log(json ? JSON.stringify({ ok: false, error: msg }) : toon('error', [{ message: msg }], ['message']));
  return 1;
}

/** Emit a value as JSON (--json, for the daemon) or as TOON. `toonArgs` = [name, rows, cols, hints?]. */
function emit(log, json, value, toonArgs) {
  log(json ? JSON.stringify(value) : toon(...toonArgs));
}

// post-write integrity nudge: after a gated write, surface any broken links so the
// reviewer sees the consequence (the LSP-after-edit / auto-check pattern).
function integrityNudge(zz, log) {
  const broken = zz.modules().reduce((n, m) => { const c = zz.check(m.id); return n + (c.ok ? c.value.broken.length : 0); }, 0);
  if (broken) log(`⚠ ${broken} broken link(s) after this change — run zz check`);
}
