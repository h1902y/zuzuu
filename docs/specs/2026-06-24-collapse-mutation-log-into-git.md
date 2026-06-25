---
title: "Roadmap idea — collapse the mutation log into git history"
date: 2026-06-24
status: idea — roadmap, not yet designed
---

# Collapse the mutation log into git history

> **Not a committed design — a flagged idea to revisit.** Surfaced while explaining why
> `log.jsonl` and `generations.json` are separate (2026-06-24). Now that generations are
> git-native (a generation = an approve-commit), `git log` already *is* a mutation log,
> so per-module `log.jsonl` may be partly redundant.

## The observation

After the git-native generations change, each module has two "history" artifacts:

- **`generations.json`** — the version chain (rollback index; one entry per git commit).
- **`log.jsonl`** — the append-only mutation journal (one line per create/update/relate/…),
  plus a sibling **`runs.jsonl`** for `zz act` run telemetry.

`git log .zuzuu/<module>/items/` now records every **mutation** as a commit — so `log.jsonl`
duplicates the *event* axis that git history already holds.

## The idea

Derive the mutation journal from `git log` and **drop `log.jsonl`**, keeping only
`runs.jsonl` for the one thing git can't represent: **runs** (a `zz act` execution mutates
nothing → no commit → no git record, but it's still telemetry worth keeping).

End state per module: `module.md · items/ · staged/ · generations.json · runs.jsonl` — one
fewer file, and the mutation trail lives where the bytes do.

## What has to be resolved first (why it's deferred, not done)

1. **Structured fields.** `log.jsonl` carries queryable metadata a commit subject doesn't —
   the driving `staged` id, the `relation` type, the op. Either encode these as commit
   **trailers** (`zz-op:`, `zz-staged:`, `zz-relation:`) and parse them back, or accept a
   thinner journal. Decide the trailer schema.
2. **Readers.** `notes/log.mjs` `read(home, module, 'mutations')` + any digest/check/web
   surface that consumes it would re-source from `git log` (a parse path, slower than a
   JSONL append/read — measure it).
3. **Non-git fallback.** `log.jsonl` works with no git; a git-sourced journal doesn't.
   Fail-soft: outside a repo, the mutation journal is simply empty (acceptable — production
   `.zuzuu/` is always a git repo).
4. **Off-thesis check.** This is the same "lean on git, don't re-implement it" move that
   drove the `.store` cut — so it's directionally consistent. The cost is a git-parse read
   path replacing a cheap file read.

## Scope when picked up

`notes/log.mjs` (mutations → git-sourced; keep `runs.jsonl`), `grow/evolve.mjs` (commit
trailers instead of / in addition to `logMutation`), the readers, and the tests. Out of
scope: `runs.jsonl` (stays), generations (unchanged).
