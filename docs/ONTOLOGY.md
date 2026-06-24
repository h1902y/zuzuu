# ONTOLOGY — the entities of zuzuu and how they relate

> **The single canonical map of every load-bearing term** — what each entity *is* and
> how it connects to the others. When a word carries a decision, it's defined here once;
> other docs point here. Companion: [`learn/glossary.md`](learn/glossary.md) disambiguates
> the **overloaded** words (same word, two meanings) and holds the **renames** table.
> Architecture: [`../CLAUDE.md`](../CLAUDE.md) · rationale: [`DESIGN.md`](DESIGN.md).
>
> One framing + **four layers**: **the agent** → **data** → **the loop** → **surfaces**
> → **identity**. (Tiers/strategy live in the spec, linked at the end.)

## The spine

```
   everything is an ENVELOPE  ─┬─ a NOTE  (one fact, optionally runnable)
   (markdown + frontmatter)    └─ a MODULE manifest  (module.md — same shape)

   notes ──►  a MODULE  ──►  a project's ZUZUU
              (generic:        (the .zuzuu/ home = a PROJECT, one per repo;
               any goal)        each module has a lineage of GENERATIONS)

   the LOOP grows it:   observe ──► propose ──► review (the gate) ──► write + snapshot
                        (host transcript)   (ranked)   (human-gated)   (mint a generation)

   you touch it via SURFACES:   CLI (zz) · the WORKBENCH (browser) ──► the DAEMON ──► a ZUZUU
                                a SESSION ≡ a git branch
```

## The agent (the framing)

The one idea the rest hangs on: **a host supplies the brain; zuzuu grows the body.**

- **brain** — the **host agent's reasoning loop + the model**. The host supplies it. *This is the only meaning of "brain"* — never the `.zuzuu/` folder.
- **body** — what **zuzuu** gives the host: the evolving **modules** (Layer: Data). The agent *is* its brain + the body we grow for it.
- **host** *(= host agent)* — the coding-agent CLI you already run (Claude Code · Codex · Gemini CLI · OpenCode · pi). zuzuu **wraps** it, never drives it.
- **harness** — the **role**: a loop that wraps a model + tools into an agent. *Hosts are harnesses; zuzuu-codes (Tiers) is our owned one.*

