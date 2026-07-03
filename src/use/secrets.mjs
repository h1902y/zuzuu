// src/use/secrets.mjs — resolve a declared secret's VALUE from the host, gated.
//
// what: `resolveSecret(home, name, {caller, actor})` — find the `type: secret`
//       declaration note (the `secrets` module, by CONVENTION — see below), check the
//       caller against its `scope` allowlist, check `actor` against its `actor` gate,
//       then read the VALUE from the host per `resolves_from`. The value is RETURNED
//       to the caller only — never logged, never written back to the declaration,
//       never held anywhere by this file.
// why:  §J.3/§J.5 (docs/specs/2026-07-02-polish-showcase-experience.md) — a secret
//       note is a declaration; zuzuu never stores or shells a value. This is the ONE
//       reader of the host store, so every consumer (act.mjs's env-building, `zz
//       secret check`'s availability probe) shares the SAME scope+actor gate — no
//       second gate to drift out of sync.
// how:  pure + fs-only — `listNoteIds`/`readNote` (notes/repo.mjs) over the `secrets`
//       module, the same non-indexed pattern grow/backfill.mjs already uses (the
//       corpus is a handful of declarations; a sqlite dependency here would tie
//       resolution, a HOT path, to index freshness for no benefit). use/ never writes
//       the Project (architecture rule 6) — this file has no write path at all; the
//       `last_used` audit touch is a SEPARATE, explicit concern (serve/api.mjs's
//       `act` wrapper, which already imports grow/edit's patchNote) precisely so this
//       resolver never needs to import grow/ (which would cycle back through
//       grow/run.mjs's own use/ imports). Zero-dep beyond notes/.

import { listNoteIds, readNote } from '../notes/repo.mjs';
import { secretActorOf, secretResolvesFromOf, isScopeEntry, scopeMatches } from '../notes/validate.mjs';
import { readSecretsFileValue } from '../notes/log.mjs';

// The CONVENTIONAL home for `type: secret` declarations — a dedicated module, per
// §J.3's own header ("Secrets: a `secrets` module of DECLARATIONS"). Documented, not
// hard-enforced: `notes/validate.mjs`'s value-refusal + shape invariants apply to ANY
// `type: secret` note regardless of which module it lives in (defense in depth, same
// as every other per-type check in that file); this resolver only ever LOOKS here, so
// a declaration minted elsewhere simply won't be found. See docs/guide/Secrets.md.
export const SECRETS_MODULE = 'secrets';

/** Every `type: secret` declaration in the secrets module — `[{id, note}]`, sorted by
 *  id. Fail-soft: an unreadable/unsafe note is skipped, never thrown. */
export function listDeclarations(home) {
  const out = [];
  for (const id of listNoteIds(home, SECRETS_MODULE)) {
    let note;
    try { note = readNote(home, SECRETS_MODULE, id); } catch { continue; }
    if (note && note.type === 'secret') out.push({ id, note });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** Find the declaration whose `name:` field matches (case-sensitive — env var names
 *  are). `null` when none exists. */
export function findDeclaration(home, name) {
  return listDeclarations(home).find((d) => d.note.name === name) ?? null;
}

/** The host set-command to name in a "missing value" error — one per `resolves_from`,
 *  so the message tells the operator exactly what to run instead of just "not set". */
export function hostSetCommand(resolvesFrom, name) {
  if (resolvesFrom === 'fly') return `fly secrets set ${name}=<value> -a <project-app>`;
  if (resolvesFrom === 'oidc') return '(oidc resolves per-run at the host — nothing to set locally)';
  if (resolvesFrom === 'secrets-file') return `add '${name}=<value>' to .zuzuu/secrets.env (dev fallback only — see docs/guide/Secrets.md)`;
  return `export ${name}=<value>`; // env (default)
}

/** Is a declaration's value actually PRESENT on the host — a ✓/✗ availability check,
 *  NEVER the value itself (§J.5: write-only). `oidc` resolves per-run at the host, so
 *  there's nothing to check locally — `null` (not applicable), not false. */
export function isAvailable(home, note) {
  const resolvesFrom = secretResolvesFromOf(note);
  if (resolvesFrom === 'oidc') return null;
  if (resolvesFrom === 'secrets-file') return readSecretsFileValue(home, note.name) !== undefined;
  return !!process.env[note.name]; // env | fly — fly injects into env at boot (§J.5)
}

/**
 * Resolve a declared secret's VALUE. Steps, in order (§J.3): (a) find the
 * declaration; (b) SCOPE — does `caller` match an entry in its allowlist? No match
 * (including an absent/empty scope) → a resolution error, NOT a value; (c) ACTOR —
 * the HITL×secrets gate: `operator-only` refuses under an agent actor, fail-closed;
 * (d) resolve the VALUE from the host per `resolves_from` (never a second store
 * zuzuu owns — §J.5). The value is returned ONLY on success; every failure path
 * carries `deniedBy` (a machine-checkable reason) + a human `error`, never a value.
 * @param {string} home
 * @param {string} name  the secret's declared env-var name (e.g. 'OPENAI_API_KEY')
 * @param {{caller?: string, actor?: 'operator'|'agent'}} [opts]
 *   `caller` — the thing asking (a bare module id, or a 'module:id' tool address —
 *   act.mjs supplies its own `${module}:${id}`). `actor` — the trust context, NEVER
 *   read from agent-controllable input (same discipline as guardrails/gate.mjs);
 *   defaults 'operator' (the fail-open-for-a-human-CLI-call default every other
 *   caller in this codebase uses).
 * @returns {{ ok, value?, name, declaration?, deniedBy?, error? }}
 */
export function resolveSecret(home, name, { caller, actor = 'operator' } = {}) {
  const found = findDeclaration(home, name);
  if (!found) {
    return {
      ok: false, name,
      error: `no secret declared '${name}' (zz note create ${SECRETS_MODULE} <id> --type secret --field name=${name} --field scope=module:x)`,
    };
  }
  const { id, note } = found;
  const declaration = `${SECRETS_MODULE}:${id}`;

  const scope = Array.isArray(note.scope) ? note.scope.filter(isScopeEntry) : [];
  if (!scopeMatches(scope, caller)) {
    return {
      ok: false, name, declaration, deniedBy: 'scope',
      error: `'${caller ?? '(no caller)'}' is not in ${declaration}'s scope allowlist`,
    };
  }

  const declaredActor = secretActorOf(note);
  if (declaredActor === 'operator-only' && actor === 'agent') {
    return {
      ok: false, name, declaration, deniedBy: 'actor',
      error: `${declaration} is operator-only — refused for an agent-actor run`,
    };
  }

  const resolvesFrom = secretResolvesFromOf(note);
  if (resolvesFrom === 'oidc') {
    return {
      ok: false, name, declaration, deniedBy: 'unresolvable-locally',
      error: `${declaration} resolves via OIDC at the host, per-run — not resolvable from this local CLI process`,
    };
  }
  const value = resolvesFrom === 'secrets-file' ? readSecretsFileValue(home, name) : process.env[name]; // env | fly
  if (value === undefined || value === '') {
    return {
      ok: false, name, declaration, deniedBy: 'missing',
      error: `${declaration} declares '${name}' but no value is set on the host — ${hostSetCommand(resolvesFrom, name)}`,
    };
  }
  return { ok: true, name, declaration, value };
}
