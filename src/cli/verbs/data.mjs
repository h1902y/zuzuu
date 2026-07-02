// src/cli/verbs/data.mjs — the `data` plane: use the Project (read · run · edit).
// query/graph/act, the module-as-table reads + ALTER TABLE + lifecycle + the
// import/export boundary, and the `note` namespace (reads, the operator lane's
// direct CRUD, the scoped/graph-safe edits). Composed into THE table by
// ../commands.mjs — the one-table invariant lives there.

import { readFileSync } from 'node:fs';
import { open } from '../../serve/api.mjs';
import { toon } from '../../notes/toon.mjs';
import { searchRows, readEnvelopes } from '../../notes/rows.mjs';
import { moduleCounts, aggregate, search as idxSearch } from '../../notes/index.mjs';
import { coerceForField } from '../../grow/edit.mjs';
import { graphData } from '../../serve/graph.mjs';
import { exportRows, toCsv, parseCsv } from '../../use/table.mjs';
import { fail, emit, str, list, parseWhere, whereFilters, fieldPairs, parseSort, projectRow, columnsFor } from '../args.mjs';
import { genList, genDiff, genRollback } from './evolution.mjs';

// `module new <id>` / `module enable|disable <id>` — the module-lifecycle writes (manifest
// create + the enabled toggle). Operator-gated like the schema alter-table ops.
function moduleNew({ args, cwd, log, json }) {
  const id = args._[0];
  if (!id) return fail(log, 'usage: zz module new <id> [--title t --tagline t --capabilities a,b --kinds k --required a,b]', json);
  const r = open(cwd).moduleNew(id, { title: str(args.title), tagline: str(args.tagline), capabilities: list(args.capabilities), kinds: list(args.kinds), required: list(args.required) });
  if (!r.ok) return fail(log, r.error, json);
  emit(log, json, { ok: true, id: r.id }, ['module', [{ id: r.id }], ['id']]);
  return 0;
}
function moduleToggle(enabled) {
  return ({ args, cwd, log, json }) => {
    const id = args._[0];
    if (!id) return fail(log, `usage: zz module ${enabled ? 'enable' : 'disable'} <id>`, json);
    const r = open(cwd).moduleSetEnabled(id, enabled);
    if (!r.ok) return fail(log, r.error, json);
    emit(log, json, { ok: true, id, enabled }, ['module', [{ id, enabled }], ['id', 'enabled']]);
    return 0;
  };
}

