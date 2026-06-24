// src/serve/api.mjs — the one programmatic surface over a Project.
//
// what: a single import that composes the notes substrate + the verbs & loop into the clean
//       façade every host (CLI veneer, web daemon, plugin) consumes. `open(cwd)`
//       resolves the home once; the returned handle exposes the five verbs plus
//       the gate, snapshots, and proposals — all bound to that home.
// why:  hosts should depend on ONE stable surface, not reach into notes/ and
//       the verbs/loop internals. This is the seam the CLI thins down to and the
//       daemon calls — so the verb set stays legible and swappable underneath.
// how:  thin binding over the registry + the human-gate (review) + snapshot
//       primitives. registerAll() is idempotent, so opening is cheap and safe to
//       repeat. Zero-dep.

import { homeDir, repoRoot } from '../notes/store.mjs';
import { invoke } from './dispatch.mjs';
import { listModules } from '../notes/module.mjs';
import { registerAll } from './wire.mjs';
import { stageChange, listStaged } from '../grow/stage.mjs';
import { approve, reject } from '../grow/review.mjs';
import { planFor, applyPlan } from '../grow/plan.mjs';
import { renameNote, mergeNotes, refactorField } from '../grow/refactor.mjs';
import { generations, rollback, diffGenerations } from '../notes/generation.mjs';

/**
 * Open the Project rooted at `cwd` (git-citizen: the `.zuzuu/` at the repo root).
 * @returns a handle bound to that home — the host's entire dependency surface.
 */
export function open(cwd = process.cwd()) {
  registerAll(); // idempotent
  const root = repoRoot(cwd);
  const home = homeDir(root);

  return {
    home,
    root,

    // ── inspection ──────────────────────────────────────────────────────────
    modules: () => listModules(home),

    // ── the read/run verbs (dispatched through the one registry) ────────────
    query: (module, opts = {}) => invoke(home, module, 'query', opts),
    check: (module, opts = {}) => invoke(home, module, 'check', opts),
    act: (module, id, inputs = {}) => invoke(home, module, 'act', id, inputs),

    // ── the human gate (review is interactive — not a registry verb) ────────
    stage: (module, p) => stageChange(home, module, p),
    staged: (module) => listStaged(home, module),
    approve: (module, id, opts) => approve(home, module, id, opts),
    reject: (module, id, reason) => reject(home, module, id, reason),
    plan: (module) => planFor(home, module),
    apply: (module, planId) => applyPlan(home, module, planId),

    // ── graph-safe refactors (multi-note, link-updating) ────────────────────
    rename: (module, oldId, newId) => renameNote(home, module, oldId, newId),
    merge: (module, src, dst) => mergeNotes(home, module, src, dst),
    refactor: (module, key, from, to) => refactorField(home, module, key, from, to),

    // ── snapshots (per-module generations) ─────────────────────────────────
    generations: (module) => generations(home, module),
    rollback: (module, n) => rollback(home, module, n),
    diff: (module, from, to, opts = {}) => diffGenerations(home, module, from, to, opts),
  };
}
