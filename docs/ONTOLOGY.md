# ONTOLOGY — the entities of zuzuu and how they relate

> **The single canonical map of every load-bearing term** — what each entity *is* and
> how it connects. Defined here once; other docs point here. Companion:
> [`learn/glossary.md`](learn/glossary.md) disambiguates the **overloaded** words and
> holds the **renames** table. Architecture: [`../CLAUDE.md`](../CLAUDE.md) · rationale:
> [`DESIGN.md`](DESIGN.md).
>
> One framing + **four planes**: **the agent** → **data** → **operations** → **surfaces**
> → **identity**. The data hierarchy is **note › module › Project**; operations split into
> **use** (query · act · check) and **grow** (the loop).

## The spine

```
   EVERYTHING IS AN ENVELOPE  (typed markdown + frontmatter):
      a NOTE  ·  a module's manifest (module.md)  ·  a Project's manifest (project.md)

   note ──► MODULE ─────► PROJECT
            (a folder      (the .zuzuu/ home + project.md, one per repo;
             + module.md;   each module's lineage IS its git history)
             generic:
             any goal)

   GROW it (the loop):  observe ─► stage ─► plan ─► review ─► evolve
                        (mine)     (queue)  (set)   (gate)    (write + mint a generation + log)
   USE it (the verbs):  query · act · check
```

## The agent (the framing)

The one idea the rest hangs on: **a host supplies the brain; zuzuu grows the Project.**

- **brain** — the **host agent's reasoning loop + the model**. The host supplies it. *This is the only meaning of "brain"* — never the `.zuzuu/`.
- **host** *(= host agent)* — the coding-agent CLI you already run (Claude Code · Codex · Gemini CLI · OpenCode · pi). zuzuu **wraps** it, never drives it.
- **harness** — the **role**: a loop that wraps a model + tools into an agent. *Hosts are harnesses; zuzuu-codes (Tiers) is our owned one.*
- **the Project** — what **zuzuu grows** for a repo: its modules (the agent's evolving *body* of knowledge), versioned and human-gated. Defined in Plane 1.

*(The deeper `be / run / evolve` framing and the host-anatomy distinctions live in [`DESIGN.md`](DESIGN.md) §3 — rationale, not working entities.)*

## Plane 1 — Data: what a Project's knowledge IS

> The **static substrate** — the agent's knowledge *at rest*. Plane 2 is how it *grows*;
> this plane is *what* grows. Everything here is a plain file, so the agent **queries**
> it on demand instead of stuffing it into context. Code: `src/notes/`.

### The envelope — the atom

Everything in a Project is an **envelope**: one text file that is a **YAML frontmatter
block** followed by a **markdown body**.

```markdown
---
type: action            # the ONE required field — what this envelope IS
title: Rebuild the deck index
run: npm run build:index
tags: [build, cards]
relations: { uses: knowledge:card-schema }
---
Regenerates dist/index.json from src/cards/. Safe to run anytime.   ← the body
```

- **`type`** is the *only* required field and the sole discriminator (`knowledge` · `action` · `rule` · `instruction` · `episode` · `module` · `project`) — not a folder, not a class.
- **`id`** is the filename stem, injected by the caller, **never in the frontmatter** (the file *is* its id): `knowledge/items/card-schema.md` → `card-schema`.
- **frontmatter** takes any keys (only `type` required); a **body** of free markdown follows the fence.

**Five load-bearing properties:** **self-describing** (`type` says what it is — no external
schema) · **tolerant** (unknown keys survive a read→write, so a new field never breaks an
old reader) · **round-trip-exact** (`parse ∘ serialize` is the identity — hand edits and
machine edits coexist without clobbering) · **plain text** (git-diffable, grep-able; the
file is the source of truth) · **one shape, many roles** (a fact, an action, a rule, a
module/Project manifest — all envelopes, differing only by `type`). One shape buys **one
parser** (`notes/note.mjs`) + a generic **index**, not a type system per concept — and every
Plane-2 operation reads or writes envelopes.

### note · module · Project — the three levels

The data nests three deep: the **leaf is an envelope**, and each **container has a manifest
envelope** that declares it.

- **note** — one envelope = one fact, optionally runnable (the leaf). Typed `relations:` to
  other notes make a Project a **graph**; a `run:` field makes the note executable.
  Immutable until CRUD'd through the gate (Plane 2).
- **module** — a goal-shaped collection of notes, declared by `module.md`. **Generic** (no
  per-module code — it differs from another only by its manifest's `note_type` ·
  `capabilities` · `goal`) and an **open set**: the five standard kinds (Knowledge · Memory
  · Actions · Instructions · Guardrails) are *examples*, not a closed taxonomy.
- **Project** — the whole of one repo's accumulated knowledge (every module + note, plus the
  loop's artifacts in Plane 2). One repo → one Project; distinct from the **repo** (the
  code it lives alongside).

### The `.zuzuu/` directory — birth and evolution

A Project is a *directory*, and a **git-citizen**: zuzuu plants `.zuzuu/` at the repo's git
root and **never `git init`s** — it lives *inside* your repo's history, like `.git` itself.

