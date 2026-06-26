// src/use/check.mjs — integrity, made queryable.
//
// what: the `check` verb — surface the Project's best-effort cracks: broken links
//       (a relation to a missing note), orphans (no links at all), and stale notes
//       (explicitly superseded, or deprecated).
// why:  the files are mutated by many processes (the agent, the user, other
//       tools), so the graph is best-effort. `check` makes divergence QUERYABLE
//       rather than pretending it can't happen (R2 — integrity is a capability,
//       not a hidden invariant).
// how:  reads the index (broken links) + the notes (orphans, stale). Fail-soft.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { parse } from '../notes/note.mjs';
import { read as readLog } from '../notes/log.mjs';
import { itemsDir } from '../notes/store.mjs';
import { brokenLinks } from '../notes/index.mjs';
import { listModules } from '../notes/module.mjs';
import { validateNote } from '../notes/validate.mjs';
import { moduleContent, readSourcePin } from '../notes/registry.mjs';
import { resolveRegistryPath } from '../notes/registry-pointer.mjs';

/** Every note across all modules, parsed: [{ addr, note }]. */
function allNotes(home) {
  const out = [];
  for (const m of listModules(home)) {
    const dir = itemsDir(home, m.id);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const id = f.slice(0, -3);
      const { ok, note } = parse(readFileSync(`${dir}/${f}`, 'utf8'), { id });
      if (ok && note) out.push({ addr: `${m.id}:${id}`, note });
    }
  }
  return out;
}

/** Subscribed modules whose vendored content has drifted from their `source:` pin
 *  (a local edit, or the registry advanced upstream). Pending (not-yet-landed)
 *  subscriptions and an unreachable registry are reported honestly, never crash. */
function driftFindings(home) {
  const out = [];
  for (const m of listModules(home)) {
    const pin = readSourcePin(home, m.id);
    if (!pin) continue; // not a subscribed module
    const local = moduleContent(home, m.id);
    if (!local.items.length) continue; // staged but not yet approved — pending, not drift
    if (local.digest !== pin.digest) { out.push({ module: m.id, why: 'local edit — vendored copy diverged from the pin' }); continue; }
    const regHome = pin.registry ? resolveRegistryPath(pin.registry) : null;
    if (!regHome || !existsSync(regHome)) { out.push({ module: m.id, why: `pin unresolved — registry ${pin.registry} not found` }); continue; }
    if (moduleContent(regHome, m.id).digest !== pin.digest) out.push({ module: m.id, why: 'upstream advanced — the registry has a newer version' });
  }
  return out;
}

/** Notes with NO create/update record in their module's mutation log — added or edited
 *  OUTSIDE the review gate (or seeded before provenance logging; `zz init` reconciles
 *  seeds). The detection half of the brain write-protection (Layer 4). Fail-soft. */
function ungatedFindings(home, notes) {
  const loggedByModule = new Map();
  const loggedIds = (module) => {
    if (!loggedByModule.has(module)) {
      const ids = new Set();
      try { for (const e of readLog(home, module, 'mutations')) if (e && e.note != null) ids.add(String(e.note)); } catch { /* fail-soft */ }
      loggedByModule.set(module, ids);
    }
    return loggedByModule.get(module);
  };
  const out = [];
  for (const { addr } of notes) {
    const i = addr.indexOf(':');
    const module = addr.slice(0, i), id = addr.slice(i + 1);
    if (!loggedIds(module).has(id)) {
      out.push({ addr, why: 'no review record — added outside the gate (propose via `zz stage`), or a pre-provenance seed (`zz init` reconciles)' });
    }
  }
  return out;
}

/**
 * @returns {{ broken: Array, orphans: string[], stale: Array, drifted: Array, ungated: Array }}
 */
function checkData(home) {
  const broken = (() => { try { return brokenLinks(home); } catch { return []; } })();
  const notes = allNotes(home);

  // orphans: no outbound relations and not the target of any relation
  const hasOutbound = new Set();
  const linkedTo = new Set();
  for (const { addr, note } of notes) {
    const rels = note.relations && typeof note.relations === 'object' ? note.relations : {};
    const dsts = Object.values(rels).flatMap((v) => [].concat(v)).filter(Boolean);
    if (dsts.length) hasOutbound.add(addr);
    for (const d of dsts) linkedTo.add(String(d));
  }
  const orphans = notes
    .filter(({ addr, note }) => !hasOutbound.has(addr)
      && !linkedTo.has(addr) && !linkedTo.has(note.id ?? addr.split(':')[1]))
    .map(({ addr }) => addr);

  // stale: explicitly superseded, or deprecated
  const stale = notes
    .filter(({ note }) => note.superseded_by || note.status === 'deprecated')
    .map(({ addr, note }) => ({ addr, why: note.superseded_by ? `superseded_by ${note.superseded_by}` : 'deprecated' }));

  const drifted = (() => { try { return driftFindings(home); } catch { return []; } })();
  const ungated = (() => { try { return ungatedFindings(home, notes); } catch { return []; } })();
  return { broken, orphans, stale, drifted, ungated };
}

/** The `check` capability handler (project-wide). */
export function check(ctx) {
  return checkData(ctx.home);
}

/** Schema-validate every note (project-wide, or one module). @returns the failures only. */
export function validateProject(home, module = '') {
  return allNotes(home)
    .filter(({ addr }) => !module || addr.startsWith(`${module}:`))
    .map(({ addr, note }) => ({ addr, ...validateNote(note) }))
    .filter((r) => !r.ok);
}
