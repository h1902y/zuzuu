---
title: "Plane 2 — the exhaustive operation vocabulary (rationalized)"
date: 2026-06-24
status: Tier 1–2 BUILT 2026-06-24 (feat/plane2-operations); Tier 3 deferred-with-reason
---

# Plane 2 — the operation vocabulary

## Build status (2026-06-24)

**Tier 1–2 shipped** on `feat/plane2-operations` (189→220 tests, green per commit):
diff (note + generation) · the change-set `plan`/`apply` (batch→one generation,
TOCTOU-guarded) · inbound backlinks + empty-result signal · BM25/snippet/prefix
search · rename/merge/refactor-field with link-update · scoped `patch`/`append` +
windowed `view` · `--as-of` time-travel + `zz log` timeline · pre-write `validate` +
post-write integrity nudge · `type: workflow` runner (gated DAG + compensation).

**Deferred, with reason** (not gaps — deliberate): incremental-FTS5 index rewrite
(scale-only; full rebuild self-heals + is skipped when unchanged) · generation
prune/retention + pin (git history *is* retention) · vector/semantic search
(sqlite-vec is pre-v1 + needs a native `.so` → off the zero-dep core) · UUID note ids
(breaks id=filename) · workflow per-step idempotency-key/resume (Temporal-grade).

> **What this is.** The complete, prior-art-grounded set of operations an agent (and the
> human gate) performs on a Project, rationalized into six families over a tiny reused
> primitive set. Produced by maturing `ONTOLOGY.md` Plane 2 from a bullet list into a real
> decomposition (the action→command tree), then fanning out **five parallel researchers** to
> pressure-test exhaustiveness against filesystem / VCS / DB / search / note-graph prior art.
> This is the reference we build Plane 2 toward; nothing here is shipped yet.

## Provenance — the five research streams

1. **Agent–Computer Interface** — SWE-agent ACI (NeurIPS 2024), MCP filesystem server, aider
   edit formats, OpenHands, Claude Code tools. *What agent-facing ops + ergonomics are elegant.*
2. **Content-addressed / snapshot stores** — git object model, **Nix generations**, OSTree,
   restic/borg, Datomic, ZFS/btrfs, jj, Fossil. *Versioning op vocabulary.*
3. **Embedded index + search + performance** — SQLite FTS5/WAL, Tantivy/Lucene, ripgrep,
   sqlite-vec, Datasette, phiresky's pragma stack. *Search ops + perf patterns.*
4. **Workflow / transaction / plan-apply** — Terraform `plan→apply`, Nix, DB transactions +
   sagas, event sourcing, Ansible `--check`, git staging. *The workflow/transaction gap.*
5. **Linked-note graph** — Obsidian, Logseq, Dendron, Foam, org-roam, Tana. *Graph-refactor ops.*

## Where the research converged (the high-confidence gaps)

Eight gaps surfaced in **two or more** independent streams:

