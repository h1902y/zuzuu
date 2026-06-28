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
import { generations, diffGenerations, notesAsOf } from '../notes/generation.mjs';
import { rollback } from '../grow/commit.mjs';
import { addColumn, alterColumn, dropColumn } from '../grow/schema.mjs';
import { timeline } from './timeline.mjs';
import { existsSync } from 'node:fs';
import { readProjectRefs, readLibraryModules, registryIdentity, mintRegistry, newIdentity, addProject, syncRegistry, ensureLocalRegistry } from '../notes/registry.mjs';
import { activeRegistryPath, setActiveRegistry } from '../notes/registry-pointer.mjs';
import { subscribeModule } from '../grow/subscribe.mjs';
import { generationCommit } from '../notes/generation.mjs';

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

    // ── schema: ALTER TABLE on a module's typed-column schema (operator-gated) ──
    addColumn: (module, name, type, opts) => addColumn(home, module, name, type, opts),
    alterColumn: (module, name, opts) => alterColumn(home, module, name, opts),
    dropColumn: (module, name) => dropColumn(home, module, name),

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

    // ── the project registry (the active role:registry repo) ────────────────
    // A registry is MANDATORY-local: if none is configured, the write paths
    // (ensure/add/sync/touch/seed) auto-create a plain local one at
    // `~/.zuzuu/registry` (`git init` THERE = the portability upgrade). The active
    // registry is a SEPARATE repo resolved via the machine-global pointer; its
    // `.zuzuu` home is independent of THIS project's `home`. Reads stay honest.
    registry: {
      home: () => activeRegistryPath(),
      configured: () => !!activeRegistryPath(),
      refs: () => { const h = activeRegistryPath(); return h ? readProjectRefs(h) : []; },
      library: () => { const h = activeRegistryPath(); return h ? readLibraryModules(h) : []; },
      identity: () => { const h = activeRegistryPath(); return h ? registryIdentity(h) : null; },

      // guarantee a registry exists (the mandatory-local rule). Returns
      // { home, identity, created } — created:true the first time it's minted.
      ensure: ({ title } = {}) => ensureLocalRegistry(title ? { title } : {}),
      // make THIS project's repo BE the registry + set it active — the explicit
      // override for "I want my project repo to host the registry" (not the default
      // local one). Idempotent on an existing registry home.
      init: ({ title } = {}) => {
        const id = newIdentity();
        mintRegistry(home, id, title ? { title } : {});
        setActiveRegistry(id, home);
        return { identity: id, home };
      },
      // add a project (at `path`) to the active registry; dedupe by remote. Ensures
      // a local registry first, so an `add` never dead-ends on "no registry".
      add: (path) => {
        const { home: h } = ensureLocalRegistry();
        return { handle: addProject(h, path) };
      },
      // seed many projects (auto-tracked) — the bootstrap that pours the daemon's
      // recents into a fresh local registry. Ensures first; skips missing paths and
      // the registry's own home. Returns { home, seeded }.
      seed: (paths = []) => {
        const { home: h } = ensureLocalRegistry();
        let seeded = 0;
        for (const p of paths) {
          if (!p || !existsSync(p)) continue;
          try {
            const pr = repoRoot(p);
            if (homeDir(pr) === h) continue; // never seed the registry into itself
            addProject(h, pr, { tracked: 'auto' });
            seeded++;
          } catch { /* fail-soft: skip an unresolvable path */ }
        }
        return { home: h, seeded };
      },
      // refresh health stamps + commit the registry repo (commit is skipped when the
      // local registry isn't yet a git repo — the refs still land on disk).
      sync: () => {
        const { home: h } = ensureLocalRegistry();
        return syncRegistry(h);
      },
      // auto-track: idempotently upsert THIS project as a `tracked: auto` ref. Ensures
      // a local registry first (so the first session you open materializes it), then
      // skips when this project IS the registry. Never commits (sync does); never
      // downgrades a `pinned` ref. Called at the session-open boundary.
      touch: (projectPath = root) => {
        const { home: h } = ensureLocalRegistry();
        const projectRoot = repoRoot(projectPath);
        if (homeDir(projectRoot) === h) return { touched: false, self: true };
        return { touched: true, handle: addProject(h, projectRoot, { tracked: 'auto' }) };
      },

      // subscribe a library module into THIS project as a gated proposal + pin (U6).
      subscribe: (module) => {
        const rh = activeRegistryPath();
        if (!rh) throw new Error('no active registry — run `zz registry init` first');
        let generation = 0, sha = null;
        try {
          const gens = generations(rh, module);
          if (gens && gens.length) { generation = gens[gens.length - 1].n; sha = generationCommit(rh, module, generation); }
        } catch { /* a hand-authored library module may have no generations — digest is the pin */ }
        return subscribeModule(home, { registryHome: rh, registryIdentity: registryIdentity(rh), module, generation, sha });
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
