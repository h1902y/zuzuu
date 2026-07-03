// src/cli/verbs/secret.mjs — the `secret` namespace: the DECLARATIONS view (§J.3/§J.5,
// docs/specs/2026-07-02-polish-showcase-experience.md) — `list`/`show`/`check` are
// read-only, like `tool` — a secret's VALUE is a terminal-managed, host-owned thing
// zuzuu never stores; there is still no `secret set`/`secret write` verb, on purpose
// (§J.5: "the SET operation is a documented terminal call, not a zuzuu-owned file").
//
// `secret declare` (below) does NOT cross that line — it has no value flag, ever. It's
// an AUTHORING helper: sugar over the SAME operator-lane `note create` write door every
// other note uses (validated, logged, minted — the value-refusal invariant untouched),
// typed for the declaration's own metas (name/scope/actor/resolves_from/rotation_note/
// sensitive). Exactly the same relationship `zz module new` has to a raw manifest
// create — a typed authoring surface over an existing write path, not a second one.
//
// THE GAP it closes: `zz note create secrets <id> --type secret --field
// 'scope=[tool:x]'` lands `scope` as the raw STRING `"[tool:x]"`, not a list — the
// (correct) scope validation then refuses it — because `--field`'s schema-aware
// coercion (grow/edit.mjs's coerceForField) only turns a comma/bracket string into a
// list for a column the module's manifest ALREADY declares as `multi` (`zz module
// add-column secrets scope multi`, docs/guide/Secrets.md). Without minting that column
// first, a scoped secret couldn't be authored ergonomically from the CLI. `secret
// declare` builds the list itself (`--scope a,b`, repeatable) and never goes through
// `--field` at all, so no module/column ceremony is required first.
//
// Composed into THE table by ../commands.mjs.

import { open } from '../../serve/api.mjs';
import { listDeclarations, isAvailable, hostSetCommand, SECRETS_MODULE } from '../../use/secrets.mjs';
import { secretActorOf, secretResolvesFromOf, secretSensitiveOf } from '../../notes/validate.mjs';
import { slugify } from '../../notes/note.mjs';
import { toon } from '../../notes/toon.mjs';
import { fail, emit, str } from '../args.mjs';

/** `--scope a,b` and/or repeated `--scope` → a flat list of entries. A bracket-wrapped
 *  value (`--scope '[tool:x]'` — the shape a copy-pasted YAML scope looks like) is
 *  tolerated too: strip the brackets, then split on comma. Scans the raw argv (like
 *  args.mjs's fieldPairs/whereFilters) because parseArgs keeps only the LAST of a
 *  repeated flag — a single positional `--scope` flag can't otherwise be BOTH
 *  comma-list AND repeatable. */
function scopeArgs(rest) {
  const out = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--scope' && rest[i + 1] != null) {
      let v = String(rest[i + 1]).trim();
      if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1);
      for (const part of v.split(',').map((s) => s.trim()).filter(Boolean)) out.push(part);
      i++;
    }
  }
  return out;
}

/** Boolean-ish CLI value → a real boolean, mirroring validate.mjs's COERCIBLE.bool /
 *  secretSensitiveOf tolerance (true/false/yes/no/1/0, case-insensitive). `dflt` applies
 *  only when the flag is ABSENT; an unrecognized-but-PRESENT value passes through
 *  UNCHANGED so a typo surfaces at the write door ("sensitive must be boolean-ish")
 *  instead of silently landing as the default. */
function boolish(v, dflt) {
  if (v === undefined) return dflt;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  if (['true', 'yes', '1'].includes(s)) return true;
  if (['false', 'no', '0'].includes(s)) return false;
  return v;
}

/** A declaration's METAS-only row — name · scope · actor · sensitive · resolves_from
 *  · last_used · available. NEVER the value, not even for a non-sensitive one (§J.5:
 *  "write-only, never round-tripped" — this file has no code path that could even if
 *  it wanted to: it never calls resolveSecret, only isAvailable's ✓/✗ probe). */
function rowOf(home, id, note) {
  const resolvesFrom = secretResolvesFromOf(note);
  const avail = isAvailable(home, note);
  return {
    id, name: note.name ?? '', scope: Array.isArray(note.scope) ? note.scope.join('|') : '',
    actor: secretActorOf(note), sensitive: secretSensitiveOf(note), resolves_from: resolvesFrom,
    last_used: note.last_used ?? '', available: avail === null ? 'n/a' : avail ? '✓' : '✗',
  };
}

