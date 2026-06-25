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
import { patchNote, appendNote } from '../grow/edit.mjs';
import { viewNote } from '../use/view.mjs';
import { validateProject } from '../use/check.mjs';
import { runWorkflow } from '../use/workflow.mjs';
import { generations, rollback, diffGenerations, notesAsOf } from '../notes/generation.mjs';
import { timeline } from './timeline.mjs';
import { readProjectRefs, readLibraryModules, registryIdentity, mintRegistry, newIdentity, addProject, syncRegistry } from '../notes/registry.mjs';
import { activeRegistryPath, setActiveRegistry } from '../notes/registry-pointer.mjs';

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
    flow: (module, id, inputs = {}) => runWorkflow(home, module, id, inputs),

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

    // ── scoped edits + windowed read ────────────────────────────────────────
    patch: (module, id, key, value) => patchNote(home, module, id, key, value),
    append: (module, id, text) => appendNote(home, module, id, text),
    view: (module, id, opts) => viewNote(home, module, id, opts),
    validate: (module = '') => validateProject(home, module),

    // ── snapshots (per-module generations) ─────────────────────────────────
    generations: (module) => generations(home, module),
    rollback: (module, n) => rollback(home, module, n),
    diff: (module, from, to, opts = {}) => diffGenerations(home, module, from, to, opts),
    asOf: (module, n) => notesAsOf(home, module, n),
    timeline: (opts = {}) => timeline(home, opts),

    // ── the project registry (the active role:registry repo; read surface) ───
    // The active registry is a SEPARATE repo resolved via the machine-global
    // pointer; its `.zuzuu` home is independent of THIS project's `home`. Mutating
    // verbs (add/sync/subscribe/check/touch) extend this handle in later units.
    registry: {
      home: () => activeRegistryPath(),
      configured: () => !!activeRegistryPath(),
      refs: () => { const h = activeRegistryPath(); return h ? readProjectRefs(h) : []; },
      library: () => { const h = activeRegistryPath(); return h ? readLibraryModules(h) : []; },
      identity: () => { const h = activeRegistryPath(); return h ? registryIdentity(h) : null; },

      // make THIS project's repo a registry + set it active (U4).
      init: ({ title } = {}) => {
        const id = newIdentity();
        mintRegistry(home, id, title ? { title } : {});
        setActiveRegistry(id, home);
        return { identity: id, home };
      },
      // add a project (at `path`) to the active registry; dedupe by remote (U4).
      add: (path) => {
        const h = activeRegistryPath();
        if (!h) throw new Error('no active registry — run `zz registry init` first');
        return { handle: addProject(h, path) };
      },
      // refresh health stamps + commit the registry repo (U4).
      sync: () => {
        const h = activeRegistryPath();
        if (!h) throw new Error('no active registry — run `zz registry init` first');
        return syncRegistry(h);
      },
      // auto-track (U5): idempotently upsert THIS project as a `tracked: auto` ref in
      // the active registry. No-op when no registry, or when this project IS the
      // registry (never add the registry to itself). Never commits (sync does);
      // never downgrades a `pinned` ref. Called at the session-open boundary.
      touch: (projectPath = root) => {
        const h = activeRegistryPath();
        if (!h) return { touched: false };
        const projectRoot = repoRoot(projectPath);
        if (homeDir(projectRoot) === h) return { touched: false, self: true };
        return { touched: true, handle: addProject(h, projectRoot, { tracked: 'auto' }) };
      },

      // a status summary (U4).
      status: () => {
        const h = activeRegistryPath();
        if (!h) return { configured: false, identity: null, projects: 0, refs: [] };
        const refs = readProjectRefs(h);
        return { configured: true, identity: registryIdentity(h), home: h, projects: refs.length, refs };
      },
    },
  };
}