**`project.md` is its identity card.** The Project is the *whole* `.zuzuu/` directory;
`project.md` (`type: project`) declares its identity — title, format version, config —
exactly as `module.md` declares a module (read the small file to know *what* a Project is
without traversing it all).

**Born (`zz init`) — an empty brain.** The honest first-run state, not five empty tiles:

```
.zuzuu/
  project.md                 ← the Project manifest (type: project)
  guardrails/                ← the ONLY module that ships — the safety floor
    module.md
    items/{no-root-wipe, no-secret-reads, confirm-force-push}.md   ← seed rules (type: rule)
```

Only **Guardrails** ships (protection must hold from byte one); the four content kinds
start absent.

**Grows on demand.** As the loop runs, a **module** materializes the first time `observe`
routes a staged change to it (its `module.md` minted from a template), and **notes** accumulate
under `<module>/items/` as staged changes are approved. A real, evolved Project — still flat and
legible, every path a plain file you can open:

```
.zuzuu/
  project.md                          ← the Project manifest (type: project)

  guardrails/                         ← shipped at init, then grown
    module.md
    items/ no-root-wipe.md · no-secret-reads.md · confirm-force-push.md · ask-before-rm.md
    log.jsonl                         ← this module's mutation + run journal
    generations.json                 ← the n→commit ledger (git holds the bytes)

  knowledge/                          ← materialized on its first staged change
    module.md
    items/ card-schema.md · deck-index.md · hot-file-app-tsx.md
    staged/ file-src-db-ts.json       ← awaiting the review gate (not yet a note)
    log.jsonl · generations.json

  actions/
    module.md
    items/ rebuild-index.md · run-tests.md
    log.jsonl · generations.json

  instructions/
    module.md
    items/ always-run-tests-first.md
    log.jsonl · generations.json

  worktrees/                          ← the ONE gitignored entry (live session checkouts)
```

Every module is the *same five things* — `module.md` · `items/` · (optional) `staged/` ·
`log.jsonl` · `generations.json` — so the tree stays uniform however large it grows. That
uniform tree is the **whole** durable Project; no deeper fan-out, because two things stay lean:

- **Generations are git-native** — a module's history *is* its git history: every approve is
  a path-scoped commit, so **generation = commit**, **rollback = `git restore`**, and the tiny
  `generations.json` maps `n → commit`. No parallel blob store ([spec](specs/2026-06-24-git-native-generations.md)).
- **Derived state lives outside the repo (XDG)** — the rebuildable index → `~/.cache/zuzuu/<hash>/index.db`,
  session run-state + the gate log → `~/.local/state/zuzuu/<hash>/`. Only `worktrees/` (live,
  uncommitted work) stays in-repo, gitignored. So `.zuzuu/` is **100% durable, git-tracked** —
  a true git citizen, like `.git` keeping machine-local state out of your tree ([spec](specs/2026-06-24-storage-layout-and-staging.md)).

> `generation · staged change · log` live on disk here but are *produced by the loop* — so
> they're defined in **Plane 2**.

## Plane 2 — Operations (use & grow a Project)

Two things you do with a Project — **use** it and **grow** it — which map exactly to the
two code dirs `src/use/` and `src/grow/`. **Every operation is a `zz` command** (the agent
runs them in its shell; the human at a terminal). Each composes **five reused primitives** —
the *envelope* (`parse`/`serialize`), the *index handle*, the *git-native generation*
(`commit`/`restore`), `diff`, and *the gate*. Invariant: **only Grow writes the Project, and
only through `review`; Use reads + runs.**

### Use — the three verbs (`src/use/`, no Project write)

Each verb heads a small **family** of read/run commands.

- **query** — *retrieve*: full-text search + graph walk (BM25-ranked). *Family:* `view` (page a long body) · `links` (inbound backlinks + out-walk) · `diff` (note↔note · generation↔generation) · `log` (the evolution timeline) · `as-of` (read a module at a past generation).
- **act** — *run procedural knowledge*: execute a runnable note, gated + allowlisted. *Family:* `flow` (a `type: workflow` note — a gated DAG of run-steps, compensating on failure).
- **check** — *integrity*: broken links · orphans · stale. *Family:* `validate` (type-keyed schema check).

### Grow — the loop (`src/grow/`, every write human-gated)

How a Project changes. **Five beats** — `snapshot` is *not* a beat: minting a generation is
part of evolve (write and mint never happen apart).

