# ONTOLOGY — the entities of zuzuu and how they relate

> **The single canonical map of every load-bearing term in this project** — what each
> entity *is* and how it connects to the others. When a word carries a decision, it's
> defined here once. Other docs point here instead of re-defining.
>
> Companion: [`learn/glossary.md`](learn/glossary.md) handles **overloaded terms** (the
> same word meaning two things — `agent`, `session`, `module`, `host`, `brain`/`zuzuu`)
> and the **renames / intentional-history** table. This file is the *map*; the glossary
> is the *disambiguator*. Architecture lives in [`../CLAUDE.md`](../CLAUDE.md); rationale
> in [`DESIGN.md`](DESIGN.md); the tier strategy in
> [`specs/2026-06-22-tiered-architecture.md`](specs/2026-06-22-tiered-architecture.md).

## The spine (read this first)

```
                          ┌─ a NOTE  (one envelope: a fact, optionally runnable)
   everything is an  ─────┤
       ENVELOPE           └─ a MODULE manifest  (module.md — same shape)

   note ──┐
          ├──►  MODULE  ──┐                          (GENERIC — any goal; the common
   note ──┘   (a folder   ├──►  a project's ZUZUU     kinds: knowledge · memory · actions ·
               of notes)  │     (the .zuzuu/ home  = a PROJECT, one per repo)  instructions ·
   module ─────────────────┘                          guardrails — examples, not a closed set)
   module ─────────────────┘
              │
              └─ each module has a lineage of GENERATIONS (rollback unit)

   THE LOOP that grows it:   observe ──► propose ──► review (THE GATE) ──► write + snapshot
                             (host             (typed,      (human-gated;        (mint a
                              transcript)       ranked)      the moat)            generation)

   WHO runs it:   a HOST agent supplies the BRAIN (reasoning + model);
                  zuzuu gives it a BODY (the modules).  A HARNESS is the role
                  that wraps a model+tools into an agent — hosts are harnesses;
                  zuzuu-codes is our owned one.

   HOW you touch it:   CLI (zz) ───┐
                                    ├──►  a project's ZUZUU
                       WORKBENCH ──►  DAEMON  ──┘   (a SESSION ≡ a git branch)

   HOW it's packaged:  OSS (local) ─⟷ Pro (VM)   ·   solo ─⟷ Enterprise (org)
                       zuzuu-codes cuts across all of them (metered)
```

---

## Layer 1 — The data model (what the agent's knowledge IS)

The substrate. Plain files in `.zuzuu/`. Code: `src/notes/`, `src/grow/snapshot.mjs`.

- **envelope** — the atom. One file = a markdown **body** + YAML **frontmatter**, distinguished by `type` (the only required field; unknown keys are preserved round-trip-exact). *"Everything is an envelope."* A note and a module manifest are the **same shape**. (`src/notes/note.mjs`.)
- **note** — one envelope that holds **one fact, optionally runnable** (knowledge that can also run). Its `id` is the filename stem. Lives at `<module>/items/<id>.md`. Links to other notes via typed `relations:`.
  *Relates:* a note belongs to exactly one **module**; `act` runs a runnable note; `query` finds notes.
