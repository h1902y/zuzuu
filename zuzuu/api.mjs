// zuzuu/api.mjs — the one programmatic surface over a brain.
//
// what: a single import that composes the kernel + capabilities into the clean
//       façade every host (CLI veneer, web daemon, plugin) consumes. `open(cwd)`
//       resolves the home once; the returned handle exposes the five verbs plus
//       the gate, snapshots, and proposals — all bound to that home.
// why:  hosts should depend on ONE stable surface, not reach into kernel/ and
//       capabilities/ internals. This is the seam the CLI thins down to and the
//       daemon calls — so the verb set stays legible and swappable underneath.
// how:  thin binding over the registry + the human-gate (review) + snapshot
//       primitives. registerAll() is idempotent, so opening is cheap and safe to
//       repeat. Zero-dep.

import { homeDir, repoRoot } from './kernel/store.mjs';
import { invoke } from './kernel/capability.mjs';
import { listModules, readManifest } from './kernel/module.mjs';
import { registerAll } from './capabilities/index.mjs';
import { createProposal, listProposals, readProposal } from './capabilities/propose.mjs';
import { approve, reject } from './capabilities/review.mjs';
import { generations, rollback, mintCheckpoint, rollbackCheckpoint, listCheckpoints } from './kernel/snapshot.mjs';

/**
 * Open the brain rooted at `cwd` (git-citizen: the `.zuzuu/` at the repo root).
 * @returns a handle bound to that home — the host's entire dependency surface.
 */
export function open(cwd = process.cwd()) {
  registerAll(); // idempotent
  const home = homeDir(repoRoot(cwd));

  return {
    home,
    root: repoRoot(cwd),

    // ── inspection ──────────────────────────────────────────────────────────
    modules: () => listModules(home),
    manifest: (module) => readManifest(home, module),

    // ── the five verbs (dispatched through the one registry) ────────────────
    query: (module, opts = {}) => invoke(home, module, 'query', opts),
    check: (module, opts = {}) => invoke(home, module, 'check', opts),
    act: (module, id, inputs = {}) => invoke(home, module, 'act', id, inputs),
    enhance: (module, opts = {}) => invoke(home, module, 'enhance', opts),
    gate: (module, call) => invoke(home, module, 'gate', call),

    // ── the human gate (review is interactive — not a registry verb) ────────
    propose: (module, p) => createProposal(home, module, p),
    proposals: (module) => listProposals(home, module),
    proposal: (module, id) => readProposal(home, module, id),
    approve: (module, id, opts) => approve(home, module, id, opts),
    reject: (module, id, reason) => reject(home, module, id, reason),

    // ── snapshots (per-module generations + whole-brain checkpoints) ────────
    generations: (module) => generations(home, module),
    rollback: (module, n) => rollback(home, module, n),
    checkpoint: (modules, opts) => mintCheckpoint(home, modules ?? listModules(home).map((m) => m.id), opts),
    checkpoints: () => listCheckpoints(home),
    rollbackCheckpoint: (id) => rollbackCheckpoint(home, id),
  };
}
