// src/cli/commands.mjs — the command table: ONE declarative row per command, the
// single source of truth the router (index.mjs) and `zz help` both read.
//
// what: an array of `{ path, plane, summary, usage, handler, …metadata }` rows.
//       `path` is the argv prefix the router longest-prefix-matches; `handler`
//       receives a `ctx` ({ args, cwd, log, json, rest, warn }) and returns an exit
//       code. The grammar is TWO-TIER: Tier-1 hot-loop verbs stay FLAT (querying
//       them every turn must stay cheap on tokens), Tier-2 cold verbs live under
//       NOUN namespaces (`note · gen · session · host · registry`).
// why:  a hand-maintained switch + a hand-maintained HELP const drift apart. Folding
//       the table BY PLANE/NAMESPACE to generate help means an unlisted command can't
//       exist — the table is the spec the router executes AND the help renders. And
//       back-compat is data, not code: an old verb is an `alias` ROW pointing at its
//       canonical path; the router emits ONE stderr deprecation note and dispatches
//       the SAME handler — no per-verb wrapper boilerplate.
// how:  the rows carry display metadata (plane · summary · usage) the help reader
//       folds, plus capability metadata (json · permission · agentInvokable) that
//       RECORDS today's reality. Alias rows carry only `{ path, alias }`. Zero-dep.

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
import { searchRows, readEnvelopes } from '../notes/rows.mjs';

// The read projection's column SKIP set — mirrors the client grid's `inferKeys`
// (web/src/client/shell/stage/grid-columns.ts): `module` is implicit, `body` is the
// record, `provenance`/`payload` are nested objects. They still ride in the item
// (the record needs them); they're just not displayed AS columns.
const COLUMN_SKIP = new Set(['module', 'body', 'provenance', 'payload']);

/** Map a hydrated envelope to the daemon's ModuleItem shape: `type` → `kind`, the
 *  `module` injected, every other frontmatter column (incl. custom ones + `source`)
 *  carried through whole. The lossless row the grid renders. */
function projectRow(note, module) {
  const { type, ...rest } = note; // rest: id · title · status · body · custom columns…
  return { id: rest.id, module, kind: type ?? '', title: rest.title ?? '', status: rest.status ?? '', ...rest };
}

/** Repeated `--where key=val` → [{key,value}] (the EAV column filters). parseArgs
 *  keeps only the LAST of a repeated flag, so — like `stage`'s `--field` — scan the
 *  raw argv so multiples accumulate. A pair without `=` (or empty key) is skipped. */
function whereFilters(rest) {
  const out = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--where' && rest[i + 1] != null) {
      const eq = rest[i + 1].indexOf('=');
      if (eq > 0) out.push({ key: rest[i + 1].slice(0, eq), value: rest[i + 1].slice(eq + 1) });
      i++;
    }
  }
  return out;
}

/** `--sort <col>[:desc]` → { col, desc } | null (the index orders by it). */
function parseSort(raw) {
  if (!raw || raw === true) return null;
  const [col, dir] = String(raw).split(':');
  return col ? { col, desc: dir === 'desc' } : null;
}

/** The displayable column set across a set of items: the union of their keys minus
 *  the SKIP internals (matches the client's `inferKeys`), so a custom frontmatter
 *  column surfaces as a column. Insertion order preserved; null/absent values skip. */
function columnsFor(items) {
  const cols = [];
  const seen = new Set();
  for (const it of items) for (const k of Object.keys(it)) {
    if (!COLUMN_SKIP.has(k) && !seen.has(k) && it[k] != null) { seen.add(k); cols.push(k); }
  }
  return cols;
}

