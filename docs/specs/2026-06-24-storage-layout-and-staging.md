---
title: "Storage layout & the staging rename — .zuzuu/ becomes 100% durable; derived state goes to XDG"
date: 2026-06-24
status: shipped 2026-06-24
---

# Storage layout & the staging rename

> **Why now.** Maturing `ONTOLOGY.md` Plane 1, the evolved `.zuzuu/` tree still fans out into
> three machine-local artifacts (`.live/`, `.worktrees/`, `.index.db`) tangled in among the
> durable notes, plus a `proposals/` queue whose noun collides with the loop *verb* `propose`.
> Three parallel researchers (XDG/git/Cargo/Next.js prior art + a codebase map) converged on a
> clean end-state. This spec records the two accepted decisions and their blast radius.
> Companion: [`2026-06-24-git-native-generations.md`](2026-06-24-git-native-generations.md) —
> together they define the final `.zuzuu/` shape.

## Decision 1 — derived state leaves the tracked tree (XDG)

The governing principle (git's `.git` vs nothing-in-tree, Cargo's `target`→`~/.cargo`, Next's
`.next/cache`): **rebuildable caches and machine-local runtime state do not belong among
version-controlled source — even gitignored.** The three artifacts are three categories:

| Artifact | Category | Goes to | Why |
|---|---|---|---|
| `.index.db` | rebuildable cache | `~/.cache/zuzuu/<repo-hash>/index.db` | pure derived data (FTS5 + graph), rebuilt on mtime-staleness; XDG_CACHE_HOME is its textbook home |
| `.live/` | transient runtime state | `~/.local/state/zuzuu/<repo-hash>/` | session scratch (digest brief) + a gate-decision log; XDG_STATE_HOME, portable across macOS/Linux (XDG_RUNTIME_DIR is Linux-only) |
| `.worktrees/` | **real working trees w/ uncommitted work** | **stays** under zuzuu (un-dotted `worktrees/`) | git's own model (`.git/worktrees`); **never a cache** — losing one loses user work |

**The shared resolver (build once).** A `repo-hash` keys both XDG dirs:
`sha256(gitToplevel)[:16]`. Honor `XDG_CACHE_HOME` / `XDG_STATE_HOME` when set, else
`~/.cache/zuzuu/` and `~/.local/state/zuzuu/`. `store.mjs` already resolves the git toplevel —
add `cacheDir(home)` and `stateDir(home)` beside the existing `liveDir`/`generationsDir`.

**The payoff:** `.zuzuu/` becomes **100% durable, git-tracked Project** — `project.md` +
modules (`module.md` · `items/` · `staged/` · `log.jsonl` · `generations.json`) + `worktrees/`
(the lone gitignored entry, because it holds live work). `IGNORE_LINES` in `init.mjs` shrinks
from three lines to one. The narrow `Read(.zuzuu/.live/**)` self-deny rule (`enable.mjs`)
**disappears** — the agent can't reach `~/.local/state`, so there's nothing to fence off.

**Code sites (from the codebase map):**
- `src/notes/index.mjs:24` `dbPath` → `join(cacheDir(home), 'index.db')`. Single owner; trivial.
- `src/notes/store.mjs:54` `liveDir` → `stateDir(home)` (rename to `runDir`/`stateDir`).
  Consumers (`hosts/hook.mjs`, `serve/digest.mjs`) take it from `store.mjs`, so they follow free.
- `src/cli/enable.mjs:27` — **delete** the `.zuzuu/.live/**` deny rule.
- `src/cli/init.mjs:68–72` `IGNORE_LINES` → just `.zuzuu/worktrees/` (drop `.live/`, `.index.db`).
- `worktrees/` is the only relocation NOT made — keep `session-worktree.mjs:35,51` as-is, but
  drop the leading dot (`.worktrees` → `worktrees`) at both the path constructor and the
  `inSessionWorktree` detector (they must change together or detection breaks).

**Tradeoff accepted:** a second on-disk location (the XDG dirs) and a repo→hash mapping, in
exchange for a clean tracked tree, no accidental-commit surface, and XDG-correctness. A cold
cache is a no-op (it rebuilds), so relocation is the lowest-risk possible move.