*(The deeper `be / run / evolve` framing and the host-anatomy distinctions live in [`DESIGN.md`](DESIGN.md) §3 — they're rationale, not working entities.)*

## Layer 1 — Data (the substrate)

Plain files in `.zuzuu/`. Code: `src/notes/`, `src/grow/snapshot.mjs`.

- **envelope** — the atom. One file = a markdown **body** + YAML **frontmatter**, distinguished by `type` (the only required field; unknown keys preserved round-trip). *"Everything is an envelope."* A note and a module manifest are the **same shape**.
- **note** — one envelope holding **one fact, optionally runnable**. `id` = the filename stem; lives at `<module>/items/<id>.md`; links to other notes via typed `relations:`.
  *Relates:* belongs to one **module**; `act` runs it, `query` finds it.
- **module** — a **generic, goal-shaped folder of notes**, declared by its `module.md` manifest (`note_type` · `capabilities` · goal). An **open set** — any goal can be a module; no per-module code, no closed taxonomy. The **standard us-owned kinds** (examples, *not a rule*): **Knowledge** · **Memory** · **Actions** · **Instructions** · **Guardrails**. *No prebuilt modules* — `zz init` ships only Guardrails; every other module **materializes on demand** when the loop first routes a proposal to it.
  *Relates:* contains **notes**, owns a lineage of **generations**; the unit the four verbs operate on.
- **a project's zuzuu** *(= a project)* — the `.zuzuu/` **home**: the per-repo directory of modules/notes/generations/log. **git-citizen** (resolves the repo root + `/.zuzuu`, never `git init`s). **One repo → one zuzuu;** there is **no master/aggregate zuzuu**. Synonym: *the home*.
  *Relates:* contains modules (⊃ notes); read/written by the surfaces; travels in git.
- **generation** — a content-addressed, **per-module** snapshot of a module's items (an immutable lockfile). **Minted on every approve;** rollback = pointer-flip + content restore (never `git revert`). Blobs under `.zuzuu/.generations/` — *they travel in git* (rollback needs them).
  *Relates:* belongs to one **module**; `review` mints one; `zz module <m> rollback <n>` flips the pointer.
- **proposal** — a **pending, typed, deduped, ranked change** to a module, staged by the loop, awaiting the gate. The bridge from observation to a generation; always human-approved.
  *Relates:* produced by **observe**; on **review** approve → a **note** + a new **generation**.
- **the log** — the **append-only event journal** (the feedback edge): every approve/reject/mutation.

## Layer 2 — The loop (how the zuzuu grows)

The compounding engine. Invariant: **only `grow/` writes the zuzuu, and only through `review`.** Code: `src/grow/` (writes) + `src/use/` (reads).

- **observe** — the **live proposal producer**: **re-parses the host's own on-disk transcript** (never wraps/drives the agent — *this is why adding a host = one adapter file*), aggregates per-session signals past a corroboration threshold, and **routes** each candidate to the right module → proposals.
- **propose** — stage the typed, deduped, ranked **proposal** queue.
- **the review gate** *(= `review`, "the gate", "the human gate")* — **the one door that writes the zuzuu**. approve = CRUD + log + mint a **generation**. *"The gate is the moat."*
- **snapshot** — mint / rollback **generations**.
- **the four verbs** — `query` (read: FTS + graph) · `act` (run a runnable note, gated) · `check` (integrity) · `review` (the gate). The capability surface over a zuzuu.
- **the tool gate** *(= the **guardrails gate**)* — a **different gate**: the enforced **`PreToolUse`** check that blocks/asks on tool calls in real time (rules are `type: rule` notes; deny > ask > allow; **fail-open**). The review gate governs *writes to the zuzuu*; the tool gate governs *the running session's tool I/O*.
  *Relates:* `observe → propose → review → write + snapshot`.

## Layer 3 — Surfaces (how you use a zuzuu)

The ways a human or agent reaches the data. A zuzuu exists independently of any surface.

- **the CLI** — `zz` (and `zuzuu`): the command surface. `bin/zuzuu.mjs` → `src/cli/` → `src/serve/api`.
- **the daemon** — the **long-lived local process** (binds `127.0.0.1`) that owns the PTYs + filesystem and serves the workbench. It **shells the `zz` CLI** for every zuzuu mutation (never imports `src/grow`).
- **the workbench** — the **browser visual surface**: terminal + file explorer + Monaco editor + the **modules dashboard** + the **composer**. A **view onto a project's zuzuu, served by the daemon** — *not* the zuzuu itself.
- **the modules dashboard** — the workbench's "modules mode" panel (the **zuzuu surface**): per-module generations + approve/reject. The browser face of `review`.
- **the composer** — the workbench's **agent-session input**: a **remote keyboard** into the host's TUI (types your message into the live host CLI; never drives it headlessly).
- **session** *(= a git branch)* — the lifecycle unit: a `zz/session-*` branch (open → branch, turn → checkpoint, end → squash-merge). **"session = git branch."** *(Overloaded with the daemon's PTY `Session` — see [glossary](learn/glossary.md).)*
- **worktree** — a **per-session git worktree** under `.zuzuu/.worktrees/` → **N concurrent agents** without clashing on the one working branch. Machine-local, gitignored.
  *Relates:* `workbench → daemon → (shells) CLI → a zuzuu`; a **session** ≡ a branch; the **composer** drives the host TUI inside a session.

## Layer 4 — Identity & naming

- **zuzuu** — **overloaded, by design:** (a) **the product / system / CLI**; (b) **a project's zuzuu** — the `.zuzuu/` home (Layer 1). Context disambiguates, exactly like `git` the tool vs a repo's `.git`.
- **`zz`** — the command (and `zuzuu`); npm package **`@zuzuucodes/cli`**.
- **the home / `.zuzuu/`** — synonym for *a project's zuzuu*.
- **historical names** — `motorsandsensors`/`mns`, `zuzuagents`/`zuzu` → **zuzuu**. Expected in older docs (see the [glossary renames table](learn/glossary.md)).

## Tiers (where it's going) — linked out

How zuzuu is packaged & sold is *strategy*, not core ontology — the full model lives in
[`specs/2026-06-22-tiered-architecture.md`](specs/2026-06-22-tiered-architecture.md). In one breath: **OSS** (free, local, solo — the built product) ⟷ **Pro** (paid, hosted VM) on the *compute* axis; (OSS/Pro) ⟷ **Enterprise** (org admin control-plane) on the *control* axis; **zuzuu-codes** (our owned harness, credits-metered) cuts across. Pinned by *100% git-native, no live "zuzuu API"* — so cross-project is a **roll-up** + an **org module registry** (a git workflow), never one big zuzuu.

## Reading order

**Spine → the agent (framing) → Layer 1 (data) → Layer 2 (loop) → Layer 3 (surfaces).** Then Layer 4 (names) and the tiers pointer. For *same-word-two-meanings* cases, jump to [`learn/glossary.md`](learn/glossary.md).