/** Structured one-line error → exit 1. JSON under --json (the daemon JSON.parses it). */
export function fail(log, msg, json = false) {
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

// ── gen: the per-module generation lineage ───────────────────────────────────────
// Canonical handlers for the `gen …` namespace. The `module <m> generations|diff|
// rollback` key-first forms (daemon-shelled + human muscle-memory) delegate to these
// as deprecating aliases — one source of truth for the generation reads/writes.

function genLog({ args, cwd, log }) {
  const rows = open(cwd).timeline({ module: args._[0] || '', limit: Number(args.limit) || 50 });
  log(toon('timeline', rows, ['at', 'module', 'gen', 'active', 'from']));
  return 0;
}
function genList({ args, cwd, log, json }) {
  const m = args._[0];
  if (!m) return fail(log, 'usage: zz gen list <module>', json);
  const g = open(cwd).generations(m);
  emit(log, json, { active: g.active, generations: g.generations ?? [] },
    ['generations', (g.generations ?? []).map((x) => ({ n: x.n, active: x.n === g.active, from: (x.mintedFrom || []).join('|') })), ['n', 'active', 'from']]);
  return 0;
}
function genDiff({ args, cwd, log, json }) {
  const [m, a, b] = args._;
  if (!m) return fail(log, 'usage: zz gen diff <module> <a> <b>', json);
  const r = open(cwd).diff(m, Number(a), Number(b));
  if (!r.ok) return fail(log, r.error || 'diff failed', json);
  emit(log, json, r.changes, ['diff', r.changes, ['status', 'id']]);
  return 0;
}
function genRollback({ args, cwd, log, json }) {
  const [m, n] = args._;
  if (!m) return fail(log, 'usage: zz gen rollback <module> <n>', json);
  const r = open(cwd).rollback(m, Number(n));
  if (!r.ok) return fail(log, r.error || 'rollback failed', json);
  emit(log, json, { module: m, rolledTo: Number(n), ok: true }, ['rollback', [{ module: m, generation: n }], ['module', 'generation']]);
  return 0;
}

// ── the table ──────────────────────────────────────────────────────────────────
// `plane` folds the FLAT (Tier-1) help; a multi-element `path` renders under its
// NAMESPACE heading. `json`/`permission`/`agentInvokable` record reality.

export const COMMANDS = [
  // ── setup ──
  {
    path: ['init'], plane: 'setup', json: true, permission: 'admin', agentInvokable: false,
    usage: 'init', summary: 'scaffold .zuzuu/ into this repo (git-citizen)',
    handler: ({ args, cwd, log, json }) => {
      const r = initHome(cwd);
      emit(log, json, { ok: true, home: r.home, created: r.created, skipped: r.skipped },
        ['init', [{ home: r.home, created: r.created.length, skipped: r.skipped.length }], ['home', 'created', 'skipped']]);
      if (r.created.length && !json) log(`created: ${r.created.join(', ')}`);
      return 0;
    },
  },

  // ── data: use the Project (read · run) ──
  {
    path: ['query'], plane: 'data', json: false, permission: 'read', agentInvokable: true,
    usage: 'query <module> [text]', summary: 'search  (--from walk · --to backlinks · --as-of <n> · --tag t · --full)',
    handler: ({ args, cwd, log }) => {
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
    },
  },
  {
    path: ['act'], plane: 'data', json: false, permission: 'run', agentInvokable: true,
    usage: 'act <module> <id> [--k v]', summary: 'run a runnable note',
    handler: ({ args, cwd, log }) => {
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
    },
  },
  {
    path: ['module'], plane: 'data', json: true, permission: 'read', agentInvokable: true,
    usage: 'module [list | overview | items <k> | item <k> <id> | schema <k>]',
    summary: 'inspect modules · notes  (generations → the `gen` namespace)',
    handler: ({ args, cwd, log, json, warn, rest }) => {
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
        // The module-as-table query: filter (--text/--type/--tag/--status/--where k=v) +
        // --sort + --limit/--offset all run in the index SELECT (searchRows composes
        // search+count), so filtering is NOT "fetch everything + filter in JS." Each match
        // is then hydrated to its FULL envelope off disk (the lossless source of truth), so
        // a custom column round-tripped on disk is no longer truncated — the data-loss-in-view.
        const opts = {
          module: b,
          text: args.text || '', type: args.type || '', tag: args.tag || '', status: args.status || '',
          where: whereFilters(rest), sort: parseSort(args.sort),
          limit: args.limit !== undefined ? Number(args.limit) : 10000,
          offset: Number(args.offset) || 0,
        };
        const { items: notes, total } = searchRows(zz.home, opts);
        const items = notes.map((note) => projectRow(note, b));
        // shape: { items, total, errors } + `kind` — the daemon's moduleEnvelopeItems passes
        // this straight through as the shared ModuleItem[] (`total` = the pre-paginate count,
        // so the grid paginates); CLI-absent degrades to peek.
        emit(log, json, { items, total, errors: [] }, ['items', items, columnsFor(items)]);
        return 0;
      }
      if (a === 'item') {
        if (!b || !c) return fail(log, 'usage: zz module item <key> <id>', json);
        // The full envelope, lossless: every frontmatter column rides through (incl.
        // custom ones and the `source` provenance pointer the record view's "born
        // here" link reads — no longer a special-cased off-disk lift).
        const [note] = readEnvelopes(zz.home, [`${b}:${c}`]);
        if (!note) return fail(log, `no note '${c}' in ${b}`, json);
        const item = projectRow(note, b);
        emit(log, json, item, ['item', [item], columnsFor([item])]);
        return 0;
      }
      if (a === 'schema') {
        if (!b) return fail(log, 'usage: zz module schema <key>', json);
        const mod = zz.modules().find((x) => x.id === b);
        const fields = Array.isArray(mod?.fields) ? mod.fields : [];  // U10 surfaces a module.md `fields` block here; absent ⇒ schemaless
        emit(log, json, { key: b, fields }, ['schema', fields, ['name', 'type']]);
        return 0;
      }

      // key-first: `list` stays; generations|diff|rollback are now DEPRECATING ALIASES
      // for the `gen` namespace (emit one stderr note, delegate to the gen handler).
      // The module-literally-named-`generations` resolution is preserved: action is
      // args._[1], so `module generations generations` still lists that module's lineage.
      const [m, action, n] = args._;
      if (!m || m === 'list') {
        const rows = zz.modules().map((x) => ({ id: x.id, type: x.note_type ?? '', capabilities: (x.capabilities || []).join('|') }));
        emit(log, json, rows, ['modules', rows, ['id', 'type', 'capabilities']]);
        return 0;
      }
      if (action === 'generations') {
        warn?.(`zz: 'module <m> generations' is deprecated — use 'gen list <m>'`);
        return genList({ args: { ...args, _: [m] }, cwd, log, json });
      }
      if (action === 'rollback') {
        warn?.(`zz: 'module <m> rollback <n>' is deprecated — use 'gen rollback <m> <n>'`);
        return genRollback({ args: { ...args, _: [m, n] }, cwd, log, json });
      }
      if (action === 'diff') {
        warn?.(`zz: 'module <m> diff <a> <b>' is deprecated — use 'gen diff <m> <a> <b>'`);
        return genDiff({ args: { ...args, _: [m, n, args._[3]] }, cwd, log, json });
      }
      return fail(log, 'usage: zz module [list | overview | items <k> | item <k> <id> | schema <k>]', json);
    },
  },

  // ── module: ALTER TABLE on a module's typed-column schema (operator-gated) ──
  // These mutate `module.md`'s `fields` + mint a generation (rollback-able). They
  // bypass `commit()` deliberately — a manifest write is operator-initiated, the gate
  // itself. `module schema <k>` (the READ) stays inside the `module` handler above.
  {
    path: ['module', 'add-column'], plane: 'data', json: true, permission: 'admin', agentInvokable: false,
    usage: 'module add-column <k> <name> <type> [--required] [--options a,b]', summary: 'add a typed column to a module schema',
    handler: ({ args, cwd, log, json }) => {
      const [m, name, type] = args._;
      if (!m || !name || !type) return fail(log, 'usage: zz module add-column <key> <name> <type> [--required] [--options a,b]', json);
      const opts = { required: !!args.required, options: args.options ? String(args.options).split(',').map((s) => s.trim()).filter(Boolean) : null };
      const r = open(cwd).addColumn(m, name, type, opts);
      if (!r.ok) return fail(log, r.error, json);
      emit(log, json, { key: m, fields: r.fields, generation: r.generation }, ['schema', r.fields, ['name', 'type', 'required']]);
      return 0;
    },
  },
  {
    path: ['module', 'alter-column'], plane: 'data', json: true, permission: 'admin', agentInvokable: false,
    usage: 'module alter-column <k> <name> [--type t] [--required] [--options a,b]', summary: 'change a column (type · required · options)',
    handler: ({ args, cwd, log, json }) => {
      const [m, name] = args._;
      if (!m || !name) return fail(log, 'usage: zz module alter-column <key> <name> [--type <t>] [--required] [--options a,b]', json);
      const opts = {};
      if (args.type) opts.type = String(args.type);
      if (args.required !== undefined) opts.required = !!args.required;
      if (args.options !== undefined) opts.options = String(args.options).split(',').map((s) => s.trim()).filter(Boolean);
      const r = open(cwd).alterColumn(m, name, opts);
      if (!r.ok) return fail(log, r.error, json);
      emit(log, json, { key: m, fields: r.fields, generation: r.generation }, ['schema', r.fields, ['name', 'type', 'required']]);
      return 0;
    },
  },
  {
    path: ['module', 'drop-column'], plane: 'data', json: true, permission: 'admin', agentInvokable: false,
    usage: 'module drop-column <k> <name>', summary: 'drop a column from a module schema',
    handler: ({ args, cwd, log, json }) => {
      const [m, name] = args._;
      if (!m || !name) return fail(log, 'usage: zz module drop-column <key> <name>', json);
      const r = open(cwd).dropColumn(m, name);
      if (!r.ok) return fail(log, r.error, json);
      emit(log, json, { key: m, fields: r.fields, generation: r.generation }, ['schema', r.fields, ['name', 'type', 'required']]);
      return 0;
    },
  },

  // ── note: edit notes (gated writes) — the Tier-2 `note …` namespace ──
  {
    path: ['note', 'view'], plane: 'data', json: false, permission: 'read', agentInvokable: true,
    usage: 'note view <m> <id>', summary: 'read a note body windowed (--offset n · --limit n)',
    handler: ({ args, cwd, log }) => {
      const [m, id] = args._;
      if (!m || !id) return fail(log, 'usage: zz note view <module> <id> [--offset n] [--limit n]');
      const r = open(cwd).view(m, id, { offset: Number(args.offset) || 0, limit: Number(args.limit) || 0 });
      if (!r.ok) return fail(log, r.error);
      log(toon('view', [{ addr: r.addr, title: r.title ?? '', lines: r.total, shown: `${r.offset}–${r.offset + r.shown}${r.partial ? ' (PARTIAL)' : ''}` }], ['addr', 'title', 'lines', 'shown']));
      if (r.body) log(r.body);
      return 0;
    },
  },
  {
    path: ['note', 'flow'], plane: 'data', json: false, permission: 'run', agentInvokable: true,
    usage: 'note flow <m> <id>', summary: 'run a workflow note (a DAG of gated run-steps)',
    handler: ({ args, cwd, log }) => {
      const [m, id] = args._;
      if (!m || !id) return fail(log, 'usage: zz note flow <module> <id>');
      const { _: _d, ...inputs } = args;
      const r = open(cwd).flow(m, id, inputs);
      if (!r.ok && !r.steps) return fail(log, r.error);
      log(toon('flow', r.steps, ['id', 'success', 'exitCode']));
      if (!r.ok) { log(`✗ failed at step '${r.failedStep}'${r.compensations?.length ? ` — compensated ${r.compensations.length} step(s)` : ''}`); return 1; }
      return 0;
    },
  },
  {
    path: ['note', 'set'], plane: 'data', json: false, permission: 'write', agentInvokable: false,
    usage: 'note set <m> <id> <key> <v>', summary: 'set one frontmatter field',
    handler: ({ args, cwd, log }) => {
      const [m, id, key, ...rest] = args._;
      if (!m || !id || !key || !rest.length) return fail(log, 'usage: zz note set <module> <id> <key> <value>');
      const r = open(cwd).patch(m, id, key, rest.join(' '));
      if (!r.ok) return fail(log, r.error);
      log(`patched ${m}:${id} ${key}`);
      return 0;
    },
  },
  {
    path: ['note', 'append'], plane: 'data', json: false, permission: 'write', agentInvokable: false,
    usage: 'note append <m> <id> <text>', summary: 'append text to a note body',
    handler: ({ args, cwd, log }) => {
      const [m, id, ...rest] = args._;
      if (!m || !id || !rest.length) return fail(log, 'usage: zz note append <module> <id> <text>');
      const r = open(cwd).append(m, id, rest.join(' '));
      if (!r.ok) return fail(log, r.error);
      log(`appended to ${m}:${id}`);
      return 0;
    },
  },
  {
    path: ['note', 'rename'], plane: 'data', json: false, permission: 'write', agentInvokable: false,
    usage: 'note rename <m> <old> <new>', summary: 'rename a note + rewrite every inbound link',
    handler: ({ args, cwd, log }) => {
      const [m, oldId, newId] = args._;
      if (!m || !oldId || !newId) return fail(log, 'usage: zz note rename <module> <old-id> <new-id>');
      const r = open(cwd).rename(m, oldId, newId);
      if (!r.ok) return fail(log, r.error);
      log(`renamed ${r.renamed} — ${r.refs} referrer(s) updated, ${r.generations.length} generation(s)`);
      return 0;
    },
  },
  {
    path: ['note', 'fold'], plane: 'data', json: false, permission: 'write', agentInvokable: false,
    usage: 'note fold <m> <src> <dst>', summary: 'fold two notes into one (re-point referrers to dst)',
    handler: ({ args, cwd, log }) => {
      const [m, src, dst] = args._;
      if (!m || !src || !dst) return fail(log, 'usage: zz note fold <module> <src-id> <dst-id>');
      const r = open(cwd).merge(m, src, dst);
      if (!r.ok) return fail(log, r.error);
      log(`merged ${r.merged} — ${r.refs} referrer(s) re-pointed`);
      return 0;
    },
  },
  {
    path: ['note', 'retype'], plane: 'data', json: false, permission: 'write', agentInvokable: false,
    usage: 'note retype <m> --field k --from v --to v', summary: 'rewrite a field across the module',
    handler: ({ args, cwd, log }) => {
      const [m] = args._;
      if (!m || !args.field || args.from === undefined || args.to === undefined) return fail(log, 'usage: zz note retype <module> --field <key> --from <v> --to <v>');
      const r = open(cwd).refactor(m, args.field, args.from, args.to);
      if (!r.ok) return fail(log, r.error);
      log(`refactored ${m}.${r.field} — ${r.changed} note(s) rewritten`);
      return 0;
    },
  },

  // ── evolution: grow the Project (observe → propose → review → evolve) ──
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
    usage: 'stage <m> --op create|update --target <id> --field k=v', summary: 'stage a change (a pending proposal)',
    handler: ({ args, cwd, log, json, rest }) => {
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
    },
  },
  {
    path: ['review'], plane: 'evolution', json: true, permission: 'gate', agentInvokable: false,
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
    },
  },

  // ── gen: the per-module generation lineage — the Tier-2 `gen …` namespace ──
  {
    path: ['gen', 'log'], plane: 'evolution', json: false, permission: 'read', agentInvokable: true,
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

  // ── inspection: integrity · health · porcelain ──
  {
    path: ['check'], plane: 'inspection', json: false, permission: 'read', agentInvokable: true,
    usage: 'check [module]', summary: 'integrity — broken links · orphans · stale',
    handler: ({ args, cwd, log }) => {
      const zz = open(cwd);
      const mods = args._[0] ? [args._[0]] : zz.modules().map((m) => m.id);
      const rows = [];
      for (const m of mods) {
        const r = zz.check(m);
        if (!r.ok) continue;
        const v = r.value;
        // check is project-wide; scope `ungated` to this module's notes for an accurate column.
        const ungated = (v.ungated ?? []).filter((u) => u.addr.startsWith(`${m}:`)).length;
        rows.push({ module: m, broken: v.broken.length, orphans: v.orphans.length, stale: v.stale.length, ungated });
      }
      log(toon('integrity', rows, ['module', 'broken', 'orphans', 'stale', 'ungated']));
      return 0;
    },
  },
  {
    path: ['validate'], plane: 'inspection', json: false, permission: 'read', agentInvokable: true,
    usage: 'validate [module]', summary: 'schema-check every note (type-keyed invariants)',
    handler: ({ args, cwd, log }) => {
      const bad = open(cwd).validate(args._[0] || '');
      if (!bad.length) { log('all notes valid'); return 0; }
      log(toon('invalid', bad.map((b) => ({ addr: b.addr, errors: b.errors.join('; ') })), ['addr', 'errors']));
      return 1;
    },
  },
  {
    path: ['doctor'], plane: 'inspection', json: false, permission: 'read', agentInvokable: true,
    usage: 'doctor', summary: 'health check',
    handler: ({ cwd, log }) => doctor(cwd, log),
  },
  {
    path: ['status'], plane: 'inspection', json: false, permission: 'read', agentInvokable: true,
    usage: 'status', summary: 'inventory',
    handler: ({ cwd, log }) => status(cwd, log),
  },
  {
    path: ['explain'], plane: 'inspection', json: false, permission: 'read', agentInvokable: true,
    usage: 'explain [topic]', summary: 'porcelain — explain a concept',
    handler: ({ args, log }) => explain(args._[0], log),
  },

  // ── session: the per-session git surface ──
  {
    path: ['session'], plane: 'session', json: true, permission: 'admin', agentInvokable: false,
    usage: 'session [status | land | hold | resume | drop | worktree … | label]',
    summary: 'inspect & steer the per-session git substrate',
    handler: ({ args, cwd, log, warn }) => sessionCommand(args, cwd, log, warn),
  },
  {
    path: ['session', 'land'], plane: 'session', json: true, permission: 'admin', agentInvokable: false,
    usage: 'session land [id]', summary: 'land a session — squash-merge (auto-detects worktree vs in-place)',
    handler: ({ args, cwd, log, warn }) => sessionCommand({ ...args, _: ['land', ...args._] }, cwd, log, warn),
  },
  {
    path: ['session', 'hold'], plane: 'session', json: true, permission: 'admin', agentInvokable: false,
    usage: 'session hold [id]', summary: 'hold a session for the merge gate (auto-detects worktree)',
    handler: ({ args, cwd, log, warn }) => sessionCommand({ ...args, _: ['hold', ...args._] }, cwd, log, warn),
  },
  {
    path: ['session', 'resume'], plane: 'session', json: true, permission: 'admin', agentInvokable: false,
    usage: 'session resume [id]', summary: 'resume a held session (back onto its branch)',
    handler: ({ args, cwd, log, warn }) => sessionCommand({ ...args, _: ['resume', ...args._] }, cwd, log, warn),
  },
  {
    path: ['session', 'drop'], plane: 'session', json: true, permission: 'admin', agentInvokable: false,
    usage: 'session drop [id] --yes', summary: 'drop a session — DELETE its branch + checkpoints',
    handler: ({ args, cwd, log, warn }) => sessionCommand({ ...args, _: ['drop', ...args._] }, cwd, log, warn),
  },

  // ── registry: the project registry ──
  {
    path: ['registry'], plane: 'registry', json: true, permission: 'admin', agentInvokable: false,
    usage: 'registry [ensure [<path>…] | init | add <path> | sync | status]',
    summary: 'the project registry (1:N tree of tracked repos)',
    handler: ({ args, cwd, log }) => registryCommand(args, cwd, log),
  },
  {
    path: ['registry', 'subscribe'], plane: 'registry', json: true, permission: 'write', agentInvokable: false,
    usage: 'registry subscribe <module>', summary: 'subscribe to a published module (stages its notes)',
    handler: ({ args, cwd, log, json }) => {
      const m = args._[0];
      if (!m) return fail(log, 'usage: zz registry subscribe <module>', json);
      try {
        const r = open(cwd).registry.subscribe(m);
        if (!r.ok) return fail(log, r.error, json);
        emit(log, json, r, ['subscribe', [{ module: r.module, staged: r.staged }], ['module', 'staged']]);
        return 0;
      } catch (e) { return fail(log, e.message, json); }
    },
  },

  // ── steer: the session-start/close briefs ──
  {
    path: ['digest'], plane: 'steer', json: false, permission: 'read', agentInvokable: true,
    usage: 'digest', summary: 'the session-start brief (agent-facing)',
    handler: ({ cwd, log }) => {
      const text = digestText(cwd);
      log(text || '(empty Project — run `zz init`)');
      return 0;
    },
  },
  {
    path: ['start'], plane: 'steer', json: false, permission: 'read', agentInvokable: true,
    usage: 'start', summary: 'the recommended session opener (paste as your first message)',
    handler: ({ cwd, log }) => {
      log(openerText(cwd) || '(no Project — run `zz init`)');
      return 0;
    },
  },
  {
    path: ['wrap'], plane: 'steer', json: false, permission: 'read', agentInvokable: true,
    usage: 'wrap [--note <text>]', summary: 'the recommended session closer; --note saves a handoff',
    handler: ({ args, cwd, log }) => {
      if (args.note) writeHandoff(open(cwd).home, args.note);
      log(closerText(cwd) || '(no Project — run `zz init`)');
      if (args.note) log('\n(handoff saved — `zz start` will surface it next session)');
      return 0;
    },
  },
  {
    path: ['steer'], plane: 'steer', json: false, permission: 'read', agentInvokable: true,
    usage: 'steer [--park <item>]', summary: 'stay on scope: drift signals · parking lot · guidance to pin',
    handler: ({ args, cwd, log }) => {
      const home = open(cwd).home;
      if (args.clear) { clearParking(home); log('parking lot cleared'); return 0; }
      if (args.park) { parkItem(home, args.park); log(`parked: ${args.park}`); return 0; }
      log(steerText(cwd));
      return 0;
    },
  },

  // ── host: launch / lifecycle — the Tier-2 `host …` namespace ──
  {
    path: ['host', 'enable'], plane: 'host', json: true, permission: 'admin', agentInvokable: false,
    usage: 'host enable', summary: 'install the lifecycle + guardrails hooks',
    handler: ({ cwd, log, json }) => {
      const r = enable(cwd);
      emit(log, json, { ok: true, path: r.path, installed: r.installed },
        ['enable', [{ path: r.path, installed: r.installed }], ['path', 'installed']]);
      return 0;
    },
  },
  {
    path: ['host', 'disable'], plane: 'host', json: true, permission: 'admin', agentInvokable: false,
    usage: 'host disable', summary: 'remove the lifecycle + guardrails hooks',
    handler: ({ cwd, log, json }) => {
      const r = disable(cwd);
      emit(log, json, { ok: true, path: r.path, removed: r.removed },
        ['disable', [{ path: r.path, removed: r.removed }], ['path', 'removed']]);
      return 0;
    },
  },
  {
    path: ['host', 'code'], plane: 'host', json: false, permission: 'run', agentInvokable: false,
    usage: 'host code [dir]', summary: 'launch OpenCode (the bundled host)',
    handler: ({ args, log }) => code({ ...args, _: args._ }, { log }),
  },
  {
    path: ['host', 'web'], plane: 'host', json: false, permission: 'run', agentInvokable: false,
    usage: 'host web', summary: 'launch the workbench',
    handler: ({ args }) => web({ ...args, _: args._ }) ?? 0,
  },
  {
    path: ['hook'], plane: 'host', json: false, permission: 'gate', agentInvokable: true,
    usage: 'hook <Event>', summary: 'the host lifecycle callback (internal — reads stdin, always exits 0)',
    handler: ({ args, cwd }) => {
      // the host lifecycle callback — reads stdin, always exits 0 (own process)
      runHook(args._[0], { host: args.host || 'claude-code', session: args.session, cwd });
      return 0; // unreachable (runHook exits), but keeps the router total
    },
  },

  // ── back-compat aliases ─────────────────────────────────────────────────────
  // Each maps an OLD flat verb to its canonical Tier-2 path. The router emits ONE
  // stderr deprecation note, then dispatches the canonical handler with the SAME ctx
  // — data, not 20 wrappers. Excluded from `zz help` (they don't clutter the surface).
  ...[
    [['merge'], ['note', 'fold']],
    [['patch'], ['note', 'set']],
    [['append'], ['note', 'append']],
    [['rename'], ['note', 'rename']],
    [['refactor'], ['note', 'retype']],
    [['view'], ['note', 'view']],
    [['flow'], ['note', 'flow']],
    [['log'], ['gen', 'log']],
    [['enable'], ['host', 'enable']],
    [['disable'], ['host', 'disable']],
    // `hook` stays FLAT + canonical — it's the machine lifecycle callback `enable`
    // installs, fired on EVERY tool event; a deprecation here would be hot-path noise.
    // `host hook` is the cold alias (namespace discoverability), never the hot path.
    [['host', 'hook'], ['hook']],
    [['code'], ['host', 'code']],
    [['web'], ['host', 'web']],
    [['subscribe'], ['registry', 'subscribe']],
  ].map(([path, alias]) => ({ path, alias })),
];