export const dataRows = [
  {
    path: ['query'], plane: 'data', json: true, permission: 'read', agentInvokable: true,
    usage: 'query <module|--all> [text]', summary: 'search  (--all cross-module · --where k<op>v · --group-by k [--agg fn:field] · --view m:id · --from walk · --to backlinks · --as-of <n> · --tag t · --full)',
    handler: ({ args, cwd, log, json, rest }) => {
      const zz = open(cwd);
      // `--all` searches the WHOLE project (module = '' — the index's plan() already
      // supports it; only the verb's surface forced a per-module loop). The flag
      // parser eats the next word as the flag's VALUE (`--all vedanta` → all:'vedanta')
      // — that word is search text, so put it back.
      const all = !!args.all;
      let module = all ? '' : args._[0];
      const words = all
        ? [...(args.all !== true ? [String(args.all)] : []), ...args._]
        : args._.slice(1);
      // `--view <module:id>`: a SAVED VIEW — a note whose `query` map carries the
      // params (module/text/type/tag/status/where/group-by/agg/sort/limit). The
      // view is data, so it's gate-governed and versioned like any other row.
      let viewQ = null;
      if (args.view && args.view !== true) {
        const [vm, vid] = String(args.view).includes(':') ? String(args.view).split(':') : [module, String(args.view)];
        if (!vm || !vid) return fail(log, '--view needs <module:id>', json);
        const [note] = readEnvelopes(zz.home, [`${vm}:${vid}`]);
        if (!note) return fail(log, `no view note '${vm}:${vid}'`, json);
        viewQ = note.query && typeof note.query === 'object' ? note.query : {};
        if (typeof viewQ.module === 'string') module = viewQ.module;
      }
      if (!module && !all && !viewQ) return fail(log, 'usage: zz query <module> [text]  ·  zz query --all [text]  ·  zz query --view <m:id>', json);
      if (args['as-of'] !== undefined) {
        const r = zz.asOf(module, Number(args['as-of']));
        if (!r.ok) return fail(log, r.error, json);
        emit(log, json, { generation: r.generation, notes: r.notes }, [`notes@gen${r.generation}`, r.notes, ['addr', 'type', 'title', 'status']]);
        return 0;
      }
      // a view's saved where entries are `"key<op>value"` strings (or {key,op,value})
      const viewWhere = (Array.isArray(viewQ?.where) ? viewQ.where : [])
        .map((w) => (typeof w === 'string' ? parseWhere(w) : w)).filter(Boolean);
      const groupBy = str(args['group-by']) || viewQ?.['group-by'] || '';
      const aggRaw = str(args.agg) || viewQ?.agg || '';
      const opts = {
        text: words.join(' ') || viewQ?.text || '',
        type: str(args.type) || viewQ?.type || '',
        tag: args.tag || viewQ?.tag || '',
        status: str(args.status) || viewQ?.status || '',
        where: [...viewWhere, ...whereFilters(rest)],
        full: !!args.full, depth: Number(args.depth) || 0,
        from: args.from || '', to: args.to || '',
        // an EXPLICIT `--limit 0` means 0 — `Number(x) || 50` silently turned it into 50,
        // re-breaking the fix the index layer already made.
        limit: args.limit !== undefined ? Number(args.limit) : (viewQ?.limit ?? 50),
        dryRun: !!args['dry-run'],
      };
      // rollups: --group-by <key> [--agg count|sum:field|avg:field|min:field|max:field]
      if (groupBy) {
        const [fn, field] = aggRaw ? aggRaw.split(':') : ['count'];
        const rows = aggregate(zz.home, {
          groupBy, agg: { fn: fn || 'count', field }, module,
          text: opts.text, type: opts.type, tag: opts.tag, status: opts.status, where: opts.where,
        });
        emit(log, json, { kind: 'aggregate', groupBy, rows },
          [`by ${groupBy}`, rows, rows.some((r) => r.agg != null) ? ['value', 'n', 'agg'] : ['value', 'n']]);
        return 0;
      }
      const r = zz.query(module, opts);
      if (!r.ok) return fail(log, r.error, json);
      const v = r.value;
      if (json) { log(JSON.stringify(v)); return 0; }
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
    path: ['graph'], plane: 'data', json: true, permission: 'read', agentInvokable: true,
    usage: 'graph [--props a,b]', summary: 'the whole project as nodes + links (the map surface reads this)',
    io: { params: [], flags: { props: '--props' } }, // catalog: the daemon shells `graph --props …`
    handler: ({ args, cwd, log, json }) => {
      const g = graphData(open(cwd).home, { props: list(args.props) });
      if (json) { log(JSON.stringify(g)); return 0; }
      log(toon('graph', [{ nodes: g.nodes.length, links: g.links.length }], ['nodes', 'links'], ['zz graph --json for the document']));
      return 0;
    },
  },
  {
    path: ['act'], plane: 'data', json: false, permission: 'run', agentInvokable: true,
    usage: 'act <module> <id> [--k v]', summary: 'run a runnable note',
    io: { params: ['module', 'id'], flags: {} }, // catalog: the daemon shells `act <verb> <slug>`
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
        // counts come from ONE GROUP BY (moduleCounts) — the old per-module
        // `query limit 10000 → .length` was M index opens + M row materializations
        // for numbers one query already had (the digest fast path, reused).
        // `top` (3 titles per module, the dashboard tiles) rides ONE brief
        // cross-module search — never an open per module.
        const counts = moduleCounts(zz.home);
        const topOf = {};
        for (const n of idxSearch(zz.home, { limit: 100000 })) {
          const m = n.addr.slice(0, n.addr.indexOf(':'));
          (topOf[m] ??= []).length < 3 && topOf[m].push(n.title || n.addr.slice(n.addr.indexOf(':') + 1));
        }
        const rows = zz.modules().map((mod) => ({
          key: mod.id, title: mod.title ?? mod.id, note_type: mod.note_type ?? '',
          enabled: mod.enabled !== false,
          items: counts[mod.id] ?? 0,
          pending: zz.staged(mod.id).length, capabilities: mod.capabilities ?? [],
          top: topOf[mod.id] ?? [],
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
    usage: 'module add-column <k> <name> <type> [--required] [--options a,b] [--default v] [--label l]', summary: 'add a typed column to a module schema',
    handler: ({ args, cwd, log, json }) => {
      const [m, name, type] = args._;
      if (!m || !name || !type) return fail(log, 'usage: zz module add-column <key> <name> <type> [--required] [--options a,b] [--default v] [--label l]', json);
      const opts = {
        required: !!args.required,
        options: args.options ? list(args.options) : null,
        def: args.default !== undefined && args.default !== true ? args.default : undefined,
        label: str(args.label) || null,
        computed: str(args.computed) || null,
      };
      const r = open(cwd).addColumn(m, name, type, opts);
      if (!r.ok) return fail(log, r.error, json);
      emit(log, json, { key: m, fields: r.fields, generation: r.generation }, ['schema', r.fields, ['name', 'type', 'required']]);
      return 0;
    },
  },
  {
    path: ['module', 'alter-column'], plane: 'data', json: true, permission: 'admin', agentInvokable: false,
    usage: 'module alter-column <k> <name> [--type t] [--required] [--options a,b] [--default v] [--label l]', summary: 'change a column (type · required · options · default · label)',
    handler: ({ args, cwd, log, json }) => {
      const [m, name] = args._;
      if (!m || !name) return fail(log, 'usage: zz module alter-column <key> <name> [--type <t>] [--required] [--options a,b] [--default v] [--label l]', json);
      const opts = {};
      if (args.type) opts.type = String(args.type);
      if (args.required !== undefined) opts.required = !!args.required;
      if (args.options !== undefined) opts.options = list(args.options);
      if (args.default !== undefined && args.default !== true) opts.def = args.default;
      if (args.label !== undefined) opts.label = str(args.label) || null;
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

  // ── module: create + enable/disable (the lifecycle writes the workbench shells) ──
  {
    path: ['module', 'new'], plane: 'data', json: true, permission: 'admin', agentInvokable: false,
    usage: 'module new <id> [--title t --tagline t --capabilities a,b --kinds k --required a,b]',
    summary: 'create a new module manifest', handler: moduleNew,
    io: { params: ['id'], flags: { title: '--title', tagline: '--tagline', capabilities: '--capabilities', kinds: '--kinds', required: '--required' } },
  },
  {
    path: ['module', 'enable'], plane: 'data', json: true, permission: 'admin', agentInvokable: false,
    usage: 'module enable <id>', summary: "set a module's enabled flag on", handler: moduleToggle(true),
    io: { params: ['key'], flags: {} },
  },
  {
    path: ['module', 'disable'], plane: 'data', json: true, permission: 'admin', agentInvokable: false,
    usage: 'module disable <id>', summary: "set a module's enabled flag off", handler: moduleToggle(false),
    io: { params: ['key'], flags: {} },
  },

  // ── note: edit notes (gated writes) — the Tier-2 `note …` namespace ──
  {
    path: ['note', 'view'], plane: 'data', json: true, permission: 'read', agentInvokable: true,
    usage: 'note view <m> <id>', summary: 'read a note body windowed (--offset n · --limit n)',
    handler: ({ args, cwd, log, json }) => {
      const [m, id] = args._;
      if (!m || !id) return fail(log, 'usage: zz note view <module> <id> [--offset n] [--limit n]', json);
      const r = open(cwd).view(m, id, { offset: Number(args.offset) || 0, limit: Number(args.limit) || 0 });
      if (!r.ok) return fail(log, r.error, json);
      if (json) { log(JSON.stringify(r)); return 0; }
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
    // the module-as-table boundary, outbound: every row, lossless (custom columns ride)
    path: ['module', 'export'], plane: 'data', json: true, permission: 'read', agentInvokable: true,
    usage: 'module export <k> [--csv]', summary: 'dump a module as rows (JSON default · --csv for spreadsheets)',
    handler: ({ args, cwd, log, json }) => {
      const m = args._[0];
      if (!m) return fail(log, 'usage: zz module export <key> [--csv]', json);
      const rows = exportRows(open(cwd).home, m);
      if (args.csv) { log(toCsv(rows).trimEnd()); return 0; }
      log(JSON.stringify(rows));
      return 0;
    },
  },
  {
    // inbound: bulk rows through the operator lane's batch create — ONE transaction,
    // ONE generation, all-or-nothing, schema-validated. Operator-only (agent-denied).
    path: ['module', 'import'], plane: 'data', json: true, permission: 'write', agentInvokable: false,
    usage: 'module import <k> --json <file> | --csv <file> [--force]', summary: 'bulk-create rows from a JSON array or CSV (one generation)',
    handler: ({ args, cwd, log, json }) => {
      const m = args._[0];
      const file = str(args.json) || str(args.csv);
      if (!m || !file) return fail(log, 'usage: zz module import <key> --json <file> | --csv <file> [--force]', json);
      let text;
      try { text = readFileSync(file, 'utf8'); } catch { return fail(log, `cannot read ${file}`, json); }
      let rows;
      if (args.csv) rows = parseCsv(text);
      else { try { rows = JSON.parse(text); } catch { return fail(log, 'invalid JSON (expected an array of rows)', json); } }
      const zz = open(cwd);
      const r = zz.createMany(m, rows, { force: !!args.force });
      if (!r.ok) return fail(log, r.error, json);
      emit(log, json, { ok: true, created: r.created.length, ids: r.created },
        ['imported', [{ module: m, rows: r.created.length }], ['module', 'rows']]);
      return 0;
    },
  },
  {
    // THE OPERATOR LANE: direct row create — instant CRUD for the human building
    // their own app. Still lands through commit() (validated + logged + minted);
    // agentInvokable:false keeps the agent on its stage→review channel.
    path: ['note', 'create'], plane: 'data', json: true, permission: 'write', agentInvokable: false,
    usage: 'note create <m> <id> --type t [--field k=v …] [--body text] [--force] · note create <m> --batch <json>',
    summary: 'create a row directly (schema defaults fill in; --force = upsert; --batch = many rows, one generation)',
    io: { params: ['module', 'id'], flags: { type: '--type', change: '--change', force: '--force' } }, // catalog: the daemon's direct-create lane
    handler: ({ args, cwd, log, json, rest }) => {
      const zz = open(cwd);
      const [m, id] = args._;
      if (!m) return fail(log, 'usage: zz note create <module> <id> --type t [--field k=v …] [--body text] [--force]', json);
      // batch path: --batch '<json array of {id, type, …fields}>' — one commit, one generation
      if (args.batch) {
        let rows;
        try { rows = JSON.parse(args.batch); } catch { return fail(log, 'invalid --batch JSON', json); }
        const r = zz.createMany(m, rows, { force: !!args.force });
        if (!r.ok) return fail(log, r.error, json);
        emit(log, json, { ok: true, created: r.created, generations: r.generations },
          ['created', r.created.map((x) => ({ id: x })), ['id']]);
        return 0;
      }
      if (!id) return fail(log, 'usage: zz note create <module> <id> --type t [--field k=v …]', json);
      // change body: --change <json> (machine) OR --field k=v repeated (human sugar;
      // values coerce schema-aware) + --type/--body conveniences.
      let change = {};
      if (args.change) { try { change = JSON.parse(args.change); } catch { return fail(log, 'invalid --change JSON', json); } }
      else change = fieldPairs(rest, (k, v) => coerceForField(zz.home, m, k, v));
      if (args.type && args.type !== true) change.type = String(args.type);
      if (args.body && args.body !== true) change.body = String(args.body);
      const r = zz.create(m, id, change, { force: !!args.force });
      if (!r.ok) return fail(log, r.error, json);
      emit(log, json, { ok: true, addr: `${m}:${id}` }, ['created', [{ addr: `${m}:${id}` }], ['addr']]);
      return 0;
    },
  },
  {
    path: ['note', 'delete'], plane: 'data', json: true, permission: 'write', agentInvokable: false,
    usage: 'note delete <m> <id>', summary: 'delete a row directly (referrers flagged by zz check; fold merges instead)',
    io: { params: ['module', 'id'], flags: {} }, // catalog: the daemon's direct-delete lane
    handler: ({ args, cwd, log, json }) => {
      const [m, id] = args._;
      if (!m || !id) return fail(log, 'usage: zz note delete <module> <id>', json);
      const r = open(cwd).remove(m, id);
      if (!r.ok) return fail(log, r.error, json);
      emit(log, json, { ok: true, deleted: `${m}:${id}` }, ['deleted', [{ addr: `${m}:${id}` }], ['addr']]);
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
];