- **observe** — mine the host's own on-disk transcript (never drives the agent — *adding a host = one adapter file*); aggregate corroborated per-session signals and **route** each to the right module → staged changes.
- **stage** — the typed, deduped, ranked **staged-change** queue (`<module>/staged/`). *(Renamed from `propose`: the noun collided with the verb; `staged → review → evolve` mirrors git's `staged → committed`.)*
- **plan** — bundle a module's pending set into ONE content-addressed **change-set** + its diff; writes nothing (a dry-run). The gate then approves a *set*, applied as one generation (Terraform `plan → apply`; the plan id is a TOCTOU guard). A single change is a plan-of-one.
- **review** — **the human gate**: approve or reject. *"The gate is the moat"* — the one door to a Project. `validate` runs first; a malformed note is refused before it lands.
- **evolve** — the **execution** of an approve: **write the note + log it + mint a generation** (one beat; the mint = the snapshot). For a batch, the writes apply then mint *once*.

*Direct grow edits (outside the loop — the operator running the command is the gate):* the
graph-safe refactors `rename` · `merge` · `refactor` (rewrite a field), the scoped edits
`patch` · `append`, and `rollback`. Each lands as a generation.

### The two gates (different things)

- **the review gate** *(= `review`)* — **write-time, human, fail-closed**: nothing enters the Project without it. Governs *writes to the notes*.
- **the tool gate** *(= the **guardrails gate**)* — **runtime, enforced, fail-open**: the `PreToolUse` check that blocks/asks on a tool call in real time (rules are `type: rule` notes; deny > ask > allow). Governs *the running session's tool I/O*. *(The host lifecycle hook — open/turn/end — is what sequences observe + grounding + these gates; it's a surface, Plane 3.)*

Full operation vocabulary + build status (Tier 1–2 shipped):
[`specs/2026-06-24-plane2-operation-vocabulary.md`](specs/2026-06-24-plane2-operation-vocabulary.md).

## Plane 3 — Surfaces (how you reach a Project)

A Project exists independently of any surface. The two paths share one door:

```
   CLI (zz) ───────────────────────────────────────────►  serve/api  ──►  a PROJECT
                                                                          (direct, in-process)
   Workbench (browser) ──► the daemon ──(shells `zz`)───►  serve/api  ──►  a PROJECT
                                                                          (same door, gated)

   A SESSION ≡ a git branch:
      a host CLI runs in a session  →  its own git worktree  →  squash-merged on exit
```

**Why the daemon shells the CLI** (not write files directly): **one door to every write** — every mutation goes through the gated CLI, so the browser physically can't bypass the review gate (the daemon never imports `grow/`). That's the integrity boundary, not indirection for its own sake.

- **the CLI** — `zz` (and `zuzuu`): the command surface. `bin/zuzuu.mjs` → `src/cli/` → `src/serve/api`.
- **the daemon** — the **long-lived local process** (binds `127.0.0.1`) that owns the PTYs + filesystem and serves the workbench. Shells the `zz` CLI for every write.
- **the workbench** — the **browser visual surface**: terminal + file explorer + Monaco editor + the **modules dashboard** + the **composer**. A **view onto a Project, served by the daemon** — *not* the Project itself.
- **the modules dashboard** — the workbench's "modules mode" panel: per-module generations + approve/reject. The browser face of `review`.
- **the composer** — the workbench's **agent-session input**: a **remote keyboard** into the host's TUI (types your message into the live host CLI; never drives it headlessly).
- **session** *(= a git branch)* — the lifecycle unit: a `zz/session-*` branch (open → branch, turn → checkpoint, end → squash-merge). **"session = git branch."** *(Overloaded with the daemon's PTY `Session` — see [glossary](learn/glossary.md).)*
- **worktree** — a **per-session git worktree** under `.zuzuu/worktrees/` → **N concurrent agents** without clashing on the one working branch. Machine-local, gitignored — the one in-repo non-durable entry (it holds live, uncommitted work, so it's never treated as cache).

## Plane 4 — Identity & naming

- **zuzuu** — **the product / system / CLI** (`zz`, package `@zuzuucodes/cli`), and the home dir name (`.zuzuu/`). *No longer overloaded with the per-repo entity* — that's a **Project** now.
- **Project vs repo** — a **Project** is the `.zuzuu/` (the zuzuu entity, *note › module › Project*); the **repo** / codebase is the code it lives in. Keep them distinct.
- **the home / `.zuzuu/`** — the directory that holds a Project.
- **historical names** — `motorsandsensors`/`mns`, `zuzuagents`/`zuzu` → **zuzuu**. Expected in older docs (see the [glossary renames table](learn/glossary.md)).

## Tiers (where it's going) — linked out

How zuzuu is packaged & sold is *strategy*, not core ontology — the full model lives in
[`specs/2026-06-22-tiered-architecture.md`](specs/2026-06-22-tiered-architecture.md). In one breath: **OSS** (free, local, solo — the built product) ⟷ **Pro** (paid, hosted VM) on the *compute* axis; (OSS/Pro) ⟷ **Enterprise** (org admin control-plane) on the *control* axis; **zuzuu-codes** (our owned harness, credits-metered) cuts across. Pinned by *100% git-native, no live API* — so cross-project is a **roll-up** + an **org module registry** (a git workflow), never one big Project.

## Reading order

**Spine → the agent (framing) → Plane 1 (data) → Plane 2 (operations) → Plane 3 (surfaces).** Then Plane 4 (names) and the tiers pointer. For *same-word-two-meanings* cases, jump to [`learn/glossary.md`](learn/glossary.md).