- **module** — a **goal-shaped folder of notes**, declaring itself in a `module.md` **manifest** (its `note_type` · `capabilities` · goal). **Fully generic and open-ended** — a module is *any* goal you accumulate notes toward (a `roadmap`, a `tasks` module, whatever), and one differs from another *only* by its manifest. There is **no per-module code** and **no closed taxonomy**: `src/notes/module-templates.mjs` mints a sensible manifest for *any* id, and `listModules` enumerates *any* dir that has a `module.md`.
  The **common, us-owned kinds** (sensible defaults shipped as templates, **examples — not a rule**): **Knowledge** (semantic facts) · **Memory** (episodes) · **Actions** (runnable procedures) · **Instructions** (directive steering) · **Guardrails** (enforced tool gates). *No prebuilt modules* — `zz init` ships **only Guardrails** (the safety floor); every other module — standard kind or custom — **materializes on demand** when the loop first routes a proposal to it. *(The "five module types" framing is a v1 artifact from when they were prebuilt; they're now just the standard examples.)*
  *Relates:* a module contains **notes** and owns a lineage of **generations**; it's the unit `query/act/check/review` operate on.
- **a project's zuzuu** *(= a project)* — the `.zuzuu/` **home**: the per-repo directory holding the modules, notes, generations, and log. **git-citizen** (resolves the repo root + `/.zuzuu`, never `git init`s). **One repo → one zuzuu.** There is **no master/aggregate zuzuu** (see Layer 5). Synonym: *the home*. (`src/notes/store.mjs`.)
  *Relates:* a zuzuu **contains** modules (⊃ notes); the CLI + daemon read/write it; it travels in git.
- **generation** — a content-addressed, **per-module** snapshot of a module's items (an immutable lockfile). **Minted on every approve**; rollback = pointer-flip + content restore (never `git revert`). Stored under `.zuzuu/.generations/<module>/` + the shared `.store/` blobs. (`src/grow/snapshot.mjs`.)
  *Relates:* belongs to one **module**; `review` mints one; `zz module <m> rollback <n>` flips the active pointer.
- **proposal** — a **pending, typed, deduped, ranked change** to a module, staged by the loop, awaiting the gate. The bridge from observation to a generation. Always human-approved in v1. (`src/grow/propose.mjs`.)
  *Relates:* produced by **observe**; on **review** approve it becomes a **note** (or edit) + a new **generation**.
- **the log** — the **append-only event journal** (the feedback edge): every approve/reject/mutation. (`src/grow/log.mjs`.)

---

## Layer 2 — The loop (how the zuzuu grows)

The compounding engine. Every write is human-gated. Code: `src/grow/` (writes) + `src/use/` (reads). Invariant: **only `grow/` writes the zuzuu, and only through `review`.**

- **observe** — the **live proposal producer**: mines the host's own transcript, aggregates per-session signals across a corroboration threshold, and **routes** each candidate to the right module → proposals. (`src/grow/observe.mjs`.)
- **propose** — stage the typed, deduped, ranked **proposal** queue. (`src/grow/propose.mjs`.)
- **review** *(= the gate)* — **THE human gate**. approve = CRUD + log + mint a generation. The **only door** that writes the zuzuu. *"The gate is the moat."* (`src/grow/review.mjs`.)
- **snapshot** — mint / rollback **generations**. (`src/grow/snapshot.mjs`.)
- **the four capability verbs** — `query` (read: FTS + graph) · `act` (run a runnable note, gated) · `check` (integrity) · `review` (the gate). The CLI surface over a zuzuu.
- **the guardrails gate** — *distinct from the review gate* — the **enforced `PreToolUse`** tool check (rules are `type: rule` notes; deny > ask > allow; **fail-open**). Protects the running session in real time. (`src/guardrails/gate.mjs`.)
- **Design B** — the capture principle: **observe = re-parse the host's real on-disk transcript**, never wrap, intercept, or drive the agent. (This is why adding a host = one adapter file.)
  *Relates:* `observe → propose → review → write + snapshot`. The review gate writes **notes/generations**; the guardrails gate blocks **tool calls**.

---

## Layer 3 — Agent anatomy (the *be / run / evolve* framing)

What the agent *is*, what runs it, what grows it. Strategy: [`DESIGN.md`](DESIGN.md) §3.

- **brain** — the **host agent's reasoning loop + the model**. The host *supplies* the brain. **This is the only meaning of "brain"** — never the `.zuzuu/` folder. (see [glossary `brain`/`zuzuu`](learn/glossary.md).)
- **body** — what **zuzuu supplies** to the host: the evolving **modules** (knowledge · memory · actions · instructions · guardrails). The agent *is* its brain + the body we grow for it.
- **host** *(= host agent)* — the coding-agent CLI you already run: **Claude Code · Codex · Gemini CLI · OpenCode · pi**. Supplies the brain; zuzuu **wraps** it, never drives it.
- **harness** — the **role**: a loop that wraps a model + tools into an agent. **Hosts are harnesses; zuzuu-codes is our owned harness** (Layer 5). "We wrap a harness, we never become one" only parses because *harness* is a role, not a product.
- **be / run / evolve** — what the agent *is* (a body of modules) / what *serves & bounds* it (the runtime + guardrails) / what *grows* it (the loop).
- **Cognition · Model · Workspace** — **host anatomy** (process / engine / arena) — observed and steered, **never graduated**. *Not modules.*
- **pin definitions, observe data** — the backbone rule: immutable things (prompt, model, tool version, schema) are *definitions*; everything else is *runtime*, captured and asserted.
  *Relates:* host **supplies** brain; zuzuu **supplies** body; zuzuu-codes **is-a** harness; a host **is-a** harness.

---

## Layer 4 — Surfaces (how you use a zuzuu)

The ways a human (or agent) reaches the data. A zuzuu exists independently of any surface.

- **the CLI** — `zz` (and `zuzuu`): the **command surface** over a project's zuzuu. `bin/zuzuu.mjs` → `src/cli/` → `src/serve/api`. AXI: token-dense, brief-by-default, no blocking prompts.
- **the daemon** — the **long-lived local process** that binds `127.0.0.1`, owns the PTYs + the filesystem, and serves the workbench SPA. It **shells the `zz` CLI** for every zuzuu mutation (it never imports `src/grow`). (`web/src/server/`.)
- **the workbench** — the **browser visual surface**: terminal (xterm over a binary WebSocket) + file explorer + Monaco editor + the **modules dashboard** + the **composer**. It is a **view onto a project's zuzuu, served by the daemon** — *not* the zuzuu itself. (`web/`.)
- **the modules dashboard** — the workbench's "modules mode" panel (the **zuzuu surface**): per-module generations + approve/reject. The browser face of `review`.
- **the composer** — the workbench's **agent-session input surface**: a **remote keyboard** into the host's TUI (types your message into the live host CLI; never drives it headlessly).
- **session** — *(= a git branch)* the lifecycle unit: a `zz/session-*` branch (open → branch, turn → checkpoint, end → squash-merge). **"session = git branch."** *(Overloaded with the daemon's PTY `Session` — see [glossary `session`](learn/glossary.md).)*
- **worktree** — a **per-session git worktree** under `.zuzuu/.worktrees/` → **N concurrent agents** without the single-working-branch clash. Machine-local, gitignored.
  *Relates:* `workbench → daemon → (shells) CLI → a project's zuzuu`; a **session** ≡ a branch; the **composer** drives the host TUI inside a session.

---

## Layer 5 — Tiers (how it's packaged & sold)

Two orthogonal axes, **not a ladder** (compute: local⟷VM · control: solo⟷org). Only **OSS is built**; the rest is documented strategy ([`specs/2026-06-22-tiered-architecture.md`](specs/2026-06-22-tiered-architecture.md)). Pinned by **Q1: 100% git-native, no live "zuzuu API."**

- **OSS** — *free · local · solo.* The `zz` CLI + the local daemon **workbench** + the git-native per-project zuzuu. **The active build.**
- **Pro** — *paid · hosted VM · solo.* The whole workbench in a cloud **VM** (Fly); **VM = source of truth, local mirrors via `git pull`**. *(Deferred — infra-gated.)*
- **Enterprise** — *paid · org · admin control-plane.* Cross-project **visibility + module governance** via a git workflow (the admin is a collaborator on every project repo + a read-only **roll-up**). *(Deferred.)*
- **zuzuu-codes** — **our owned harness** (pi-dev + OpenRouter), an alternative to Claude Code, **credits-metered**. *Cuts across all tiers* — it's the agent harness itself, independent of where the zuzuu lives. *(Deferred; stage ③.)*
- **roll-up** — the Enterprise **read-only dashboard** that reads every project's `.zuzuu/` into one admin view. The audit log falls out of git history.
- **org module registry** — a **curated `.zuzuu/`-shaped repo** that is the admin's source of truth for org modules; **publish = fan-out PRs** into each subscribing project (the project's merge is still the gate).
- **the two axes** — *compute* (local ⟷ hosted VM = OSS ⟷ Pro) · *control* (solo ⟷ org admin = OSS/Pro ⟷ Enterprise).
  *Relates:* there is **no master zuzuu** — each project carries its own; cross-project = **roll-up + registry** (a git workflow, never a central service). zuzuu-codes is metered (the one true network plane).

---

## Layer 6 — Identity & naming

- **zuzuu** — **overloaded, by design:** (a) **the product / system / CLI / company**; (b) **a project's zuzuu** — the `.zuzuu/` home (Layer 1). Context disambiguates, exactly like `git` the tool vs a repo's `.git`.
- **`zz`** — the command (and `zuzuu`). The npm package is **`@zuzuucodes/cli`** (unscoped `zuzuu` is blocked by npm as too-similar to `zuul`).
- **the home / `.zuzuu/`** — synonym for *a project's zuzuu*.
- **historical names** — `motorsandsensors` / `mns` (the v0 phase) · `zuzuagents` / `zuzu` (earlier) → **zuzuu**. Expected in older docs, not an error. (See the [glossary renames table](learn/glossary.md).)

---

## Reading order

New here? **Spine → Layer 1 (data) → Layer 2 (loop) → Layer 4 (surfaces).** Then Layer 3 (why), Layer 5 (where it's going), Layer 6 (names). For the *tricky same-word-two-meanings* cases, jump to [`learn/glossary.md`](learn/glossary.md).