export const secretRows = [
  {
    // THE OPERATOR LANE: authoring sugar over `note create` — same write door,
    // typed for a declaration's metas. Never a value flag, on purpose (see header).
    path: ['secret', 'declare'], plane: 'data', json: true, permission: 'write', agentInvokable: false,
    usage: 'secret declare <name> [--id id] [--scope tool:x,module:y] [--actor operator-only|agent-allowed] [--resolves-from env|secrets-file|fly|oidc] [--rotation text] [--sensitive true|false] [--force]',
    summary: "author a type:secret DECLARATION's metas — never a value (sugar over note create, the operator lane)",
    io: { params: ['name'], flags: { id: '--id', scope: '--scope', actor: '--actor', 'resolves-from': '--resolves-from', rotation: '--rotation', sensitive: '--sensitive', force: '--force' } },
    handler: ({ args, cwd, log, json, rest }) => {
      const usage = "usage: zz secret declare <name> [--id id] [--scope tool:x,module:y] [--actor operator-only|agent-allowed] [--resolves-from env|secrets-file|fly|oidc] [--rotation text] [--sensitive true|false] [--force]";
      const name = String(args._[0] ?? '').trim();
      if (!name) return fail(log, usage, json);
      const id = str(args.id) || slugify(name);
      const scope = scopeArgs(rest);
      const change = {
        type: 'secret',
        name,
        actor: str(args.actor) || 'operator-only',
        resolves_from: str(args['resolves-from']) || 'env',
        sensitive: boolish(args.sensitive, true),
      };
      if (scope.length) change.scope = scope;
      const rotation = str(args.rotation);
      if (rotation) change.rotation_note = rotation;
      const r = open(cwd).create(SECRETS_MODULE, id, change, { force: !!args.force });
      if (!r.ok) return fail(log, r.error, json);
      const addr = `${SECRETS_MODULE}:${id}`;
      emit(log, json, { ok: true, addr, name, scope }, ['declared', [{ addr, name, scope: scope.join('|') || '—' }], ['addr', 'name', 'scope']]);
      return 0;
    },
  },
  {
    path: ['secret', 'list'], plane: 'data', json: true, permission: 'read', agentInvokable: true,
    usage: 'secret list [--json]', summary: 'every secret DECLARATION — name · scope · actor · sensitive · resolves_from · last_used · host availability (never the value)',
    io: { params: [], flags: {} },
    handler: ({ cwd, log, json }) => {
      const home = open(cwd).home;
      const decls = listDeclarations(home);
      const rows = decls.map((d) => rowOf(home, d.id, d.note));
      if (json) { log(JSON.stringify({ secrets: rows })); return 0; }
      if (!rows.length) { log(`0 declarations in '${SECRETS_MODULE}' — zz secret declare NAME --scope module:x`); return 0; }
      log(toon('secrets', rows, ['id', 'name', 'scope', 'actor', 'sensitive', 'resolves_from', 'last_used', 'available'], ['zz secret show <name>', 'zz secret check']));
      return 0;
    },
  },
  {
    path: ['secret', 'show'], plane: 'data', json: true, permission: 'read', agentInvokable: true,
    usage: 'secret show <name> [--json]', summary: "one secret declaration's metas — never the value, even when sensitive:false",
    io: { params: ['name'], flags: {} },
    handler: ({ args, cwd, log, json }) => {
      const name = String(args._[0] ?? '');
      if (!name) return fail(log, 'usage: zz secret show <name>', json);
      const home = open(cwd).home;
      const found = listDeclarations(home).find((d) => d.note.name === name);
      if (!found) return fail(log, `no secret declared '${name}'`, json);
      const row = rowOf(home, found.id, found.note);
      if (json) { log(JSON.stringify(row)); return 0; }
      log(toon('secret', [row], ['id', 'name', 'scope', 'actor', 'sensitive', 'resolves_from', 'last_used', 'available']));
      if (found.note.rotation_note) log(`rotation_note: ${found.note.rotation_note}`);
      return 0;
    },
  },
  {
    path: ['secret', 'check'], plane: 'data', json: true, permission: 'read', agentInvokable: true,
    usage: 'secret check [--json]', summary: 'a doctor for secrets — which declared secrets are MISSING from the host, and the command to fix each',
    io: { params: [], flags: {} },
    handler: ({ cwd, log, json }) => {
      const home = open(cwd).home;
      const decls = listDeclarations(home);
      const missing = decls
        .filter((d) => isAvailable(home, d.note) === false)
        .map((d) => ({ id: d.id, name: d.note.name, resolves_from: secretResolvesFromOf(d.note), fix: hostSetCommand(secretResolvesFromOf(d.note), d.note.name) }));
      if (json) { log(JSON.stringify({ total: decls.length, missing })); return 0; }
      if (!decls.length) { log(`0 declarations in '${SECRETS_MODULE}'`); return 0; }
      if (!missing.length) { log(`all ${decls.length} declared secret(s) are present on the host`); return 0; }
      log(toon(`missing (${missing.length}/${decls.length})`, missing, ['id', 'name', 'fix']));
      return 0;
    },
  },
];
