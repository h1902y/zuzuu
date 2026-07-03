# The model — the canonical map

> Moved verbatim from the README front door (02-07-2026) — this is the canonical
> registry of every load-bearing term. The README links here; nothing here was
> rewritten in the move.

> The canonical map of every load-bearing term — what each entity *is* and how it connects.
> One framing + **four planes**: **the agent** → **data** → **operations** → **experience** →
> **identity**. The data hierarchy is **note › module › Project**; **operations** are the precise
> vocabulary (the plumbing — use + grow), **experience** is **session management via conversations**
> (the porcelain ladder up to a single `zz`). Rationale lives in [`docs/DESIGN.md`](DESIGN.md).

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

*(The deeper `be / run / evolve` framing and the host-anatomy distinctions live in [`docs/DESIGN.md`](DESIGN.md) §3 — rationale, not working entities.)*

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
- **The envelope floor** (02-07-2026): the WRITE boundary additionally guarantees `title` and `status` non-empty on every landed note — filled when absent (status → `active`; title → body first line, else the humanized id), never overwritten. Parsing stays tolerant; `zz module backfill` heals pre-floor history.
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

### Tool · toolkit — the MCP-native reading of note · module (§I.6)

The **runnable subset** of Plane 1 has a *second name*, not a second entity ("no new
entity" — §I.6, `docs/specs/2026-07-02-polish-showcase-experience.md`): a `type:
action` note **IS** an MCP **tool**; the **module** it lives in **IS** the MCP
**toolkit** (`module.md` = the toolkit manifest); the module's declared typed-column
**schema** (`fields`) **IS** the tool's `inputSchema` (JSON Schema — one schema,
shared by every tool the module holds); `type` is the tool-vs-resource line already
present (an action/tool exposes as a **TOOL** — `act`; a knowledge/library note
exposes as a **RESOURCE** — read-only). A tool declares **how** it runs via `binding:
shell | agent | mcp` (absent ⇒ `shell`, today's `run:`, full back-compat) —
`notes/validate.mjs` enforces the binding-appropriate invariant (shell needs `run:`;
agent needs a `prompt:`, or reuses `run:` as one when absent — one primary
instruction field regardless of binding; mcp needs `mcp: {server, tool}`) — plus an
optional `secrets: [name]` list (**DECLARED metadata only**; resolution into a run's
env is a follow-on build — see §J.3/§J.5). `zz tool list` / `zz tool show <m:id>` are
the **read-only VIEW** over this — every tool grouped by its toolkit, or one tool's
full contract (binding · inputSchema · secrets · target · a toolkit HITL note) — the
basis for a future real `tools/list` MCP endpoint, not the endpoint itself.
**Dispatch** (`use/act.mjs`): `shell` is the existing gated + timed + logged path,
unchanged; `mcp` is a clean, explicit stub (`{ok:false, error:'…not yet
implemented…'}` — no fake client, no fake success); `agent` would delegate the tool's
prompt to the host over the ACP lane, but **ACP is daemon-only today**
(`web/src/server/acp.ts` — not reachable from this CLI process), so the CLI binding
returns a structured `{ok:false, needsHost:true}` requirement rather than silently
no-opping or headless-spawning a host session behind the interactive-first doctrine's
back — a hosted daemon is the documented follow-on that actually dispatches it.
**Composition** (`use/workflow.mjs`'s Tier-0/1 `note:` steps AND `grow/run.mjs`'s
Tier-2 durable-runner `note:` steps — two independent note-ref resolvers) both
resolve a target through the SAME `act()`, so neither the synchronous nor the
durable runner can bypass a tool's binding. Full narrative:
[`docs/guide/Tools.md`](guide/Tools.md).

### Secrets — declarations only; the value never in zuzuu's world (§J.3/§J.5)

A `type: secret` note is a **DECLARATION**, never the credential — `name` (the env
var), `scope` (an allowlist of `module:x`/`tool:x`/`module:tool` callers), `actor`
(`operator-only` default | `agent-allowed`), `resolves_from` (`env` default |
`secrets-file` | `fly` | `oidc`), plus `rotation_note`/`sensitive`/`last_used`. **The
value can never be written to a note** — `notes/validate.mjs`'s write door refuses
ANY `value`/`secret`/`key`/`token`/`password`/`credential` field on a `type: secret`
note, case-insensitively, unconditionally — so the invariant holds through EVERY
write path (`note create`, `note set`, `review approve`) since they all funnel
through `notes/repo.mjs`'s one `writeNote`. By convention (§J.3's own framing)
declarations live in a dedicated `secrets` module; `use/secrets.mjs`'s resolver only
looks there, though the write-door refusal applies to a `type: secret` note
regardless of placement (a per-**type** invariant, like every other one in that
file). **§J.5's refinement**: zuzuu never invents a secret STORE — the value is
TERMINAL-managed per environment (`export` locally, `fly secrets set` remotely, a
dev-only `.zuzuu/secrets.env` fallback) and read straight from `process.env` at
resolve time; zuzuu holds only the metas. `use/secrets.mjs`'s `resolveSecret(home,
name, {caller, actor})` is the ONE reader of the host store — pure, fs-only (no
sqlite dependency): find the declaration → **scope** check (an unlisted caller is a
resolution ERROR, never a value — fail-closed on an absent/empty scope too) →
**actor** gate (`operator-only` refuses under an agent actor, mirroring the
guardrails gate's fail-closed posture) → the host value. **Placeholder injection**
(the browser-use pattern): a tool's `secrets: [name]` list resolves in
`use/act.mjs` BEFORE the run starts (any failure refuses the WHOLE run, never a
partial one) and lands in the child's env as `ZZ_<NAME>` — never in `inputs`, the
return value, or an agent's context; `notes/log.mjs`'s `logRun` additionally masks
those names' resolved values out of `runs.jsonl` even under an unrelated input key
("redact at the injection site" — transformation defeats post-hoc masking). `zz
secret list` / `show` / `check` are the read-only view (metas + a ✓/✗ host
availability probe — NEVER the value, not even for a non-sensitive declaration); `zz
secret declare <name> [--scope …] […]` is the one write leaf — operator-lane
AUTHORING sugar over the same `note create` write door, typed for a declaration's
metas, with no value flag at all; there is still no `secret set` — setting a value
is always a terminal call, documented per `resolves_from`, not a zuzuu-owned file.
Full narrative: [`docs/guide/Secrets.md`](guide/Secrets.md).

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
- **act** — run a runnable note, gated + allowlisted (each run appends to `runs.jsonl`). *Family:* `flow` (a `type: workflow` DAG of run-steps, compensating on failure). **The safety floor** (§I rung 3, `use/act.mjs` · `use/run-lock.mjs`): every run gets a clamped **timeout** (`timeout:`, default 120s, cap 600s) · the guardrails gate fails **CLOSED** for an unattended `agent` actor (malformed rule / engine error / `ask` verdict all deny) while an interactive `operator` keeps the original fail-open contract · run-log inputs are **redacted** (secret-shaped keys, secret-matching values) before they reach `runs.jsonl` · a per-note **run lock** refuses a concurrent run of the same note, stealing only a stale (crashed-past-its-timeout) one. **Composition** (§I rung 1, `use/workflow.mjs`): a `flow` step is EITHER `run:` (inline shell) OR `note:` (a `module:id` reference to another runnable note) — never both. A `note:` target is resolved at run time through the SAME path a top-level caller would use for that address: a leaf note (has `run:`) goes through `act()` itself (its own run-lock, its own gate, its own `logRun`); a `type: workflow` note **recurses** into `runWorkflow`, so workflows compose workflows. Both composed shapes are still **Tier-0/1 invocations** (§I.3) — composition adds no new execution primitive, only reuse. A visited-set of `module:id` addresses (every workflow on the current call stack) catches a direct or transitive cycle before any lock is touched (`{ok:false, error:'workflow cycle: a→b→a'}`); `MAX_COMPOSITION_DEPTH` (20) backstops a long acyclic chain the visited-set can't see. The composed call always carries the **parent's actor** (never silently `operator`), so an agent-run composition keeps its fail-closed gate posture all the way down. A composed target acquires **its own** run-lock (refused if it's independently running elsewhere); the parent's own lock — acquired once, for the whole run — is never re-touched. On failure, a referenced **workflow** runs its **own** saga (compensations) to completion, synchronously, BEFORE the failure surfaces to the parent as that one step's failure — so a deep composed failure unwinds inner-saga-first, outer-saga-last, never interleaved. Every composed run's own `runs.jsonl` entry carries an optional `via: <module:id>` marker naming its **immediate** parent (absent on a non-composed run) — the seam the runs-miner (§I rung 2, below) walks to attribute a composed failure to the workflow that triggered it.
- **check** — integrity: broken links · orphans · stale. *Family:* `validate` (the type-keyed invariants **plus** a module's declared typed-column **schema** — a `module.md` `fields` block, the 8 FieldTypes — enforced as a **pre-write reject** at the write boundary: a note that violates its schema never lands. "A module is a TABLE, a note a ROW, the columns are the schema"; absent `fields` ⇒ schemaless).
- **run** — the **Tier-2 DURABLE RUNNER** (§I.3/§I.4, `grow/run.mjs` + the `run` CLI namespace): **the run is a note**. `act`/`flow` are synchronous, in-process, seconds-long (Tier 0/1); `run` is their async sibling for procedures that legitimately span DAYS (a human step, an external wait) without any long-lived process — durability comes from the note + git, not from process supervision (§I.3's inversion: zuzuu is the CONTROL PLANE, never a Temporal-grade execution ENGINE). `zz run start <module:id>` reads a `type: workflow` note, **PINS** its ACTIVE generation (`workflow_generation`), and creates a `type: run` note (a dedicated `runs` module — deliberately OUTSIDE the five `STANDARD_MODULES`) whose `steps` mirror the workflow's DAG at pending/attempts:0 — materializing the state machine WITHOUT executing anything. `zz run advance <id>` is the **TICK**: it re-reads the workflow def AS-OF the pinned generation (`notes/generation.mjs`'s `noteAsOf`, a single-note time-travel read — a LIVE edit to the workflow after start never reaches an in-flight run), finds the next step whose `depends-on` are all `done`, and executes EXACTLY ONE step through the same gated `act()`/`runGated` path Tier 0/1 use (a step is `run:` · `note:` · or `wait:{on,timeout?}` — closed vocabulary), writing the new state back through the one write door. Crash-safety = the note IS the state (a re-tick after a crash just re-reads it); semantics are **AT-LEAST-ONCE**, never "exactly-once" — a side-effecting step's `idempotency_key` is stable across retries so a duplicate re-attempt is at least *recognizable*. `zz run advance --all` is a bounded convenience loop (still sequential ticks, never a daemon) that stops at `done`/`waiting`/`failed`. A `wait` step parks the run at `status: waiting, waiting_on: <signal>` — a 3-day human step is just a STATE, visible in the table — resumed by `zz run signal <id> <name>` or `zz run complete <id> <step>`; a declared `wait.timeout` is evaluated lazily on the next advance (no scheduler this rung — triggers are §I rung 4, deferred). `retry: {max}` re-picks a failed step up to max attempts; past max (or with none declared) the run fails and the **saga** compensates its `done` steps in reverse completion order — STOPPING (not skipping) at the first `irreversible: true` step, honesty over a fake rollback. Full narrative: [`docs/guide/Workflows.md`](guide/Workflows.md).

### Grow — the loop (every write human-gated)

**Five beats** — `stage` and `evolve` are loop beats, not typed verbs; `snapshot` is not a beat
(minting a generation is part of evolve). Each approved change commits as a **git-native
generation** (Plane 1), so growth *is* git history.

- **observe** — mine the host's own on-disk transcript (never drives the agent — *adding a host = one adapter file*); route corroborated per-session signals → staged changes via the declarative `ROUTE` table (reaching 4 of the 5 standard module kinds). **The runs-miner is observe's SIBLING** (§I rung 2, `grow/runs-miner.mjs`) — same shape, a different feed: it mines `runs.jsonl` (what actually RAN, not what was said) instead of session transcripts. `mineRuns(home, {module?, sinceTs?})` is a PURE function grouping runs by the note they ran into per-note evidence (total runs · failure count/rate · a TRAILING consecutive-failure streak — is it failing *right now*, not "has it ever" · timedOut count · first/last seen). A note crosses the threshold at ≥3 consecutive failures OR ≥50% failure rate over ≥4 runs (both exported constants) and gets flagged. This is the designed feedback edge (`runs.jsonl` has been annotated "observe's feedback edge" above since the safety floor landed, but nothing walked it until now) finally wired — self-correction is now real, and still gated: the miner does not diagnose a fix (it isn't an LLM); it stages one **aggregate** `update` proposal per flagged note (never one per failed run — §I.2 B2, review fatigue is the moat's real enemy) setting a tolerated custom `health: 'needs-attention'` field — never `status`, a separate lifecycle some modules give typed meaning to — carrying the evidence + a rationale for whoever reviews it. Idempotent (a still-failing note collapses re-runs to the same staged row, both via `stage.mjs`'s own content-hash id and an explicit pending-proposal guard). `zz observe-runs [module] [--since <iso>] [--dry-run]` is its CLI door, mirroring `observe`'s own row.
- **stage** — the typed, deduped, ranked **staged-change** queue (`<module>/staged/`; decided changes move to `staged/archive/`, never deleted). A module **materializes on its first staged change** (its `module.md` minted from a template — the "no prebuilt modules" rule). *(Renamed from `propose` — the noun collided with the verb; `staged → review → evolve` mirrors git's `staged → committed`.)*
- **plan → apply** — `plan` bundles a module's pending set into ONE content-addressed **change-set** + its diff (a dry-run, writes nothing); **apply** commits the whole set as one generation, all-or-nothing (reverts via `git restore` mid-batch). The id is a TOCTOU guard; Terraform's `plan → apply`. A single change is a plan-of-one.
- **review** — **the human gate**: approve or reject. *"The gate is the moat"* — the one door to a Project. `validate` runs first; a malformed note (or a note that violates its module's typed-column **schema**) is refused before it lands.
- **evolve** — execute the approve. It now feeds **the one write boundary** — `grow/commit.mjs`, the **sole note-writer + the loop's sole minter** (2026-06-28): a batch applies all writes as one all-or-nothing transaction, then mints *once* per touched module. `commit` validates, logs, mints, and **refuses an agent-stamped write** — so the agent can only reach it through `review`. The moat is now *structural* (zero writers bypass `commit`), not a convention.
- **trigger** — automation itself is a gated, versioned NOTE (§I rung 4, `grow/trigger.mjs` + the `trigger` CLI namespace): a `type: trigger` note names WHEN (`on: {kind: manual|note-change|cron|ingress, …}`) and WHAT (`run: <workflow-module:id>`) — never a new execution path. It adds **NO new authority**: `zz trigger fire <m:id>` resolves the target and calls the durable runner's `startRun` — the exact same gate/timeout/generation-pin a manual `zz run start` gets. `enabled: bool` is the **SECOND gate** (§I.4 #7, Argo's layered def-change gate): a trigger can be reviewed-in (staged → approved) yet stay OFF until a human `zz trigger enable`s it — `zz trigger disable` flips it back, both a plain scoped note edit (`grow/edit.mjs`'s `patchNote`) through the one write door. `zz trigger list`/`show` surface the **blast-radius** safety affordance (§I.2 B2 / Apollo's "current matches: N"): for a `note-change` trigger, `triggerMatches` reuses the SAME index query path `zz query --where` uses to count (+ sample) how many notes its filter currently matches — a pure read, no side effects. `zz trigger fire … --dry-run` previews the same thing without starting anything; a disabled trigger REFUSES to fire unless `--force`. Firing semantics (a documented choice): a `note-change` trigger's fire starts exactly **ONE** run, carrying the trigger's `inputs` PLUS the matched-note context (`MATCHED_COUNT`/`MATCHED_SAMPLE`) — never one run per matching row (that's a batch concern, undesigned); a `cron` trigger fired manually just runs its target once (`on.expr` is read by nothing local — it exists so the note is ready for the DEFERRED hosted scheduler with no later migration). `notes/validate.mjs` gates the shape at the SAME write door every note passes: a valid `on.kind`, a well-formed `note-change` filter, a parseable `cron` expr. There is no `trigger create` verb — a trigger is created exactly like any other note (`zz note create … --type trigger`, the operator lane) or PROPOSED by an agent via `zz stage` → `zz review approve` (the sanctioned channel; `trigger fire/enable/disable` are `agentInvokable:false`, denied to an agent actor by the SAME generated gate pattern every other durable write uses — that pattern lives in the seeded `protect-brain-exec` rule note, which `zz init` now RECONCILES on every run rather than seeding once, and which seeds in root-mode too; `zz doctor` flags it missing/stale — see docs/audits/2026-07-03-triggers-review.md SHOULD-FIX 1). **Deferred, hosted-tier only** (§I.2 B4's honest boundary — a laptop must not fire triggers unattended): the unattended cron SCHEDULER, INGRESS webhooks, and note-change AUTO-firing. `zz doctor` names a declared `cron` trigger as hosted-only so the gap is discoverable, never silent. Full narrative (the "Triggers" section): [`docs/guide/Workflows.md`](guide/Workflows.md).

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
[glossary](learn/glossary.md).)*

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
- **the workbench** — the browser visual surface: terminal + explorer + Monaco editor + the **modules dashboard** (the browser face of `review`) + the **composer** (a *remote keyboard* into the host's TUI — types into the live host CLI, never drives it headlessly). A *view onto* a Project, not the Project. *(Design research for the next workbench phase: [`docs/design-research/workbench/`](design-research/workbench/).)*

## Plane 4 — Identity & naming

- **zuzuu** — **the product / system / CLI** (`zz`, package `@zuzuucodes/cli`), and the home dir name (`.zuzuu/`). *No longer overloaded with the per-repo entity* — that's a **Project** now.
- **Project vs repo** — a **Project** is the `.zuzuu/` (the zuzuu entity, *note › module › Project*); the **repo** / codebase is the code it lives in. Keep them distinct.
- **the home / `.zuzuu/`** — the directory that holds a Project.
- **historical names** — `motorsandsensors`/`mns`, `zuzuagents`/`zuzu` → **zuzuu**. Expected in older docs (see the [glossary renames table](learn/glossary.md)).

## Tiers (where it's going) — linked out

How zuzuu is packaged & sold is *strategy*, not core ontology — the full model lives in
[`docs/specs/2026-06-22-tiered-architecture.md`](specs/2026-06-22-tiered-architecture.md). In one breath: **OSS** (free, local, solo — the built product) ⟷ **Pro** (paid, hosted VM) on the *compute* axis; (OSS/Pro) ⟷ **Enterprise** (org admin control-plane) on the *control* axis; **zuzuu-codes** (our owned harness, credits-metered) cuts across. Pinned by *100% git-native, no live API* — so cross-project is a **roll-up** + an **org module registry** (a git workflow), never one big Project.