| Convergence | Surfaced by | The gap (vs today) |
|---|---|---|
| **Change-set / plan object** | Workflow · ACI · Snapshot | zuzuu *is* `plan→apply` minus the saved-plan. The gate approves one card → one commit each; no atomic review+apply of a **set**. |
| **`diff` as a first-class read** | Snapshot · ACI · Workflow | **No `diff` anywhere** — not note↔proposed, not gen↔gen. Everything downstream needs it. |
| **Rename/move with link-update** | Graph (#1) · ACI · Snapshot | Every reorganizing `evolve` accrues broken-link debt; `check` only catches it after. |
| **Inbound backlinks** | Graph · ACI | The SQLite edge table holds inbound edges; only the outbound walk is exposed. `query --to` is nearly free. |
| **Scoped edits over whole-note rewrites** | ACI · Graph | All writes are full-note `evolve`; no "update one frontmatter key" / "append one line." |
| **Windowed `view` + output-mode escalation** | ACI | `query` returns TOON summaries; no paged body read of a long note, no `ids→summary→full`. |
| **Search quality + index perf** | Index · ACI | No BM25 ranking/snippets/prefix; index **full-rebuilds on every stale open** instead of incremental. |
| **Pre-write validation + post-write integrity** | ACI | Nothing validates a note before `evolve` writes it; `check` after is manual. |

**The keystone** (streams 2+4 independently): a content-addressed **change-set** the gate
approves whole and applies as **one transactional generation** — closing batch-apply, dry-run
diff, idempotency, and all-or-nothing atomicity together, via pure reuse of `stageId` hashing +
`mint` + `git restore`.

## The rationalized taxonomy — six families

Every agentic project operation, over five reused primitives (the **envelope** `parse`/
`serialize`, the **index handle**, the **git-native generation** `commit`/`restore`, the new
**`diff`**, the **gate**):

```
READ        (no gate — observe knowledge)
  query        FTS + filters  ＋ BM25 rank · snippet() · prefix/NEAR · facets · more-like-this · ids|summary|full
  view <id>    NEW — windowed body read (offset+limit, PARTIAL notice)
  links <id>   ENRICH — outbound walk ＋ inbound backlinks (--to) · shortest-path
  check        integrity (broken/orphan/stale)
  diff         NEW — note↔proposed · gen↔gen  (the foundational primitive)
  log          NEW — unified timeline (mutations + sessions + gate decisions)
  as-of <gen>  NEW — time-travel query at a past generation

WRITE       (human-gated — the loop)      observe → stage → [plan] → review → evolve → snapshot
  evolve ops:  create · update · delete · relate · deprecate
               ＋ move/rename (link-update) · merge · split · patch <key> · append · refactor --field
  plan         NEW — gather staged changes → ONE content-hashed change-set, render diff, write nothing
  apply        NEW — consume a plan → ONE transactional evolve → ONE generation/commit (all-or-nothing)
  validate     NEW — schema/integrity check BEFORE the write (reject malformed)

RUN         (gated + allowlisted — procedural knowledge)
  act          single run (existing)
  workflow     NEW (Tier 2) — type:workflow note: DAG of run-steps w/ depends-on · compensate · key

VERSION     (per-module, git-native)
  generations · rollback (existing)
  ＋ diff <a> <b> · prune/retention · pin (GC-root) · fork · bisect

ENFORCE     tool gate (PreToolUse) — runtime, fail-open · distinct from the review gate
ORCHESTRATE hook lifecycle (OPEN/TURN/END) — sequences observe + digest + the gates
```

**The succinctness payoff:** the WRITE family collapses to one pipeline (`stage → plan → gate →
apply`) with one rich op-set; `diff` is the single read primitive powering preview, plan, review
context, and gen-history; READ is "one index handle, different projections."

## Ranked path (value-for-effort, reconciled with zero-dep · git-native · the moat)

**Tier 1 — adopt now (cheap, high-leverage, mostly pure reuse):**
1. **Change-set/plan + atomic apply** — `zz review plan` (diff the pending set, write nothing) →
   `zz review apply <plan-id>` (one transactional generation). Reuses `stageId`/`mint`/`git restore`.
2. **`diff` primitive** — gen↔gen via `git diff`; note↔proposed via structured frontmatter+body diff.
3. **Index perf** — one DB-open per action (attach to `serve/api.open`'s handle); **WAL +
   `synchronous=NORMAL`** (drop the crash-unsafe `OFF`); **incremental FTS5** via external-content
   table + triggers (kills the 157ms full rebuild-on-stale).
4. **Search quality** — `ORDER BY bm25(...)` as `rank`, `snippet()` previews, prefix/NEAR (all
   free FTS5 features, just unsurfaced).
5. **Inbound backlinks** (`links --to`) + **empty-result signal** for `query`.

**Tier 2 — next (real value, modest effort):**
6. **Rename/move with link-update**, **merge**, **refactor --field** — graph integrity at write time.
7. **Scoped writes** — `patch <id> <key>`, `append <id>` (smaller, legible gated diffs) + **`view`**.
8. **Generation maturity** — `prune`/retention (restic-style policy in `module.md`), **`pin`** (Nix
   GC-root), **`as-of`** time-travel, unified **`zz log`** timeline (Fossil-style).
9. **Pre-write `validate`** + auto-`check` post-evolve, feeding the review context.
10. **`type: workflow` runnable note** — DAG of `run` steps with `depends-on`/`compensate`/`key`,
    gated per step; the one place saga/compensation/idempotency machinery is warranted (external
    side-effects). Extend `use/act.mjs` to a step list; event-source progress into `log.mjs`.

**Tier 3 / deliberately deferred (with reason):**
- **Vector/semantic search** — sqlite-vec is pre-v1 + needs a native `.so` → against the zero-dep
  core. Reserve an `embedding BLOB` schema slot; wire later behind a local embed model.
- **UUID note ids** — makes rename free (org-roam) but breaks "id = filename, everything is a plain
  file." Keep filename ids; solve rename via index-driven link-rewrite (bounded scan cost).
- **Full sagas/compensation for note CRUD** — unneeded: notes are pure data, `git restore` *is* free
  rollback. Compensation applies only to `type: workflow` (shell side-effects).
- **bisect / fork-a-module / transclusion / static-deltas / incremental re-derivation** — elegant,
  low urgency; revisit at scale.

## The single most elegant idea to steal, per system

- **Terraform** — the saved plan: `apply` applies *exactly* the reviewed set (no TOCTOU re-plan).
- **Nix** — GC roots: a *pinned* generation is immune to prune; "important" ≠ "recent."
- **restic** — retention DSL (`--keep-last/daily/monthly`) living in `module.md` frontmatter.
- **Datomic** — `as-of` as a first-class parameterized read, not a checkout.
- **git** — `reflog` as the undo buffer (log rejected/no-op gate decisions too, not just approvals).
- **Fossil** — all artifact types on one timeline (`zz log` across modules + sessions + gate).
- **SWE-agent** — linter-before-edit: validate before the side effect, return a structured error.
- **Obsidian/Dendron** — rename propagates to every backlink atomically.
- **aider** — never address edits by line number; scoped search/replace (for zuzuu: frontmatter-key patch).

## Scope when picked up

Touches `use/` (query/view/links/diff/check), `grow/` (stage/plan/apply/evolve op-set/validate),
`notes/index.mjs` (perf + search + backlinks), `notes/generation.mjs` (diff/prune/pin/as-of/fork),
`use/act.mjs` (workflow steps), `serve/api.mjs` (the handle + new verbs), `cli/`. Each Tier is its
own workstream; Tier 1 items 1–2 (plan + diff) are the highest-leverage starting point.
