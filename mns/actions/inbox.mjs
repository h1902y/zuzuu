// mns/actions/inbox.mjs
// The Actions crystallization gate (the same governed pipeline as Knowledge
// promotion, kept out of the knowledge ER/registry machinery). A proposed action
// is a real dir under .mns/actions/inbox/<slug>/. A human activates it (move to
// .mns/actions/<slug>/) or rejects it (remove). Never auto-activates.

import { join } from 'node:path';
import { existsSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { actionsDir, inboxDir, listActions, isSafeSlug } from './manifest.mjs';

/** Proposed actions awaiting review (in .mns/actions/inbox/). */
export function listProposedActions(mnsDir) {
  return listActions(inboxDir(mnsDir));
}

/**
 * Activate a proposed action: validate, then move inbox/<slug> → actions/<slug>.
 * @returns {{ok:true} | {ok:false, error:string}}
 */
export function activateAction(mnsDir, slug) {
  if (!isSafeSlug(slug)) return { ok: false, error: `invalid slug '${slug}'` };
  const from = join(inboxDir(mnsDir), slug);
  const to = join(actionsDir(mnsDir), slug);
  if (!existsSync(from)) return { ok: false, error: `no proposed action '${slug}'` };
  if (existsSync(to)) return { ok: false, error: `an active action '${slug}' already exists — reject or rename first` };
  const manPath = join(from, 'action.json');
  if (existsSync(manPath)) {
    let man;
    try { man = JSON.parse(readFileSync(manPath, 'utf8')); }
    catch { return { ok: false, error: `manifest is not valid JSON` }; }
    if (man.slug && man.slug !== slug) return { ok: false, error: `manifest slug '${man.slug}' ≠ dir '${slug}'` };
  }
  renameSync(from, to);
  return { ok: true };
}

/** Reject a proposed action: remove its inbox entry. */
export function rejectAction(mnsDir, slug) {
  if (!isSafeSlug(slug)) return { ok: false, error: `invalid slug '${slug}'` };
  const from = join(inboxDir(mnsDir), slug);
  if (!existsSync(from)) return { ok: false, error: `no proposed action '${slug}'` };
  rmSync(from, { recursive: true, force: true });
  return { ok: true };
}
