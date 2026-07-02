---
title: Session Merge Gate — review before code lands on main
date: 2026-06-27
status: requirements
type: feat
origin: dialogue (session-management model rethink)
---

# Session Merge Gate

## Problem

zuzuu gates **every brain write** through human review — `.zuzuu/` changes only via
`zz stage` → approve (the moat). But a session's **code work** does the opposite: on
`SessionEnd`, `src/sessions/session-git.mjs` `closeSession` **auto-squash-merges the
session branch straight to `main`** — no gate, no review. So the *brain* is gated and
the *code* is not. For a product whose identity is "nothing lands without your yes,"
that asymmetry is the single biggest inconsistency in the model.

## Outcome

The session → `main` squash-merge becomes a **human-gated, reviewable moment**,
everywhere (CLI and workbench), symmetric with the brain gate. A held session branch
and a pending brain proposal become two faces of the same idea — **sessions awaiting
merge ‖ proposals awaiting approval** — both reviewed, both reversible, one mental model.

## Actors

- **Developer** — reviews each ended session's code diff and decides merge / keep / discard.
- **Agent (host CLI)** — produces session work on its branch; never merges to `main`.

## Requirements

### Phase 1 — the gate (CLI-first)

- **R1.** On session END, `closeSession` **holds** the branch instead of auto-merging —
  `main` is untouched, the work sits safely in its worktree/branch.
- **R2.** A merge decision with three outcomes: **Merge** (squash → `main`, delete branch),
  **Keep on branch** (defer — leave it held), **Discard** (drop the branch + checkpoints).
- **R3.** The decision is informed: show the **code diff** (or a summary: files, ±lines),
  the squash title, and the branch's checkpoint count.
- **R4. CLI surface.** The END hook stops auto-merging; ending a session emits a notice
  ("session ended · N changes on `<branch>` — `zz session merge` to land"). The land is
  the existing `zz session merge` / `continue` / `discard` verbs (now the *only* path to
  `main`, not a recovery afterthought).
- **R5. Workbench surface.** `SessionCloseCard` (web) shows the code diff + Merge / Keep /
  Discard **alongside that session's brain proposals** — one review for the whole session
  ("what it changed" ‖ "what it learned").
- **R6.** **Discard is destructive** (drops code + checkpoints) → explicit confirm, reusing
  the existing `--yes` guard / the empty-squash-with-checkpoints protection.
- **R7.** A held branch **never blocks** the next session (agent sessions run in per-session
  worktrees), and remains recoverable via the existing `zz session` verbs.

### Conflict management

- **R8.** **Mergeability is computed and shown before merge** — does the squash apply
  cleanly to *current* `main` (which may have moved while the session was held)?
- **R9.** On conflict, Merge **routes to resolution** rather than failing silently: open the
  branch (`zz session continue`), resolve, then merge. The existing abort-and-restore
  guarantee holds — a conflicted merge never half-lands or strands the user.
- **R10.** Conflict state is **visible** in the review (and the future queue): `ready` vs
  `needs resolve` per held branch.

### Phase 2 — the standing queue (designed-for now, built later)

- **R11.** A persistent **"pending merges" queue** — every held branch awaiting merge, its
  diff, its mergeability, triaged in batch. The code-side twin of the brain's proposal
  queue; where parallel / autonomous agent work lands.
- **R12.** The Phase 1 data model is shaped so the queue is a **clean follow-on** — held
  branches are first-class and queryable (`sessionStatus` / `listSessionBranches` already
  enumerate them), not a rebuild.

## Key Decisions

- **KD1. True gate, not soft.** Hold-before-merge — `main` is never touched without an
  explicit Merge. (Land-then-undo was considered and rejected: post-hoc undo isn't "your
  yes before it lands.")
- **KD2. CLI-first; the workbench mirrors it.** The workbench is a *visual abstraction of
  the CLI*, so the gate lives in core (`session-git.mjs` / `zz session`); the workbench
  surfaces it. The CLI must be correct and complete on its own.
- **KD3. One unified review moment.** Code merge + brain approve share the session-close
  surface — same gate, same mental model.
- **KD4. Auto-merge is opt-in, later.** Default is gated; a per-project "trust — auto-merge
  sessions" toggle is a *future* mirror of the brain's opt-in auto-promote (default gated,
  opt-in automatic, always reversible). Not in scope now.
- **KD5. No blocking.** Worktrees decouple held branches from new sessions, which is what
  makes hold-before-merge viable in the first place.

## Scope Boundaries

- **Not** a full PR-review tool — no line comments, no multi-reviewer approvals. You were
  *in* the session; this is "confirm landing," kept low-friction (the gate's friction goes
  down, never the gate itself).
- **Not** the standing queue in Phase 1 — only the close-moment gate; just don't foreclose
  the queue.
- **No change** to checkpoint cadence, secret exclusion in checkpoints, or the
  abort-and-restore safety — those stay exactly as built.
- **Deferred:** opt-in auto-merge (KD4); assisted/auto-rebase conflict resolution; held-branch
  staleness/expiry.

## Success Criteria

- `main` receives **no session code without an explicit human Merge** — CLI or workbench.
- Ending a session **never blocks** starting the next one.
- A conflicting held branch is **never silently dropped or half-merged** — the user is
  routed to resolve, repo left intact on abort.
- The code-merge review and the brain-proposal review **feel like one gate**, not two
  systems.

## Dependencies / Assumptions

Built on (verified this session):
- `src/sessions/session-git.mjs` — `closeSession` (squash-merge + abort-restore),
  `sessionStatus` / `listSessionBranches`, the `continue|merge|discard` verbs.
- `src/sessions/session-worktree.mjs` — per-session worktrees (Wave B); **agent sessions
  already run in their own worktree**, so held branches don't collide.
- `web/.../SessionCloseCard` (U5) — already surfaces a session's brain proposals at close;
  the merge-review extends it.
- The brain `ReviewQueue` + proposal model — the pattern the Phase 2 merge queue mirrors.

Assumptions:
- Session-git must actually be *running* for any of this to matter — it silently no-ops on
  a **commitless repo** (a separate, known gap: a fresh `git init` has no HEAD to branch
  from). This feature assumes a working session-git; the initial-commit-on-prep fix is its
  prerequisite, tracked separately.

## Open Questions (resolve in planning)

- **Conflict depth:** Phase 1 routes to manual `zz session continue`; is an assisted path
  (attempt rebase, show conflicts inline) worth it, or strictly later?
- **Held-branch staleness:** do old held branches warn/expire? worktree disk-cost reaping
  on daemon restart (overlaps the separate stale-session-reaping gap).
- **Squash message:** editable at review time, or fixed `session: <title>`?
- **"Keep on branch" semantics:** is Keep a distinct acknowledged-defer state vs simply
  not-acting (which today reads as a leftover)? Affects the Phase 2 queue's "untriaged"
  vs "deferred" distinction.
