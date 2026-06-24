# ONTOLOGY — the entities of zuzuu and how they relate

> **The single canonical map of every load-bearing term** — what each entity *is* and
> how it connects. Defined here once; other docs point here. Companion:
> [`learn/glossary.md`](learn/glossary.md) disambiguates the **overloaded** words and
> holds the **renames** table. Architecture: [`../CLAUDE.md`](../CLAUDE.md) · rationale:
> [`DESIGN.md`](DESIGN.md).
>
> One framing + **four planes**: **the agent** → **data** → **the loop** → **surfaces**
> → **identity**. The data hierarchy is **note › module › Project**.

## The spine

```
   EVERYTHING IS AN ENVELOPE  (typed markdown + frontmatter):
      a NOTE  ·  a module's manifest (module.md)  ·  a Project's manifest (project.md)

   note ──► MODULE ─────► PROJECT
            (a folder      (the .zuzuu/ home + project.md, one per repo;
             + module.md;   each module's lineage IS its git history)
             generic:
             any goal)

   THE LOOP grows it:   observe ──► propose ──► review ──► evolve
                        (mine the    (ranked,    (the gate,   (write the note +
                         transcript)  deduped)    human)       mint a generation + log)
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

**Structure.**
- **`type`** — the *only* required field. It names what the envelope is (`knowledge`,
  `action`, `rule`, `instruction`, `episode`, `module`, `project`). The **type**, not a
  folder and not a class, is the discriminator.
- **frontmatter** — typed scalar / list / map fields. Any keys are allowed; only `type`
  is required; **unknown keys are preserved round-trip-exact** (a reader that doesn't
  recognize a key keeps it intact).
- **body** — free markdown prose below the closing fence.
- **`id`** — the **filename stem**, injected by the caller, **never stored in the
  frontmatter** (the file *is* its id). `knowledge/items/card-schema.md` → id `card-schema`.

**Properties** (each is load-bearing, not incidental):
- **Self-describing** — `type` tells any reader what it's holding; no external schema is
  needed to interpret a file.
- **Tolerant** — unknown keys survive a read→write, so a field added by a newer version
  never breaks an older reader (forward- and backward-compatible).
- **Round-trip-exact** — `parse ∘ serialize` is the identity (read a file, write it back,
  byte-for-byte unchanged). This is what lets **hand edits and machine edits coexist**
  without one silently clobbering the other.
- **Plain text** — git-diffable, grep-able, human-readable; no database, no binary. The
  file is the source of truth.
- **One shape, many roles** — a fact, a runnable action, a guardrail rule, a module's
  manifest, the Project's manifest are *all envelopes*, differing only by `type`.
  **"Everything is an envelope."**

**How it helps.** One shape means **one parser/serializer** (`notes/note.mjs`) instead of
a parallel type system per concept. Tolerance + round-trip-exactness give **safe
evolution**: the format can gain fields with no migration, and the human gate can edit a
note by hand without the machine overwriting it. Self-description lets the **index** ingest
any envelope generically.

**How it ties to Plane 2 (the operations).** The envelope is the **unit every loop
operation touches** — Plane 1 defines the *thing*, Plane 2 is the verbs that read and write it:
- **observe** emits envelope-shaped changes (a *proposal*'s `change` is the frontmatter +
  body of a note-to-be).
- **review → evolve** *serializes an envelope* to disk — that is the only write to a Project.
- a **generation** content-addresses the exact bytes of every envelope in a module.
- the **index** parses every envelope into queryable rows + a typed link graph.

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

**`project.md` declares it — the territory and its identity card.** The **Project** is the
*whole* `.zuzuu/` directory (the territory); **`project.md`** is the one envelope
(`type: project`) that **declares its identity** — title, format version, project-wide
config — exactly as `module.md` declares a module. Read the small `project.md` to know
*what* a Project is without traversing all of it.

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
routes a proposal to it (its `module.md` minted from a template), and **notes** accumulate
under `<module>/items/` as proposals are approved. The clean durable core stays legible:

```
.zuzuu/
  project.md
  <module>/   module.md · items/*.md · proposals/*.json · log.jsonl · generations.json
  …                                                  (modules materialize as they're grown)
```

That tree is the *whole* durable Project — there is no deeper fan-out. **Generations are
git-native, not a parallel store.** A module's history *is* its git history: every approve
writes the note and makes a **path-scoped commit** to `.zuzuu/`, so a **generation = that
commit** and **rollback = `git restore`** from a past one. The tiny `generations.json` ledger
maps `n → commit`; git's own objects hold every past version — no `.generations/.store/`
blob store (re-implementing git's object DB *inside* a git repo was the redundancy we cut).
The only non-durable entries are gitignored and ephemeral: `.live/` · `.worktrees/` ·
`.index.db`. Mechanism + the approve↔commit decision:
[`specs/2026-06-24-git-native-generations.md`](specs/2026-06-24-git-native-generations.md).
*(The current build still carries the legacy `.store`; it is being retired to this form.)*

> **generation · proposal · log** are produced *by the loop* as a Project evolves — so they
> are defined in **Plane 2**, even though they live on disk under `.zuzuu/`.

## Plane 2 — The loop (how a Project grows)

The compounding engine. Invariant: **only `grow/` writes the Project, and only through `review`.** Code: `src/grow/` (writes) + `src/use/` (reads).

- **observe** — the **live proposal producer**: **re-parses the host's own on-disk transcript** (never wraps/drives the agent — *this is why adding a host = one adapter file*), aggregates per-session signals past a corroboration threshold, and **routes** each candidate to the right module → proposals.
- **propose** — stage the typed, deduped, ranked **proposal** queue.
- **the review gate** *(= `review`, "the gate", "the human gate")* — the **decision**: a human approves or rejects. *"The gate is the moat."* The one door to a Project.
- **evolve** — the **execution** of an approve (what `review` does on approve): **write the note + mint a generation + log it.** The loop's final beat; `write + snapshot` named as one, since they never happen apart. (Aligns with the `be / run / evolve` framing.)
- **snapshot** — the generation mechanism behind `evolve` (mint) and `rollback`.
- **the four verbs** — `query` (read: FTS + graph) · `act` (run a runnable note, gated) · `check` (integrity) · `review` (the gate). The capability surface over a Project.
- **the tool gate** *(= the **guardrails gate**)* — a **different gate**: the enforced **`PreToolUse`** check that blocks/asks on tool calls in real time (rules are `type: rule` notes; deny > ask > allow; **fail-open**). The review gate governs *writes to the Project*; the tool gate governs *the running session's tool I/O*.
  *Relates:* `observe → propose → review → evolve`.

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
- **worktree** — a **per-session git worktree** under `.zuzuu/.worktrees/` → **N concurrent agents** without clashing on the one working branch. Machine-local, gitignored.

## Plane 4 — Identity & naming

- **zuzuu** — **the product / system / CLI** (`zz`, package `@zuzuucodes/cli`), and the home dir name (`.zuzuu/`). *No longer overloaded with the per-repo entity* — that's a **Project** now.
- **Project vs repo** — a **Project** is the `.zuzuu/` (the zuzuu entity, *note › module › Project*); the **repo** / codebase is the code it lives in. Keep them distinct.
- **the home / `.zuzuu/`** — the directory that holds a Project.
- **historical names** — `motorsandsensors`/`mns`, `zuzuagents`/`zuzu` → **zuzuu**. Expected in older docs (see the [glossary renames table](learn/glossary.md)).

## Tiers (where it's going) — linked out

How zuzuu is packaged & sold is *strategy*, not core ontology — the full model lives in
[`specs/2026-06-22-tiered-architecture.md`](specs/2026-06-22-tiered-architecture.md). In one breath: **OSS** (free, local, solo — the built product) ⟷ **Pro** (paid, hosted VM) on the *compute* axis; (OSS/Pro) ⟷ **Enterprise** (org admin control-plane) on the *control* axis; **zuzuu-codes** (our owned harness, credits-metered) cuts across. Pinned by *100% git-native, no live API* — so cross-project is a **roll-up** + an **org module registry** (a git workflow), never one big Project.

## Reading order

**Spine → the agent (framing) → Plane 1 (data) → Plane 2 (loop) → Plane 3 (surfaces).** Then Plane 4 (names) and the tiers pointer. For *same-word-two-meanings* cases, jump to [`learn/glossary.md`](learn/glossary.md).