// ── help: fold the table by plane (Tier-1) then by namespace (Tier-2) ────────────
// The single rendering of the table — every NON-ALIAS row appears exactly once, so
// help cannot omit a command the router can reach. Flat verbs fold under their plane;
// namespaced verbs (a multi-element path) group under their noun heading. Aliases are
// deliberately absent (they're back-compat, not surface).

const PLANE_ORDER = ['setup', 'data', 'evolution', 'inspection', 'session', 'registry', 'steer', 'host'];
const PLANE_LABEL = {
  setup: 'setup', data: 'use the Project', evolution: 'grow the Project (the loop)',
  inspection: 'inspect', session: 'sessions', registry: 'registry',
  steer: 'session briefs', host: 'hosts',
};
const NS_ORDER = ['module', 'note', 'gen', 'session', 'host', 'registry'];
const NS_LABEL = {
  module: 'module — alter a typed-column schema (operator-gated)',
  note: 'note — edit notes (gated writes)',
  gen: 'gen — generations (the lineage)',
  session: 'session — the per-session git surface',
  host: 'host — launch & lifecycle',
  registry: 'registry — published modules',
};

/** Build `zz help` from the command table (replaces the hand-maintained const).
 *  The usage column aligns to the widest *short* usage (capped — a few rich
 *  signatures like `module [...]` overflow the column and carry their summary
 *  two spaces along, never stretching every other row to match). */
