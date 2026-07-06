// src/cli/commands.mjs — THE command table: ONE array, composed from the per-plane
// verb files, that the router (index.mjs), `zz help`, the daemon's argv catalog,
// and the guardrails execution gate ALL read.
//
// what: `COMMANDS` = [...setup, ...data, ...evolution, ...inspection, `commands`,
//       ...session, ...registry, ...steer, ...host, ...aliases]. A row is
//       `{ path, plane, summary, usage, handler, …metadata }`; `path` is the argv
//       prefix the router longest-prefix-matches; `handler` receives a ctx
//       ({ args, cwd, log, json, rest, warn }) and returns an exit code. The
//       grammar is TWO-TIER: Tier-1 hot-loop verbs stay FLAT, Tier-2 cold verbs
//       live under NOUN namespaces (`module · note · gen · session · host · registry`).
// why:  a hand-maintained switch + a hand-maintained HELP const drift apart. Folding
//       ONE table means an unlisted command can't exist — the table is the spec the
//       router executes, the help renders, the daemon shells, and the gate denies
//       from. The rows live in verbs/<plane>.mjs so each plane reads on one screen;
//       the DERIVED surfaces (catalog · gate pattern · help) live here, beside the
//       composition they derive from. Back-compat is data: an old verb is an `alias`
//       ROW pointing at its canonical path.
// how:  rows carry display metadata (plane · summary · usage) the help reader folds,
//       plus capability metadata (json · permission · agentInvokable · io ·
//       writeSubcommands) that RECORDS reality — the catalog and the deny set are
//       generated from it. Zero-dep.

import { setupRows } from './verbs/setup.mjs';
import { dataRows } from './verbs/data.mjs';
import { runRows } from './verbs/run.mjs';
import { evolutionRows } from './verbs/evolution.mjs';
import { autonomyRows } from './verbs/autonomy.mjs';
import { inspectionRows } from './verbs/inspection.mjs';
import { toolRows } from './verbs/tool.mjs';
import { secretRows } from './verbs/secret.mjs';
import { sessionRows } from './verbs/session.mjs';
import { registryRows } from './verbs/registry.mjs';
import { steerRows } from './verbs/steer.mjs';
import { hostRows } from './verbs/host.mjs';
import { toon } from '../notes/toon.mjs';
import { fail, parseWhere } from './args.mjs';

// stable public surface: the router imports `fail`, tests import `parseWhere` —
// they live in args.mjs now; re-exported so importers of the table keep working.
export { fail, parseWhere };

// The meta-verb lives HERE, beside the catalog it renders (every other row lives
// in its plane file — this one is ABOUT the table itself).
const commandsRow = {
  // The generated command catalog: the argv specs the daemon shells from. Emitting it
  // from the SAME table that drives the router/help/gate means the out-of-process daemon
  // builds its argv from a source that CANNOT drift (the moat extends to the daemon — it
  // can only shell commands this table knows). See commandCatalog() below.
  path: ['commands'], plane: 'inspection', json: true, permission: 'read', agentInvokable: true,
  usage: 'commands', summary: 'the command catalog (argv specs) — the daemon reads this',
  handler: ({ log, json }) => {
    const cat = commandCatalog();
    if (json) { log(JSON.stringify({ commands: cat })); return 0; }
    const rows = cat.map((c) => ({
      id: c.id, path: c.path.join(' '),
      params: c.params.map((p) => (typeof p === 'string' ? `<${p}>` : p.const)).join(' '),
      flags: Object.values(c.flags).join(' '),
    }));
    log(toon('commands', rows, ['id', 'path', 'params', 'flags']));
    return 0;
  },
};

// ── back-compat aliases ─────────────────────────────────────────────────────
// Each maps an OLD flat verb to its canonical Tier-2 path. The router emits ONE
// stderr deprecation note, then dispatches the canonical handler with the SAME ctx
// — data, not 20 wrappers. Excluded from `zz help` (they don't clutter the surface).
const aliasRows = [
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
].map(([path, alias]) => ({ path, alias }));