## Decision 2 — `propose → stage`, `proposals/ → staged/`

The loop's second beat is renamed to resolve the verb/noun collision and import git's exact
pending-approval mechanic (**staged → review → committed** maps 1:1 onto **staged → the gate →
evolved**). The loop becomes:

```
observe ──► stage ──► review ──► evolve
```

- **verb:** `propose` → `stage` (mine + route + dedupe into the queue).
- **directory:** `<module>/proposals/` → `<module>/staged/` (still tracked, still durable — the
  review queue + its `archive/` audit trail are Project state, not cache).
- **item noun:** "a proposal" → **"a staged change"**.
- **id prefix:** `prop-` → `stg-` (golden-id regression tests regenerate from a real run).

**Blast radius (rename, not redesign — behavior is unchanged):**
- `src/grow/propose.mjs` → `src/grow/stage.mjs`; `propDir`/`archiveDir` (lines 17–18) → `stagedDir`;
  `createProposal` → `stageChange`; `listProposals`/`readProposal` → `listStaged`/`readStaged`;
  `propId` prefix (line 21).
- callers: `src/grow/observe.mjs:171`, `src/grow/review.mjs:22,31`, `src/serve/digest.mjs:25`,
  `src/serve/wire.mjs` (the verb binding), `src/cli/` (the `stage` lifecycle command + help),
  `src/cli/init.mjs:99` (pre-creates `guardrails/staged/`).
- tests: the ~unit files asserting `proposals`/`createProposal`/`listProposals`.
- docs: `CLAUDE.md`, `docs/learn/`, `docs/ONTOLOGY.md`, the wiki — `observe → propose` →
  `observe → stage`; "proposal" → "staged change". (ONTOLOGY updated with this spec; the rest
  follow when the code lands, to avoid claiming an unbuilt rename as shipped.)

**Not renamed:** the **review gate** verb stays `review`; `evolve` stays `evolve`; `observe`
stays. Only the second beat moves. (`candidates` stays the upstream-signal word in `observe` —
it names the raw mined signal *before* staging, so the observe→stage boundary stays crisp.)

## How the two decisions compose

After both this spec and the git-native-generations spec land, a grown `.zuzuu/` is:

```
.zuzuu/                         ← 100% durable, git-tracked
  project.md
  <module>/  module.md · items/*.md · staged/*.json · log.jsonl · generations.json
  worktrees/                    ← the ONE gitignored entry (live checkouts)

~/.cache/zuzuu/<repo-hash>/index.db          ← rebuildable cache (XDG)
~/.local/state/zuzuu/<repo-hash>/            ← session run-state + gate log (XDG)
```

## Scope / non-goals

- **In:** the XDG relocation (`cacheDir`/`stateDir` resolver + the four code sites), the
  `worktrees/` un-dotting, deleting the `.live` deny rule, and the `propose → stage` /
  `proposals → staged` rename (verb, dir, file, ids, callers, tests).
- **Out:** the generations redesign (its own spec); any behavior change to staging/review/the
  gate (this is a rename + relocation, semantics identical); migration of *existing* dogfood
  `.zuzuu/.live`/`.index.db` (just delete them — they rebuild); the wiki push (hand-authored).

## Verification

- Root `npm test` + `cd web && npm test` green through each step; characterization-first on the
  gate-adjacent `stage`/`review` rename (pin behavior, then rename — ids regenerated from a real
  run, never hand-computed).
- Proof of placement: after a session + an approve, `.zuzuu/` contains **no** `.index.db`,
  `.live/`, or dotfile cache; `~/.cache/zuzuu/<hash>/index.db` exists and `zz query` works
  against it; `git status` shows `.zuzuu/` fully tracked with only `worktrees/` ignored.
- Proof of rename: `zz stage`/the loop produce `<module>/staged/*.json`; `zz review approve`
  still evolves a staged change into a note; no `proposals` path or `propose` verb remains in
  `src/` or the CLI surface.
