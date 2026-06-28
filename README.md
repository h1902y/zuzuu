# zuzuu

[![ci](https://github.com/h1902y/zuzuu/actions/workflows/ci.yml/badge.svg)](https://github.com/h1902y/zuzuu/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/@zuzuucodes/cli)](https://www.npmjs.com/package/@zuzuucodes/cli) [![node](https://img.shields.io/node/v/@zuzuucodes/cli)](package.json) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**Your project directory becomes the coding agent's memory and toolkit — plain files you query on demand instead of stuffing into context, grown by a human-gated loop that learns from how you actually work.**

The host agent you already run — Claude Code, Codex, Gemini CLI, OpenCode, pi — supplies the *brain* (the reasoning loop + the model). zuzuu gives it an evolving body of **knowledge, memory, actions, instructions, and guardrails** that lives as plain markdown in your repo. It **observes** your real sessions, **proposes** what it learned, and — only with your approval — **writes** it back, versioned in git. We never run a competing agent loop and never drive the host headlessly.

> Install `npm i -g @zuzuucodes/cli` — the command is **`zz`** (or `zuzuu`). Zero runtime dependencies. Published with provenance; releases auto-publish from `main` via GitHub OIDC.

This README is the single front door **and** the canonical map: the [quickstart](#quickstart) and [the loop](#the-loop) are what works today; [**The model**](#the-model) below defines every load-bearing term — the four planes (the agent → data → operations → experience → identity). The [`learn/`](docs/learn/) book walks the code file-by-file; [`learn/glossary.md`](docs/learn/glossary.md) disambiguates the overloaded words.

## Everything is an envelope

One file format underlies the whole system: a **markdown body + YAML frontmatter**, distinguished by `type`.

```markdown
---
type: action            # the only required field — what this envelope IS
title: Rebuild the deck index
run: npm run build:index
relations: { uses: knowledge:card-schema }
---
Regenerates `dist/index.json` from `src/cards/`. Safe to run anytime.
```

- A **note** is one such file: one fact, optionally runnable (*knowledge that can also run*). Its id is the filename stem.
- A **module** is a goal-shaped folder of notes; its `module.md` manifest is the same envelope.
- A **Project** is the `.zuzuu/` home — a git-citizen that lives *inside* your repo and never `git init`s its own.

You **query** what's true, **act** on what's runnable, **check** integrity; zuzuu **observes** and proposes; you **review**. Plain verbs over plain files — detailed in [The model](#plane-2--operations-the-vocabulary).

## Quickstart

```bash
npm install -g @zuzuucodes/cli

zz init                      # plant this repo's empty .zuzuu/ (git-style, hidden like .git) — only the guardrails safety floor; modules grow on demand
zz host enable               # wire the lifecycle hooks + the enforced guardrails gate

# … now use your coding agent normally. zuzuu watches. Then:

zz observe                   # mine your real sessions → evidence-backed staged changes
zz review                    # see what it learned, ranked
zz review approve actions <id>   # the human gate — writes the note + mints a generation (a git commit)
zz act actions <id>          # run the procedure it just learned
```

Other verbs: `zz query <module> [text]` (FTS + graph), `zz check` (broken links · orphans · stale), `zz digest` (the session-start brief), `zz start · steer · wrap` (the session steering loop), `zz session …` (every session is a git branch — `status·land·hold·resume·drop·worktree·label`), `zz gen list|rollback <m>` (the generation lineage), `zz doctor·status·explain`, `zz host code` (launch OpenCode pre-wired), `zz host web` (the visual workbench). The full surface is the two-tier grammar (`zz help`); every pre-rename verb still works as a deprecating alias.

## The loop

```
   observe     stage      plan      review      evolve
   ───────  ─►  ─────  ─►  ────  ─►  ──────  ─►  ──────────────
   re-read     typed,     bundle a   you          the note lands +
   your real   deduped,   change-    approve      a generation is
   sessions    ranked     set        or reject    minted (a git
   (never      queue      (dry-run)  (the moat)   commit, rollback-able)
    drive)
```

Three things make it safe and sticky:

- **The human gate is the moat.** Every write to the Project passes through `zz review`. Automated memory systems poison themselves with confident-but-wrong reflections; the gate is the one defense, and the design keeps it cheap (changes are batched, ranked, deduped).
- **Observe, don't drive (Design B).** zuzuu re-parses the transcript your host already wrote — it never wraps, intercepts, or steers the agent. That's why it can't corrupt a session, and why adding a host is one adapter file.
- **Git-native, append-only, rollback-able.** A note is immutable until CRUD'd through the gate; the mutation log is append-only; a generation **is a git commit**. Roll a module back to any pinned generation with `git restore` — recorded as a new forward generation, so history stays append-only (never a `git revert`).

## Borrowed, not invented

| concern | borrowed thesis |
|---|---|
| the file format | **OKF** — `type` the only required field; tolerate + preserve unknown keys |
| running an action safely | **Anthropic's sandbox-runtime** — advisory · contained · sandboxed tiers + a `run.allow` command-axis |
| sessions & versions | **git's object model** — session = branch, generation = commit, rollback = `git restore` (no parallel blob store) |
| the query store | **`node:sqlite`** — FTS5 + recursive-CTE graph walks over your markdown, rebuilt on demand, zero-dep |

## Host coverage

zuzuu is host-agnostic by construction (the capture core iterates detected adapters, never a host name). **Five hosts ship, each built against that host's own real on-disk format** — Claude Code (transcript JSONL), Codex (rollout JSONL), Gemini CLI (logs.json), OpenCode (SQLite), pi (session JSONL). `zz observe` mines them all; the lifecycle hook + the `PreToolUse` guardrails gate (it hard-blocks `rm -rf /` and friends, fails open on anything it can't evaluate) are wired for Claude Code, with the same hook path mapping the other hosts' lifecycle events.

| | Claude Code | Codex | Gemini CLI | OpenCode | pi |
|---|---|---|---|---|---|
| observe (mine sessions) | ✅ rich | ✅ rich | ✅ thin¹ | ✅ rich | ✅ rich |

¹ Gemini's on-disk `logs.json` is prompt-only (tool calls live in checkpoint files), so its shell-signal mining is empty — an honest capture gap, not a core difference.

**Prerequisites:** Node ≥ 22. Hacking on zuzuu itself? `git clone https://github.com/h1902y/zuzuu && cd zuzuu && npm link`.

---

# The model

> The canonical map of every load-bearing term — what each entity *is* and how it connects.
> One framing + **four planes**: **the agent** → **data** → **operations** → **experience** →
> **identity**. The data hierarchy is **note › module › Project**; **operations** are the precise
> vocabulary (the plumbing — use + grow), **experience** is **session management via conversations**
> (the porcelain ladder up to a single `zz`). Rationale lives in [`docs/DESIGN.md`](docs/DESIGN.md).

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
   STEER a session:     start ─► steer ─► wrap   (the brain steers the agent + you)
```

## The agent (the framing)

The one idea the rest hangs on: **a host supplies the brain; zuzuu grows the Project.**

- **brain** — the **host agent's reasoning loop + the model**. The host supplies it. *This is the only meaning of "brain"* — never the `.zuzuu/`.
- **host** *(= host agent)* — the coding-agent CLI you already run (Claude Code · Codex · Gemini CLI · OpenCode · pi). zuzuu **wraps** it, never drives it.
- **harness** — the **role**: a loop that wraps a model + tools into an agent. *Hosts are harnesses; zuzuu-codes (Tiers) is our owned one.*
- **the Project** — what **zuzuu grows** for a repo: its modules (the agent's evolving *body* of knowledge), versioned and human-gated. Defined in Plane 1.

*(The deeper `be / run / evolve` framing and the host-anatomy distinctions live in [`docs/DESIGN.md`](docs/DESIGN.md) §3 — rationale, not working entities.)*

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

**Five load-bearing properties:** **self-describing** (`type` says what it is — no schema
*per concept*; just a few type-keyed write-time invariants — a `rule` needs a `pattern`, an
`action` a `run` — enforced by `notes/validate.mjs`) · **tolerant** (unknown keys survive a read→write, so a new field never breaks an
old reader) · **round-trip-exact** (`parse ∘ serialize` is the identity — hand edits and
machine edits coexist without clobbering) · **plain text** (git-diffable, grep-able; the
file is the source of truth) · **one shape, many roles** (a fact, an action, a rule, a
module/Project manifest — all envelopes, differing only by `type`). One shape buys **one
parser** (`notes/note.mjs`) + a generic **index**, not a type system per concept — and every
operation that grows or uses a Project reads or writes envelopes.

### note · module · Project — the three levels

The data nests three deep: the **leaf is an envelope**, and each **container has a manifest
envelope** that declares it.

- **note** — one envelope = one fact, optionally runnable (the leaf). Typed `relations:` to
  other notes make a Project a **graph** (walkable both ways — out-relations + inbound
  **backlinks**); a `run:` field makes the note executable.
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
  instructions/              ← the ONLY module that ships — the safety floor + guidance
    module.md
    items/{no-root-wipe, protect-brain-writes, review-the-gate, …}.md   ← seed rules + guidance (type: rule / instruction)
```

Only **Instructions** ships at init — the enforced safety floor (guardrail rule-notes incl.
`.zuzuu/` write-protection) plus best-practice guidance; the other content kinds
(knowledge · memory · actions) start absent.

**Grows on demand.** As the loop runs, a **module** materializes the first time `observe`
routes a staged change to it (its `module.md` minted from a template), and **notes** accumulate
under `<module>/items/` as staged changes are approved. A real, evolved Project — still flat and
legible, every path a plain file you can open:

```
.zuzuu/
  project.md                          ← the Project manifest (type: project)

  instructions/                       ← shipped at init, then grown
    module.md
    items/ no-root-wipe.md · protect-brain-writes.md · review-the-gate.md · sessions-are-branches.md
    log.jsonl                         ← mutations (create/update/delete) — git-tracked provenance
    runs.jsonl                        ← runs + queries — local telemetry, gitignored (observe's feedback edge)
    generations.json                  ← the lineage ledger ({n, mintedAt, mintedFrom}; git holds the bytes)

  knowledge/                          ← materialized on its first staged change
    module.md
    items/ card-schema.md · deck-index.md · hot-file-app-tsx.md
    staged/ file-src-db-ts.json       ← awaiting the review gate (not yet a note)
    log.jsonl · runs.jsonl · generations.json

  actions/
    module.md
    items/ rebuild-index.md · run-tests.md
    log.jsonl · runs.jsonl · generations.json

  instructions/
    module.md
    items/ always-run-tests-first.md
    log.jsonl · runs.jsonl · generations.json

  worktrees/                          ← gitignored (live session checkouts)
```

Every module is the *same shape* — `module.md` · `items/` · (optional) `staged/` (+ its
`archive/` of decided changes, kept for the audit trail) · `log.jsonl` (mutations) + `runs.jsonl`
(runs) · `generations.json` — so the tree stays uniform however large it grows. That uniform tree
is the **whole** durable Project; no deeper fan-out, because two things stay lean:

- **Generations are git-native** — a module's history *is* its git history: every approve is a
  path-scoped commit carrying a `zz-gen: <module>/<n>` trailer, so **generation = commit** and
  `n → commit` is resolvable from `git log`. The tiny `generations.json` records only the lineage
  (`{n, mintedAt, mintedFrom}`); **rollback** is a `git restore` to gen-n, recorded as a new
  *forward* generation (history stays append-only). No parallel blob store.
- **Derived state lives outside the repo (XDG)** — the rebuildable **index** (`node:sqlite`:
  notes + KV props + a typed **link graph** + **FTS5** full-text + BM25, rebuilt on mtime/size
  staleness — the query keystone that lets the agent *search* on demand instead of stuffing
  context) → `~/.cache/zuzuu/<hash>/index.db`; session run-state + the gate log →
  `~/.local/state/zuzuu/<hash>/`. The only in-repo gitignored entries are `worktrees/` (live,
  uncommitted work) and each module's `runs.jsonl` (local run telemetry). So the durable Project —
  notes · mutations (`log.jsonl`) · each `generations.json` lineage — is **100% git-tracked**, a
  true git citizen, like `.git` keeping machine-local state out of your tree.

> `generation · staged change · log` live on disk here but are *produced by the loop* — so
> they're defined in **Plane 2**.

## Plane 2 — Operations (the vocabulary)

The **plumbing**: precise, single-purpose operations — the vocabulary every higher surface
composes, each bottoming out in filesystem + git. Four families — **use** (read & run, no write) ·
**grow** (the write loop + edits, every change human-gated) · **version** (read & roll a module's
git-native lineage) · **dispatch** (how a verb reaches a module) — and the **two gates**. Plane 3's
porcelain (`zz`, `start · steer · wrap`, …) is built *on* these. Code: `src/metal/{git,fs,sqlite}.mjs`
(the I/O owners) · `src/notes/{repo,rows,generation,log,index,validate}.mjs` (the note repository ·
the lossless read projection · version · the ledger · search · the pre-write check) · `src/use/`
(read/run) · `src/grow/{commit,observe,review,…}.mjs` (the one write boundary + the loop) ·
`src/serve/{dispatch,wire,timeline,api}.mjs` (dispatch + the façade). The invariant, now **structural**:
**one writer — `grow/commit.mjs` is the sole note-writer + the loop's sole minter, reached only
through `review`; use reads + runs.**

### Use — read & run (no Project write)

Each verb heads a small **family**.

- **query** — retrieve: FTS + graph walk, BM25-ranked, TOON output. *Family:* `view` (page a body) · `links` (out-relations + inbound **backlinks**) · `diff` (note↔note — the change preview `plan`/`review` render; generation↔generation diff is a **version** op, below).
- **act** — run a runnable note, gated + allowlisted (each run appends to `runs.jsonl`). *Family:* `flow` (a `type: workflow` DAG of run-steps, compensating on failure).
- **check** — integrity: broken links · orphans · stale. *Family:* `validate` (the type-keyed invariants **plus** a module's declared typed-column **schema** — a `module.md` `fields` block, the 8 FieldTypes — enforced as a **pre-write reject** at the write boundary: a note that violates its schema never lands. "A module is a TABLE, a note a ROW, the columns are the schema"; absent `fields` ⇒ schemaless).

### Grow — the loop (every write human-gated)

**Five beats** — `stage` and `evolve` are loop beats, not typed verbs; `snapshot` is not a beat
(minting a generation is part of evolve). Each approved change commits as a **git-native
generation** (Plane 1), so growth *is* git history.

- **observe** — mine the host's own on-disk transcript (never drives the agent — *adding a host = one adapter file*); route corroborated per-session signals → staged changes via the declarative `ROUTE` table (reaching 4 of the 5 standard module kinds).
- **stage** — the typed, deduped, ranked **staged-change** queue (`<module>/staged/`; decided changes move to `staged/archive/`, never deleted). A module **materializes on its first staged change** (its `module.md` minted from a template — the "no prebuilt modules" rule). *(Renamed from `propose` — the noun collided with the verb; `staged → review → evolve` mirrors git's `staged → committed`.)*
- **plan → apply** — `plan` bundles a module's pending set into ONE content-addressed **change-set** + its diff (a dry-run, writes nothing); **apply** commits the whole set as one generation, all-or-nothing (reverts via `git restore` mid-batch). The id is a TOCTOU guard; Terraform's `plan → apply`. A single change is a plan-of-one.
- **review** — **the human gate**: approve or reject. *"The gate is the moat"* — the one door to a Project. `validate` runs first; a malformed note (or a note that violates its module's typed-column **schema**) is refused before it lands.
- **evolve** — execute the approve. It now feeds **the one write boundary** — `grow/commit.mjs`, the **sole note-writer + the loop's sole minter** (2026-06-28): a batch applies all writes as one all-or-nothing transaction, then mints *once* per touched module. `commit` validates, logs, mints, and **refuses an agent-stamped write** — so the agent can only reach it through `review`. The moat is now *structural* (zero writers bypass `commit`), not a convention.

*Direct edits (outside the loop, operator-gated):* the graph-safe refactors `note rename · note
fold · note retype` (rewrite a field, **repointing inbound links**) and the scoped edits `note set ·
note append` — each a pure batch **expander** that feeds `commit`, landing as a generation. *(All in
the Tier-2 `note` namespace; the old flat `rename`/`merge`/`refactor`/`patch`/`append` survive as
deprecating aliases.)*

### Version — read & roll the git-native lineage

Per-module, over git history (`notes/generation.mjs` + `serve/timeline.mjs`), surfaced on the façade:

- **generations** — list the lineage (the ledger entries + the active `n`).
- **as-of `<n>`** — read a module's notes as they were at generation n (time-travel).
- **diff `<a> <b>`** — generation↔generation diff (distinct from the note↔note `diff` preview above).
- **rollback `<n>`** — `git restore` to gen-n, recorded as a new *forward* generation (append-only).
- **log / timeline** — the unified cross-module generation timeline, over each module's `generations.json` plus the `log.jsonl` (mutations) / `runs.jsonl` (runs) ledgers (`logMutation` / `logRun` / `read`).

### Dispatch — how a verb reaches a module

The seam between an operation and a module's declared `capabilities`:

- **register / invoke / list** (`serve/dispatch.mjs`) — one `Map` of `name → {handler, permission}`; `invoke` is **manifest-gated** (refuses a verb the module's `module.md` doesn't list) and **fail-soft** (returns `{ok:false}`, never throws).
- **registerAll** (`serve/wire.mjs`) — binds `query · check · act · view · flow · validate` (all six route through the one dispatch table, so none skips its permission/actor gate); `review` and the tool gate are **deliberately off-registry** (a gate is not a capability).
- **the façade** (`serve/api.mjs` — `open(cwd)`) — the one handle that exposes all of the above; the seam the CLI and the daemon both compose (Plane 3).

The **review gate** governs *writes* — fail-closed by design (the moat). A different gate, the
runtime **tool gate**, governs a session's tool I/O (Plane 3).

## Plane 3 — Experience: session management via conversations

Plane 3 is **session management, conducted as a conversation**. The unit is a **session** — one
conversation with the host agent = one unit of work — and Plane 3 is everything that opens, steers,
checkpoints, closes, recovers, and runs it concurrently. The **porcelain** commands are the
human-friendly face (composing Plane 2's vocabulary); underneath, a session **is a git branch**
with a full, automatic lifecycle. Code: `src/serve/` (steering + brief) · `src/sessions/` (the
git-branch engine) · `src/cli/` · `src/hosts/` (the lifecycle hook + surfaces).

### The ladder

```
   zz                            ← apex: one command, the whole conversation
   start · steer · wrap          ← headline porcelain (the few you remember)
   session resume · gen rollback · host enable · doctor · …   ← niche porcelain (Tier-2 nouns)
   query · act · check · review plan/apply · note rename · gen rollback · …   ← Plane-2 vocabulary
   read/write files · git commit/restore                      ← the metal
```

The verb surface is a **two-tier grammar** (a declarative table, `src/cli/commands.mjs`, that drives
the router, `zz help`, the gate deny set, and the daemon catalog — they can't drift): **Tier-1** keeps
the hot-loop verbs flat (`query · act · check · review · stage · observe · …`); **Tier-2** groups the
cold verbs under noun namespaces (`note · gen · session · host · registry`). Every pre-rename flat verb
(`merge`, `log`, `rename`, `session merge/continue/discard`, `enable`, …) still works as a
stderr-deprecating alias.

- **`zz`** *(apex)* — the unified conversational front door: open the session (greeting + opener), scaffold + steer as you work, and surface the human **only at the review gate**. It **frames, scaffolds, steers, and gates** — it never *drives* (the host supplies the brain; *that* is the cardinal line). The realization of **interactive-first**: the user just converses; zuzuu does the rest underneath.
- **headline porcelain** — `start · steer · wrap` (the steering loop, below): the few you remember.
- **niche porcelain** — closer to the metal: `session resume/drop/land` · `gen list/diff/rollback` · `host enable · doctor · status · explain`. Each is sugar over a small set of Plane-2 primitives. *(The old `session continue/discard/merge` and `module generations/rollback` names still work as deprecating aliases.)*

### The steering loop — open · steer · close (the headline)

The Project shapes each session: **the brain steers both the agent and you**, so you just
*initiate and end as recommended* and extract the directory's value.

**The steering spine** — a human-authored **`steering`** block in `project.md` (`goals · opener ·
closer · drift`, the *pinned* session contract) plus the **Instructions** module (*loop-grown*
standing guidance) are folded into the deterministic **session brief** (`serve/digest.mjs`;
capped, zero-network) and injected to the agent at session start. *Pin definitions, observe data:*
`project.md` is the pinned contract, Instructions is grown by the loop — both feed the brief.

- **`zz start`** — the recommended opener (the first message you paste): the `opener` + `goals` + what's pending review + **where you left off** + a **⚠ leftover-session** recovery prompt if a prior session dropped.
- **`zz steer`** — stay on scope mid-session: the `drift` signals (the self-check) · a **parking lot** for off-scope items (`--park`) · the grown guidance to consider **pinning** into `steering`.
- **`zz wrap`** — the recommended closer: a wrap-up + the review nudge + parked items; `--note` saves a **handoff** that loops into the next `start`.

The **handoff** and **parking lot** are *transient session run-state* (the XDG state dir, beside
`digest.md`) — not tracked notes. A dropped session is **recovered** (the leftover `zz/session-*`
branch + its checkpoints), never silently lost.

**The tool gate** *(= the **guardrails gate**)* — runtime **`PreToolUse`** enforcement: blocks/asks
on a tool call in real time (rules are `type: rule` notes; deny > ask > allow; **fail-open**). The
*other* gate vs `review` (Plane 2): this one governs **the running session's tool I/O**, not writes.

### The session — a git branch, fully managed

The substrate beneath the conversation. A **session ≡ a git branch** (`zz/session-*`): the
lifecycle unit *and* the record (the branch IS the record — no separate index). One working branch
at a time (the **single-branch invariant**): a leftover `zz/session-*` **blocks** opening a new
session until it's continued, merged, or discarded — the teeth behind drop-recovery, not just its
prompt. On a clean END a session is instead **held** out of the active namespace (renamed `zz/held-*`,
or a worktree branch marked held) so it queues for the merge gate **without** blocking the next
session — the merge/continue/discard verbs resolve both namespaces (and take an optional `<id>` when
several are held). Code: `src/sessions/`.

**Enablement & hosts** — the lifecycle is dormant until **`zz host enable`** installs the `#zz-hook`
block into the host's settings (idempotent; never clobbers your hooks — `zz host disable` removes only
tagged entries). It fires for **five hosts** — Claude Code · Codex · Gemini CLI · OpenCode · pi —
each a one-file adapter that **re-parses that host's real transcript** (Design B: observe, never
drive); the core iterates *detected* hosts, never a host name (`hosts/registry · capture · signals`).

**The lifecycle** — driven automatically by the host **hook** (*fail-open*, never blocks the agent):
- **open** → cut the session branch + **ground** (inject the brief — the steering above).
- **turn** → **checkpoint**: commit the turn's dirty state to the session branch, **secrets excluded** (`.env` · `*.pem/*.key` · `id_rsa*` · `credentials` …; an all-secret diff yields *no* commit) — nothing is lost mid-session, and no key ever lands in a commit.
- **end** → **`hold`**: fold the checkpoints, then hold the session branch out of the active namespace (in-place → renamed `zz/held-*` + base checked out; worktree → left in its own checkout, marked held), then **observe** (mine the transcript → staged proposals, Plane 2) + refresh the brief. The squash-merge onto the working branch is **no longer automatic** — it's an explicit human gate (**`zz session land`**), symmetric with the brain's review gate (nothing lands without your yes). *(Opt back into the old auto-land per-project with `"autoMerge": true` in `.zuzuu/agent.json` — mirrors the `"sessionGit": false` opt-out, fail-soft.)*

**Drop & recovery** *(#7)* — a session that drops mid-task (crash · closed terminal · walk-away)
leaves a leftover branch with uncommitted checkpoints and no clean end. It **never corrupts the
working branch** (checkpoints live on the session branch; squash-merge happens only on a clean end).
`zz start` **and `zz doctor`** both surface it; **`zz session resume`** resumes (the work restored
from the checkpoints), **`zz session land`** keeps it (squash onto the working branch), **`zz
session drop`** drops it. *(The canonical session verbs are now `land · hold · resume · drop`; the
prior `merge · finalize · continue · discard` survive as deprecating aliases.)*

**Concurrency** — a per-session **worktree** (`.zuzuu/worktrees/<id>`) gives N agents their own
checkout, so they never clash on the one working branch. Machine-local, gitignored (the lone
in-repo non-durable entry — it holds live, uncommitted work, never cache).

**Labels** — human names for sessions (`zz session label`), so a branch reads as a task.
**Transient run-state** — the handoff + parking lot (above) are the session's scratch, in the XDG
state dir beside `digest.md`; never tracked notes.

**Commands** — `zz session status · merge · continue · discard · worktree · label` (the niche
porcelain over this engine). *(Overload: the daemon's PTY `Session` ≠ this git-branch session — see
[glossary](docs/learn/glossary.md).)*

**Transparency** *(the `.git` model)* — session state is read out by plain files plus three
read-only verbs: **`zz doctor`** (git/home/host/hook health — and the second place a dropped session
surfaces, beside `zz start`) · **`zz status`** (detected hosts + their session-branch counts) ·
**`zz explain`** (the topic glossary). These are the window onto a session; the human gate is the
only write.

### Surfaces — where the porcelain runs

Two paths to a Project through **one door** (`serve/api`); a session is a git branch.

```
   CLI (zz) ─────────────────────────────────►  serve/api  ──►  a PROJECT   (direct, in-process)
   Workbench (browser) ─► daemon ─(shells zz)─►  serve/api  ──►  a PROJECT   (same door, gated)
   A SESSION ≡ a git branch:  a host runs in a session → its own worktree → HELD on exit → merged at the gate
```

**One door to every write:** the daemon shells the gated `zz` CLI (never imports `grow/`), so the
browser physically can't bypass the review gate — the integrity boundary, not indirection.

- **the CLI** — `zz` (and `zuzuu`): the command surface. `bin/zuzuu.mjs` → `src/cli/` → `src/serve/api`. Where the porcelain (above) is typed.
- **the daemon** — the long-lived local process (binds `127.0.0.1`) owning the PTYs + filesystem; serves the workbench; shells `zz` for every write.
- **the workbench** — the browser visual surface: terminal + explorer + Monaco editor + the **modules dashboard** (the browser face of `review`) + the **composer** (a *remote keyboard* into the host's TUI — types into the live host CLI, never drives it headlessly). A *view onto* a Project, not the Project. *(Design research for the next workbench phase: [`docs/design-research/workbench/`](docs/design-research/workbench/).)*

## Plane 4 — Identity & naming

- **zuzuu** — **the product / system / CLI** (`zz`, package `@zuzuucodes/cli`), and the home dir name (`.zuzuu/`). *No longer overloaded with the per-repo entity* — that's a **Project** now.
- **Project vs repo** — a **Project** is the `.zuzuu/` (the zuzuu entity, *note › module › Project*); the **repo** / codebase is the code it lives in. Keep them distinct.
- **the home / `.zuzuu/`** — the directory that holds a Project.
- **historical names** — `motorsandsensors`/`mns`, `zuzuagents`/`zuzu` → **zuzuu**. Expected in older docs (see the [glossary renames table](docs/learn/glossary.md)).

## Tiers (where it's going) — linked out

How zuzuu is packaged & sold is *strategy*, not core ontology — the full model lives in
[`docs/specs/2026-06-22-tiered-architecture.md`](docs/specs/2026-06-22-tiered-architecture.md). In one breath: **OSS** (free, local, solo — the built product) ⟷ **Pro** (paid, hosted VM) on the *compute* axis; (OSS/Pro) ⟷ **Enterprise** (org admin control-plane) on the *control* axis; **zuzuu-codes** (our owned harness, credits-metered) cuts across. Pinned by *100% git-native, no live API* — so cross-project is a **roll-up** + an **org module registry** (a git workflow), never one big Project.

---

## Repo map

| Path | What |
|---|---|
| [`src/`](src/) + `bin/zuzuu.mjs` | the CLI — `metal · notes · use · grow · guardrails · hosts · sessions · cli · serve` (zero-dep, filed by concept; `cli/commands.mjs` is the one command table, `grow/commit.mjs` the one write boundary) |
| [`web/`](web/) | the visual workbench — a nested project (daemon + React SPA), staged into the npm package at publish |
| [`tests/`](tests/) | hermetic units (`npm test`) + a real-data observe playground (`node tests/playground/run.mjs 5`) |
| [`docs/README.md`](docs/README.md) | the **doc-map** — where every kind of doc lives (read first to find or place one) |
| [`docs/learn/`](docs/learn/) | the educative book — read in order; lessons 02–09 walk the v2 code file-by-file |
| [`docs/LOG.md`](docs/LOG.md) | the build journal (append-only — what shipped, verified) |
| [`docs/DESIGN.md`](docs/DESIGN.md) | strategy & rationale (the *why*: hypothesis, decisions, prior art) |
| [`docs/design-research/`](docs/design-research/) | workbench design research (the [`workbench/`](docs/design-research/workbench/) set drives the next phase) |
| [`docs/specs/`](docs/specs/) | live specs — designs for work *not yet shipped* (shipped specs are retired into `LOG.md`) |
| [`docs/inspiration/`](docs/inspiration/) | the research shelf — prior-art audits & syntheses |

## How this is built (the method)

**Prove on real data, record in the journal.** Every capability is verified against *real* sessions (never invented fixtures) before it counts; the record lives in [`docs/LOG.md`](docs/LOG.md) (append-only). The core was rebuilt greenfield in 8 rungs — ~13k → ~3.8k lines — each rung green before the next, taught file-by-file in [`docs/learn/`](docs/learn/). Built in public — day-by-day on X ([@h1902y](https://x.com/h1902y)).

**Finding your way around the docs** → [`docs/README.md`](docs/README.md), the doc-map: every kind of information has one canonical home, and that file says which.

## License & status

Personal project, early and changing daily. MIT. Issues/ideas welcome.