export const COMMANDS = [
  ...setupRows,
  ...dataRows,
  ...runRows,
  ...evolutionRows,
  ...autonomyRows,
  ...inspectionRows,
  ...toolRows,
  ...secretRows,
  commandsRow,
  ...sessionRows,
  ...registryRows,
  ...steerRows,
  ...hostRows,
  ...aliasRows,
];

// ── the command catalog — GENERATED FROM THE TABLE, the daemon's argv source ───────
// The workbench daemon is out-of-process (it must not import src/), yet it shells `zz`
// for every brain read/write. Hand-typed argv arrays there are how it once shelled
// NONEXISTENT verbs (`module new` / `generation mint` — a live bug). The catalog closes
// that class structurally: the daemon builds argv ONLY from a (commandId → spec) lookup
// emitted by `zz commands --json`, so it can only shell commands THIS table knows.
//
// A catalog entry is `{ id, path, params, flags }`: `path` is the fixed argv prefix,
// `params` an ordered positional list (a string is a named placeholder; `{const}` a
// literal — used by the deprecated key-first `module <m> rollback|generations` shapes),
// and `flags` maps a named param → its `--flag` (emitted only when the daemon supplies a
// value). A row's optional `io` descriptor carries its precise params/flags; rows without
// one (reads the daemon never builds argv for) catalog as an empty contract.
//
// CATALOG_SUBFORMS are the daemon-shelled shapes handled INSIDE a parent row's handler
// (module overview/items/item/schema + the deprecated key-first forms; session label;
// review approve/reject) — real, table-known argv that isn't a standalone row, so it's
// declared here against its parent's leading token.
const CATALOG_SUBFORMS = [
  { id: 'module.overview', path: ['module', 'overview'], params: [], flags: {} },
  { id: 'module.items', path: ['module', 'items'], params: ['key'], flags: {} },
  { id: 'module.items.all', path: ['module', 'items'], params: [{ const: '--all' }], flags: {} },
  { id: 'module.item', path: ['module', 'item'], params: ['key', 'id'], flags: {} },
  { id: 'module.schema', path: ['module', 'schema'], params: ['key'], flags: {} },
  { id: 'module.generations', path: ['module'], params: ['key', { const: 'generations' }], flags: {} },
  { id: 'module.rollback', path: ['module'], params: ['key', { const: 'rollback' }, 'id'], flags: {} },
  { id: 'session.label', path: ['session', 'label'], params: ['id'], flags: { text: '--text' } },
  { id: 'review.approve', path: ['review', 'approve'], params: ['module', 'id'], flags: {} },
  { id: 'review.reject', path: ['review', 'reject'], params: ['module', 'id'], flags: { reason: '--reason' } },
];

/** The argv catalog: one `{ id, path, params, flags }` entry per non-alias row (id =
 *  path joined by `.`) plus the in-handler daemon subforms. The single source the daemon
 *  reads via `zz commands --json` — adding/renaming a verb flows to the daemon for free,
 *  and the daemon refuses any id this doesn't carry. Aliases are back-compat, not surface. */
export function commandCatalog() {
  const out = [];
  for (const c of COMMANDS) {
    if (c.alias) continue;
    const io = c.io ?? { params: [], flags: {} };
    out.push({ id: c.path.join('.'), path: c.path.slice(), params: (io.params ?? []).slice(), flags: { ...(io.flags ?? {}) } });
  }
  for (const s of CATALOG_SUBFORMS) out.push({ id: s.id, path: s.path.slice(), params: s.params.slice(), flags: { ...s.flags } });
  return out;
}

