---
title: "Git-native generations — drop the parallel content store, let git version the brain"
date: 2026-06-24
status: live spec, unshipped
---

# Git-native generations

> **Why now.** Maturing `ONTOLOGY.md` Plane 1 (the `.zuzuu/` directory) surfaced a real
> discomfort: the evolved directory fans out intimidatingly, and the worst offender —
> `.generations/.store/<hash>` — **re-implements git's own object database inside a git
> repo.** In a system whose thesis is *100% git-native*, that's redundant. This spec
> redesigns generations to lean on git itself, collapsing the directory to its legible core.

## The problem

Today a generation is a per-module JSON manifest (`{n, parent, root, items:{id→hash}}`) plus
a **content-addressed blob store** at `.zuzuu/.generations/.store/<hash>` — one blob per
note-version, fanned into 2-char subdirs. This is `git/objects/` rebuilt by hand:

- **Redundant.** Git already content-addresses, dedups, and immutably versions every tracked
  file. `.zuzuu/<module>/items/*.md` are *already committed to git*; the store keeps a second
  copy of every past version git is also keeping in history.
- **Bloats the repo + miserable on GitHub.** Thousands of opaque blob files the user can't
  browse, diff, or reason about — the opposite of "manage it well with how GitHub operates."
- **Off-thesis.** We rebuild rollback (`pointer-flip + content restore`) on a homegrown store
  when `git restore` is the same operation, battle-tested.

## The realization that makes this easy

Generations *look* like they'd collide with session-git's squash-merge (sessions checkpoint
per turn and **squash** on end — mid-session commits vanish). They don't, because **approval
is out-of-band.** The loop is: a session does code work (squashed cleanly) → at session end
`observe` *stages proposals* → **later, the human runs `zz review approve`** as a deliberate
action, *not inside a session branch*. So an approve-commit lands on the working branch as a
**stable, non-squashed commit**. Generations and session-squash never touch.

## The design

**A generation = the git commit an approve produces.** The lineage of a module *is* the git
history of `.zuzuu/<module>/items/`.

- **`evolve` (on approve)** writes the note, then makes a **scoped commit** touching only the
  brain: `git commit -- .zuzuu/<module>/ -m "zz: <op> <module>:<id>"`. The user's uncommitted
  *code* changes are untouched (a path-scoped commit). It appends one line to a tiny
  **per-module ledger** `.zuzuu/<module>/generations.json` — `{n, commit, mintedAt, mintedFrom}`
  — no blobs, no `root` re-hash, no `.store`.
- **`rollback(module, n)`** looks up the commit from the ledger and
  `git restore --source=<commit> -- .zuzuu/<module>/items/`, prunes any note absent from that
  commit's tree, and commits the restore as a **new** generation (rollback is forward motion,
  immutable history — never a `git revert` of the ledger).
- **Content at any generation** is `git show <commit>:.zuzuu/<module>/items/<id>.md` — git's
  objects ARE the store. Dedup, immutability, content-addressing: free.

**The directory collapses** to exactly the legible core:

```
.zuzuu/
  project.md
  <module>/   module.md · items/*.md · proposals/*.json · log.jsonl · generations.json
  .live/ .index.db          ← gitignored, ephemeral (unchanged)
```

No `.generations/`, no `.store/`. `.worktrees/` stays (session concurrency, gitignored). The
durable Project is now *only* manifests + notes + proposals + logs + a small ledger — all
human-legible, GitHub-browsable, and git-versioned.

## The one real decision: approve → a commit

This couples a brain write to a git commit. **Recommended: yes**, because it *is* the
git-native payoff and it sharpens the moat — every brain mutation becomes an **attributed,
timestamped commit** in the user's repo (exactly what the Enterprise audit story wants:
*"governance changes are commits, not API calls"*). Requirements for it to be safe:

- **Path-scoped + additive** — commit only `.zuzuu/<module>/` paths; never `git add -A`, never
  touch the user's code changes.
- **Fail-soft** — if git is mid-merge / detached HEAD / the commit fails, the note is still
  written to disk (the file is the source of truth); the generation is reconciled on the next
  successful commit (a `doctor`-style heal). A failed commit must never lose the approval.
- **Identity** — commits authored as the human who approved (review is interactive); the
  config falls back to a `zz` identity only if git has none.

(If a user truly wants no auto-commits, a `project.md` config flag could defer to manual
`git commit` + a `zz generation sync` — an open question, not the default.)

## How it meshes with session-git

- **Sessions** (a `zz/session-*` branch, turn-checkpointed, squash-merged) handle *code* work
  and are unchanged. **Generations** are out-of-band approve-commits on the working branch.
  Two separate commit streams, no interaction.
- **Pro/sync (Tiers)** improves: the brain's history is plain git history — `git pull` syncs
  generations across machines for free (no blob-store transport, which the brain-sync work had
  to special-case for `.store/`).

## Open questions (resolve in build)

1. **Ledger vs pure git.** Keep the tiny `generations.json` (fast `zz module <m> generations`
   without shelling git log), or derive n→commit purely from `git log .zuzuu/<m>/items/`? The
   ledger is cheaper to read and survives a squash of the items path; lean ledger.
2. **Numbering across history rewrite.** If a user rebases `.zuzuu/` history, ledger commit
   shas dangle. Heal: `doctor` re-pins the ledger to reachable commits, or generations tolerate
   a missing commit (fall back to the working tree). Low-frequency; fail-soft.
3. **The merkle `root`.** Drop it (git's tree sha is the content identity) or keep a cheap
   derived `root` for the digest? Likely drop — `commit` is the identity.
4. **Whole-Project rollback.** Per-module is the unit; a Project-wide "roll everything to a
   point" = a single commit across modules. Out of scope (per-module composes it).

## Migration

There are no shipped multi-user Projects, so **no back-compat is required** — `init`/`evolve`
write the new shape; existing dogfood `.zuzuu/.generations/.store/` is deleted, and the current
note bytes (already in git) are the new gen-1. A one-shot `zz generation migrate` (or just
re-init the lineage from `git log`) covers the dogfood repos.

## Scope / non-goals

- **In:** the generation mechanism (`notes/generation.mjs` → git-backed), `evolve`'s
  approve-commit, `rollback` via `git restore`, the per-module ledger, the directory collapse,
  the `brain-sync` simplification (no `.store/` to ship).
- **Out:** the ontology *prose* (this spec settles the directory; the ONTOLOGY directory
  section is rewritten once this lands); session-git (unchanged); the workbench; whole-Project
  rollback; a config flag for manual-commit mode (noted, not built).

## Verification

Characterization-first on `generation`/`rollback` (the existing loop + brain-sync tests pin
mint/rollback/dedup/prune semantics — they must stay green through the git swap, against a real
temp git repo). The proof: after `zz review approve`, `git log .zuzuu/<m>/items/` shows the
approval as a commit; `zz module <m> rollback <n>` restores via `git restore` and the on-disk
notes match `git show <gen-n-commit>:…`; the `.zuzuu/` tree has **no `.generations/.store/`**;
and a `git clone` + `rollback` round-trips with **zero special-cased blob transport**.
