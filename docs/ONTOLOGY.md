# ONTOLOGY — the entities of zuzuu and how they relate

> **The single canonical map of every load-bearing term** — what each entity *is* and
> how it connects. Defined here once; other docs point here. Companion:
> [`learn/glossary.md`](learn/glossary.md) disambiguates the **overloaded** words and
> holds the **renames** table. Architecture: [`../CLAUDE.md`](../CLAUDE.md) · rationale:
> [`DESIGN.md`](DESIGN.md).
>
> One framing + **four layers**: **the agent** → **data** → **the loop** → **surfaces**
> → **identity**. The data hierarchy is **note › module › Project**.

## The spine

```
   EVERYTHING IS AN ENVELOPE  (typed markdown + frontmatter):
      a NOTE  ·  a module's manifest (module.md)  ·  a Project's manifest (project.md)

   note ──► MODULE ─────► PROJECT
            (a folder      (the .zuzuu/ home + project.md, one per repo;
             + module.md;   each module keeps a lineage of GENERATIONS)
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
- **the Project** — what **zuzuu grows** for a repo: its modules (the agent's evolving *body* of knowledge), versioned and human-gated. Defined in Layer 1.

*(The deeper `be / run / evolve` framing and the host-anatomy distinctions live in [`DESIGN.md`](DESIGN.md) §3 — rationale, not working entities.)*

## Layer 1 — Data (the substrate)

Plain files in `.zuzuu/`. Code: `src/notes/`, `src/grow/snapshot.mjs`.

- **envelope** — the atom. One file = a markdown **body** + YAML **frontmatter**, distinguished by `type` (the only required field; unknown keys preserved round-trip). *"Everything is an envelope."* A **note**, a **module manifest**, and a **Project manifest** are all the same shape.
- **note** — one envelope holding **one fact, optionally runnable**. `id` = the filename stem; lives at `<module>/items/<id>.md`; links to other notes via typed `relations:`.
  *Relates:* belongs to one **module**; `act` runs it, `query` finds it.
- **module** — a **generic, goal-shaped folder of notes**, declared by its `module.md` manifest. An **open set** — any goal can be a module; no per-module code, no closed taxonomy. The **standard us-owned kinds** (examples, *not a rule*): Knowledge · Memory · Actions · Instructions · Guardrails. *No prebuilt modules* — `zz init` ships only Guardrails; every other module **materializes on demand** when the loop first routes a proposal to it.
  *Relates:* contains **notes**, owns a lineage of **generations**; the unit the four verbs operate on; belongs to one **Project**.
- **a Project** — the `.zuzuu/` **home**: the per-repo top-level container of the agent's knowledge (its modules, their generations, the log), declared by **`project.md`**. **git-citizen** (resolves the repo root + `/.zuzuu`, never `git init`s). **One repo → one Project;** there is **no master/aggregate Project**. The top of the hierarchy *note › module › Project*. *(Distinct from the **repo** — the code it lives in. Say "repo"/"codebase" for that.)*
  *Relates:* declared by **project.md**; contains modules (⊃ notes); read/written by the surfaces; travels in git.
- **project.md** — the **Project's manifest envelope** (`type: project`): the Project's identity (title, format version) + the human explainer as its body. The top-of-hierarchy counterpart to a module's `module.md`. `zz init` plants it; `src/notes/project.mjs` `readProject` reads it (fail-soft).
- **generation** — a content-addressed, **per-module** snapshot of a module's items (an immutable lockfile). **Minted on every approve** (the `evolve` step); rollback = pointer-flip + content restore (never `git revert`). Blobs under `.zuzuu/.generations/` — *they travel in git* (rollback needs them).
  *Relates:* belongs to one **module**; `evolve` mints one; `zz module <m> rollback <n>` flips the pointer.
- **proposal** — a **pending, typed, deduped, ranked change** to a module, staged by the loop, awaiting the gate. The bridge from observation to a generation; always human-approved.
  *Relates:* produced by **observe**; on **review** approve → **evolve** writes a **note** + a new **generation**.
- **the log** — the **append-only event journal** (the feedback edge): every approve/reject/mutation.

## Layer 2 — The loop (how a Project grows)

The compounding engine. Invariant: **only `grow/` writes the Project, and only through `review`.** Code: `src/grow/` (writes) + `src/use/` (reads).

- **observe** — the **live proposal producer**: **re-parses the host's own on-disk transcript** (never wraps/drives the agent — *this is why adding a host = one adapter file*), aggregates per-session signals past a corroboration threshold, and **routes** each candidate to the right module → proposals.
- **propose** — stage the typed, deduped, ranked **proposal** queue.
- **the review gate** *(= `review`, "the gate", "the human gate")* — the **decision**: a human approves or rejects. *"The gate is the moat."* The one door to a Project.
- **evolve** — the **execution** of an approve (what `review` does on approve): **write the note + mint a generation + log it.** The loop's final beat; `write + snapshot` named as one, since they never happen apart. (Aligns with the `be / run / evolve` framing.)
- **snapshot** — the generation mechanism behind `evolve` (mint) and `rollback`.
- **the four verbs** — `query` (read: FTS + graph) · `act` (run a runnable note, gated) · `check` (integrity) · `review` (the gate). The capability surface over a Project.
- **the tool gate** *(= the **guardrails gate**)* — a **different gate**: the enforced **`PreToolUse`** check that blocks/asks on tool calls in real time (rules are `type: rule` notes; deny > ask > allow; **fail-open**). The review gate governs *writes to the Project*; the tool gate governs *the running session's tool I/O*.
  *Relates:* `observe → propose → review → evolve`.

## Layer 3 — Surfaces (how you reach a Project)

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

## Layer 4 — Identity & naming

- **zuzuu** — **the product / system / CLI** (`zz`, package `@zuzuucodes/cli`), and the home dir name (`.zuzuu/`). *No longer overloaded with the per-repo entity* — that's a **Project** now.
- **Project vs repo** — a **Project** is the `.zuzuu/` (the zuzuu entity, *note › module › Project*); the **repo** / codebase is the code it lives in. Keep them distinct.
- **the home / `.zuzuu/`** — the directory that holds a Project.
- **historical names** — `motorsandsensors`/`mns`, `zuzuagents`/`zuzu` → **zuzuu**. Expected in older docs (see the [glossary renames table](learn/glossary.md)).

## Tiers (where it's going) — linked out

How zuzuu is packaged & sold is *strategy*, not core ontology — the full model lives in
[`specs/2026-06-22-tiered-architecture.md`](specs/2026-06-22-tiered-architecture.md). In one breath: **OSS** (free, local, solo — the built product) ⟷ **Pro** (paid, hosted VM) on the *compute* axis; (OSS/Pro) ⟷ **Enterprise** (org admin control-plane) on the *control* axis; **zuzuu-codes** (our owned harness, credits-metered) cuts across. Pinned by *100% git-native, no live API* — so cross-project is a **roll-up** + an **org module registry** (a git workflow), never one big Project.

## Reading order

**Spine → the agent (framing) → Layer 1 (data) → Layer 2 (loop) → Layer 3 (surfaces).** Then Layer 4 (names) and the tiers pointer. For *same-word-two-meanings* cases, jump to [`learn/glossary.md`](learn/glossary.md).