export function helpText() {
  const visible = COMMANDS.filter((c) => !c.alias);
  const flat = visible.filter((c) => c.path.length === 1);
  const namespaced = visible.filter((c) => c.path.length > 1);
  const CAP = 42;
  const pad = Math.min(CAP, Math.max(...visible.map((c) => (c.usage.length <= CAP ? c.usage.length : 0))));
  const order = (p) => { const i = PLANE_ORDER.indexOf(p); return i === -1 ? PLANE_ORDER.length : i; };
  const planes = [...new Set(flat.map((c) => c.plane))].sort((a, b) => order(a) - order(b));
  const lines = ["zz — your repo's Project (envelopes, queried/run/grown, human-gated)"];
  for (const plane of planes) {
    const rows = flat.filter((c) => c.plane === plane);
    if (!rows.length) continue;
    lines.push('', `  ${PLANE_LABEL[plane] ?? plane}`);
    for (const c of rows) lines.push(`  zz ${c.usage.padEnd(pad)}  ${c.summary}`);
  }
  // the Tier-2 noun namespaces, grouped by their leading token
  const nsOrder = (n) => { const i = NS_ORDER.indexOf(n); return i === -1 ? NS_ORDER.length : i; };
  const namespaces = [...new Set(namespaced.map((c) => c.path[0]))].sort((a, b) => nsOrder(a) - nsOrder(b));
  for (const ns of namespaces) {
    lines.push('', `  ${NS_LABEL[ns] ?? ns}`);
    for (const c of namespaced.filter((c) => c.path[0] === ns)) lines.push(`  zz ${c.usage.padEnd(pad)}  ${c.summary}`);
  }
  return lines.join('\n');
}