// ── the moat's execution-gate deny set — GENERATED FROM THE TABLE ────────────────
// The same table that drives the router AND help also drives the guardrails gate, so the
// "agent can't shell `zz <writeverb>` to mutate its own brain" invariant CANNOT drift: add
// a write verb to the table and it's denied automatically; no second list to keep in sync.
//
// A verb is DENIED when it DURABLY mutates the Project's notes/manifests — `permission ∈
// {write, admin}` AND NOT `agentInvokable` (so the agent's SANCTIONED channels, `stage`
// (a proposal) and `observe` (a mine), which are write-permission but agent-invokable, stay
// ALLOWED). A bare NAMESPACE-ROOT row (`session`/`registry`, whose subcommands carry their
// own permission and include reads like `session status`) is excluded — only its write
// LEAVES (`session land`, `registry subscribe`, …) are denied. Plus the gate-WRITE
// subcommands a `gate` row declares (`review approve|apply`), and every back-compat alias
// pointing at a denied canonical path.

const WRITE_PERMS = new Set(['write', 'admin']);

/** The verb paths the execution gate denies the agent from shelling, as arrays of path
 *  segments (canonical paths + gate-write subcommands + their aliases). Derived purely
 *  from COMMANDS — the single source of truth the gate pattern is built from. */
export function writeVerbPaths() {
  const canon = COMMANDS.filter((c) => !c.alias);
  const isNamespaceRoot = (row) =>
    row.path.length === 1 && canon.some((o) => o !== row && o.path.length > 1 && o.path[0] === row.path[0]);
  // 1. the durable-mutation canonical paths (write/admin, not agent-invokable, not a root)
  const paths = canon
    .filter((c) => WRITE_PERMS.has(c.permission) && c.agentInvokable === false && !isNamespaceRoot(c))
    .map((c) => c.path.slice());
  // 2. WRITE subcommands a row dispatches INSIDE its own handler (so they're not standalone
  //    rows): the `gate` row's `review approve|apply`, and the `session` namespace's
  //    sub-dispatched mutators (the deprecated aliases + the destructive worktree ops). A
  //    sub may be multi-segment (`worktree discard`) — split it onto the path.
  for (const c of canon) for (const sub of c.writeSubcommands ?? []) paths.push([...c.path, ...sub.split(/\s+/)]);
  // 3. every back-compat alias that points at one of the denied canonical paths
  const denied = new Set(paths.map((p) => p.join(' ')));
  for (const c of COMMANDS) if (c.alias && denied.has(c.alias.join(' '))) paths.push(c.path.slice());
  return paths;
}

/** The seeded execution-gate pattern (the string the `protect-brain-exec` rule note carries):
 *  DENY a Bash command that invokes the zz CLI (`zz` / `zuzuu` / `node …/bin/zuzuu.mjs`) with a
 *  WRITE verb. The verb is anchored right after the binary (zz has no pre-verb global flags); a
 *  `gen` write (rollback · mint) also matches its bare leaf and the deprecated `module <m> <leaf>`
 *  form — the muscle-memory + daemon shapes — so they can't slip the gate either. */
export function gateWriteVerbPattern() {
  const phrases = new Set();
  for (const p of writeVerbPaths()) {
    phrases.add(p.join('\\s+')); // `note set` → note\s+set (segments are [a-z-] verbs — regex-safe literally)
    if (p[0] === 'gen' && p.length === 2) phrases.add(`(?:module\\s+\\S+\\s+)?${p[1]}`); // gen leaf, bare + `module <m> <leaf>`
  }
  // longest phrase first (a benign ordering habit — alternatives are distinct verbs anyway)
  const alt = [...phrases].sort((a, b) => b.length - a.length).join('|');
  return `(?:\\bzz|\\bzuzuu(?:\\.mjs)?)\\s+(?:${alt})\\b`;
}

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
const NS_ORDER = ['module', 'note', 'tool', 'secret', 'run', 'gen', 'session', 'host', 'registry'];
const NS_LABEL = {
  module: 'module — alter a typed-column schema (operator-gated)',
  note: 'note — edit notes (gated writes)',
  tool: 'tool — the toolkit/tool view (§I.6 MCP-native: module=toolkit, action=tool)',
  secret: 'secret — declarations only; the value is terminal-managed, never zuzuu-stored (§J.3/§J.5)',
  run: 'run — the Tier-2 durable runner (the run is a note)',
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
