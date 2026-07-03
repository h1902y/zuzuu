// src/cli/verbs/secret.mjs — the `secret` namespace: the DECLARATIONS view (§J.3/§J.5,
// docs/specs/2026-07-02-polish-showcase-experience.md). Read-only, like `tool` — a
// secret's VALUE is a terminal-managed, host-owned thing zuzuu never stores; there is
// no `secret set`/`secret write` verb here, on purpose (§J.5: "the SET operation is a
// documented terminal call, not a zuzuu-owned file"). Creating a declaration is
// `zz note create secrets <id> --type secret --field name=… --field scope=…` (the
// SAME operator lane every other note create rides — see notes/validate.mjs's
// value-refusal invariant for why the value itself can never ride along) or an agent
// proposal via stage→review. Composed into THE table by ../commands.mjs.

import { open } from '../../serve/api.mjs';
import { listDeclarations, isAvailable, hostSetCommand, SECRETS_MODULE } from '../../use/secrets.mjs';
import { secretActorOf, secretResolvesFromOf, secretSensitiveOf } from '../../notes/validate.mjs';
import { toon } from '../../notes/toon.mjs';
import { fail } from '../args.mjs';

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
    path: ['secret', 'list'], plane: 'data', json: true, permission: 'read', agentInvokable: true,
    usage: 'secret list [--json]', summary: 'every secret DECLARATION — name · scope · actor · sensitive · resolves_from · last_used · host availability (never the value)',
    io: { params: [], flags: {} },
    handler: ({ cwd, log, json }) => {
      const home = open(cwd).home;
      const decls = listDeclarations(home);
      const rows = decls.map((d) => rowOf(home, d.id, d.note));
      if (json) { log(JSON.stringify({ secrets: rows })); return 0; }
      if (!rows.length) { log(`0 declarations in '${SECRETS_MODULE}' — zz note create ${SECRETS_MODULE} <id> --type secret --field name=X --field scope=module:x`); return 0; }
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
