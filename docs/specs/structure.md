# Structure & Capabilities — the canonical reference

- **Status:** design spec (build contract). The exact shapes + the verb surface the codebase cleanup implements.
- **Date:** 2026-06-21
- **Reads with:** `enhance-and-sessions.md` (the loop), `from-scratch-blueprint.md` (build order), `thesis-and-risks.md` (the why + the borrows). This doc is the *what* — pinned.

---

## 0. The essence

> **Everything is an envelope.** A markdown body + YAML frontmatter, distinguished by `type`. A *zu* is an envelope. A *module*'s manifest is an envelope. The brain is a directory of envelopes — queried, run, and grown, all human-gated. Capabilities are CLI verbs over envelopes. A *session* is a conversation is a git branch; what it learns flows, gated, into the brain.

The whole system reduces to: **one file format · three nouns · five verbs · two processes · one gate.**

## 1. The lexicon

The vocabulary nests, and the verbs read as a sentence: *you **query** what's true, **act** on it, zuzuu **observes**, **enhances**, you **review**.*

**Nouns — what exists**

| Term | Is | Realized as |
|---|---|---|
| **envelope** | the one file format — md body + YAML frontmatter | every file below |
| **zu** | the atom — one fact, optionally runnable | `items/<id>.md` |
| **module** | a goal-shaped collection of zus | a folder + `module.md` |
| **project** | the standing home — all modules + live state | `.zuzuu/` |
| **session** | one conversation = one git branch | a `zz/session-*` branch |
| **turn** | one agent step (the session atom) | one checkpoint commit |
| **episode** | a pursuit of one objective, with an outcome | a span of turns → one squash commit |

**Verbs — what you do** (the capabilities)

| Verb | Does | Layer |
|---|---|---|
| **query** | read the brain — search zus, on demand | knowledge (read) |
| **act** | run a runnable zu, contained | actions (do) |
| **enhance** | mine conversation + log → propose growth | the loop (grow) |
| **review** | the human gate — decide on proposals | the loop (decide) |
| **check** | integrity — orphans, broken links, cycles, stale | the brain (verify) |

**State — what's ephemeral**

| Term | Is | Lives in |
|---|---|---|
| **live** | the current session's working state | `.zuzuu/.live/` (gitignored) |
| **intent** | the steerable objective stack | `.live/intent.md` + `.json` |
| **digest** | the session-start brief | `.live/digest.md` |

## 2. The envelope

One format, one parser. Only `type` is required (OKF); unknown keys are always tolerated (so the brain learns new vocabulary without migrations). Distinguished by `type`, used for zus *and* manifests.

```markdown
---
type: knowledge        # the only required field — selects the kind
# everything else is optional / per-type
---
Prose body — human- and agent-readable.
```

The kernel has exactly one thing to parse and validate. A zu, a `module.md`, (later) even a project manifest are all this.

## 3. The zu — the atom

```markdown
---
type: knowledge                 # knowledge | action | rule | episode | … (per-module)
title: Acme prefers minimal blue decks
status: active                  # lifecycle ONLY: active | archived | deprecated
created_at: 2026-06-21
tags: [client-acme, design]
relations:                      # typed, id-based edges — the graph
  about: client-acme
  supersedes: client-acme-style-v1
valid_from: 2026-06-21          # bitemporal (optional) — staleness/rollback-aware recall
superseded_by:                  # set when retired; recall filters by validity
provenance:
  - { session: ses_3f9a, ref: turn-14 }
# ── present only when the zu is runnable (an "act") ──
run: ./build.sh                 # inline one-liner OR a bundled script path
inputs: [{ name: client, required: true }]
policy:                         # the srt-shaped containment contract
  tier: contained               # advisory | contained | sandboxed
  filesystem: { allowWrite: ["./"], denyRead: ["~/.ssh", "./.zuzuu/"] }
  run: { allow: [pandoc, git] }
---
Prose body.
```

**The three rules that make it work:**

1. **id = the filename stem.** `client-acme-style.md` → id `client-acme-style`, module-scoped (`knowledge:client-acme-style` across modules). Strict OKF minimalism — no id field. Rename is a *managed op*: it updates referrers, or `check` surfaces the broken ref (OKF: a broken link is conformant — integrity is a queryable capability, not a hard invariant).
2. **Pure definition.** `status` is lifecycle only. A zu **never mutates from being run** — outcomes go to the module's log, not the file. (So there is no `status`-block of last-run results; recall a run by querying the log.)
3. **The act is three more fields.** `run` + `inputs` + `policy`. A knowledge zu and an action zu are the *same* envelope; one gained the ability to run itself.

## 4. The module — a self-curating collection

A module is a folder: one manifest, its zus, its log. **Generic** — there is no per-module code; one module differs from another only by `zu_type`, `schema`, `policy`, and its `enhance.goal`.

```
.zuzuu/<module>/
├── module.md          the manifest (the SAME envelope as a zu)
├── items/<id>.md      the zus (some runnable)
├── log.jsonl          mutations: create/update/delete   (git-TRACKED — durable provenance)
└── runs.jsonl         runs: each execution                (git-IGNORED — local telemetry)
```

**`module.md`** — identity + schema + policy + explainer, in one envelope:

```markdown
---
type: module
id: actions
title: Actions
zu_type: action                 # the kind of zu this module holds
enhance:
  goal: "Capture every repeated multi-step procedure as a runnable zu."   # the ONE-sentence boundary
schema:                         # what a valid zu here must look like
  required: [title]
  relations: [uses, supersedes]
policy:                         # default containment for this module's acts (omit if none run)
  tier: contained
  filesystem: { allowWrite: ["./"], denyRead: ["~/.ssh", "./.zuzuu/"] }
  run: { allow: [pandoc, git] }
---
# Actions
What this module is for, how a zu here is shaped, how it grows.
```

**The event log** — append-only JSONL, schema-bound, a discriminated union keyed by `event`, split by durability (the split is forced by concurrency: two sessions appending runs to a *tracked* file = constant merge conflicts on a file no one reads as source):

```jsonc
{ "event": "create", "ts": "…", "item": "build-report", "actor": "human", "proposal": "prop-3f9a" }  // → log.jsonl
{ "event": "update", "ts": "…", "item": "deploy-target", "from": "<hash>", "to": "<hash>" }           // → log.jsonl
{ "event": "run",    "ts": "…", "item": "build-report", "inputs": {…}, "exitCode": 0, "success": true } // → runs.jsonl
```

**Boundary rule (when is something its own module):** one module = one `enhance.goal` you can state in a single sentence with no "and also." Split by *type/stage/status* is a query, not a module. Modules are born **emergently** — `zz` proposes promoting a cluster when related zus exceed working memory or the goal forks (human-gated), never declared upfront.

**Cross-module sharing:** a zu used by two modules' goals graduates to a **project-level zu** referenced by `module:id` (single home, many pointers) — never copied. The blueprint's R2/R3.

## 5. The project — the home

The `.zuzuu/` home pulls it together. **Tracked = the durable brain; gitignored = local/ephemeral.** Everything tracked is plain text you can read and version. zuzuu is a *git-citizen*: it lives inside the host repo, never `git init`s its own.

```
.zuzuu/
├── README.md                  the explainer (the model, in plain words)
├── schema.json                the envelope spec — descriptive
│
├── <module>/                  one folder per module (built-in + user-defined)
│   ├── module.md  ·  items/<id>.md  ·  log.jsonl  ·  runs.jsonl
│
├── sessions.json              the session index — thin, tracked
│                              { id, state, branch, baseline, previousSession, startedAt }
│
├── .live/                     ephemeral, per-session  (git-IGNORED)
│   ├── intent.md              the objective stack — prose, steerable (you read + redirect)
│   ├── intent.json            the typed stack — agent-written status (never hand-authored)
│   └── digest.md              the session-start brief
│
└── .generations/             content-addressed snapshot store  (project-level)
    ├── .store/<hash>             deduped blobs (fs.linkSync for unchanged)
    └── <module>/<n>.json         per-module generation chains + the active pointer
```

## 6. The session — conversation, git, and the loop

A **session ≡ a conversation ≡ a git branch** (1:1), born lazily on the first file-changing turn. Two tracks run in parallel:

- **conversation track** — every turn (talk or work); the transcript → feeds **Knowledge / Memory**.
- **work track** — file-changing turns = checkpoint commits, grouped into **episodes** → feeds **Actions**.

A **turn** is the atom: a conversational exchange and, if it touches files, one checkpoint commit (`Zz-Session`, `Zz-Intent`, `Zz-Tests` trailers). An **episode** is a pursuit of one objective on the **intent timeline**, ending with an outcome — `done · reverted · superseded · abandoned`. A reverted/discovery episode is the *richest* signal (failure-derived learning beats success-derived). At close, episodes squash to one Conventional-Commit (`Zz-Episode`, `Zz-Outcome` trailers).

**`intent.md` / `intent.json`** — the steerable objective stack (the per-session layer of the three-layer split: steering lives in the instructions module; this is the session plan):

```markdown
# intent.md (prose — you read + steer)
## Task: Improve the catalog import.
## Objectives
1. [done]      add CSV parser
2. [reverted]  try fast-csv  → unmaintained, CVE
3. [active]    add dedup
```

Steering edits the stack (Addition / Revision / Retraction); `enhance` reads it at close. The git substrate carries the durable record — `git log` is the journal; `doctor` reconciles a crashed session from it.

## 7. The capabilities — the verb surface

Designed to **AXI** principles (agent-ergonomic CLI): TOON output (token-dense), brief-by-default schemas, content-first, contextual next-step hints, structured errors + clean exit codes, **no blocking prompts** (only `review` is interactive). The substrate is *files*, so the **human does CRUD by editing files** — the CLI covers only what you can't do by hand.

### query — read the brain
```
zz query [<module>] <q> [--full] [--depth N] [--dry-run] [--fields …]
```
Search zus on demand (lexical + relational + bounded graph). **Brief by default** (id · type · title · connection count); `--full` for bodies; `--depth N` walks relations; `--dry-run` returns a count before materializing. Output is **TOON**:
```
zus[2]{id,type,title}:
  client-acme-style,knowledge,Acme prefers minimal blue decks
  build-report,action,Build the weekly client report deck
help[]: query <id> --full · check --stale
```
Context-frugal twice over: the agent *queries* instead of ingesting, and the answer is token-dense.

### act — run a zu, contained
```
zz act <id> [--in k=v …]
```
The kernel runs the zu's `run` under its `policy` (srt: Seatbelt / bwrap), captures `{stdout, stderr, exitCode, success}`, and appends a `run` event — **one call does run + capture + log** (AXI: combine operations). Tiers: `advisory` (the regex gate, honest — observation only), `contained` (srt, kernel-enforced FS/network), `sandboxed` (microVM, untrusted). Distinct from the agent's *ad-hoc* shell during a session, which the guardrails gate + the session's srt boundary cover.

### enhance — propose growth
```
zz enhance                 # auto-fires at session close; also on demand
```
Per module, reads its `enhance.goal` + the session's two tracks + the event log → **evidence-backed, typed proposals** into the review queue. Mines what *worked* (outcome-driven), prioritizes reverted/discovery episodes, dedups by overlap (4+ shared dims → propose an update, not a new zu). Never writes; never blocks.

### review — the human gate
```
zz review                  # the only interactive command
```
The ceremony: per proposal, **approve / edit / reject / redirect**, plus a Useful/Misleading signal (which adjusts the source miner's trust weight). **Batched** (never one-prompt-per-proposal — the rubber-stamp trap). Approving applies the mechanical CRUD + logs a mutation + mints a generation. *No write to the brain happens without passing here* — the moat.

### check — integrity
```
zz check [--orphans] [--broken-links] [--cycles] [--stale]
```
The brain is best-effort (other processes mutate the files); `check` makes divergence *queryable* rather than pretending it can't happen. TOON report of dangling relations, orphaned zus, cycles, and stale (bitemporally-expired or long-unused) zus.

### The lifecycle verbs — the harness
```
zz init        scaffold the home (git-citizen — detects the host repo, never `git init`s)
zz enable      install hooks (live capture + the contained gate) + emit per-host command files
zz digest      the session-start brief (also injected as a message by the SessionStart hook)
zz session     inspect sessions / episodes — diff · recover · undo
zz module      inspect / manage modules — overview · generations · rollback
zz doctor      health + crash reconciliation (runs enhance retroactively on abandoned sessions)
zz capability  schema <name>  — introspection (the agent's discovery surface)
```

### How the agent invokes them
**CLI-first**, AXI-shaped: the agent shells `zz <verb>` directly. `zz enable` *emits per-host command/skill files* (semantic translation per host) for convenience + discovery; discovery is `--help` + `zz capability schema`. MCP stays a cheap later projection of the same verbs — not in the core.

## 8. The processes

Three processes compose the verbs; all are **generic over modules** (no module names hardcoded):

- **observe** — hooks signal session lifecycle; capture re-parses the host transcript into the trace (Design B: hooks never build spans). Solves the loop's cold-start.
- **enhance loop** — observe (session + log) → `enhance` → propose → `review` → write → snapshot. Human-gated. The compounding engine.
- **serve** — at runtime: `digest` (the map), the gate (on tool calls), `query`, `act`. What the agent uses *during* work.

## 9. The source — what the cleanup builds

The verbs map one-to-one onto the lean kernel (per the blueprint):

```
zuzuu/
├── kernel/         item.mjs · module.mjs · capability.mjs · store.mjs · index.mjs · snapshot.mjs
├── capabilities/   query · act · enhance · gate · check · validate · render · propose
├── pipelines/      observe · evolve · serve
├── hosts/          adapters/ (capture) · capture-core · emit/ (per-host command files)
├── api.mjs         the explicit core API (the web/ daemon calls this — no `--json` scraping)
└── cli/            dispatch + verbs/  (a thin veneer → api)
```

Each capability is one file in `capabilities/`; the CLI veneer routes `zz <verb>` → `api` → the capability. The kernel is the only code that touches `.zuzuu/`. Inner layers never import outer (`kernel ← capabilities ← pipelines ← hosts/cli`).

---

## The whole thing, on one screen

```
   ENVELOPE  (md + frontmatter, by `type`)  ── the one format
        │
   zu ──┴── module (module.md + items/ + log) ──┬── project (.zuzuu/)
   (atom)        (one enhance.goal)              │
                                                 ├── .live/ (intent · digest)   ephemeral
                                                 ├── sessions.json + git         the journal
                                                 └── .generations/               snapshots

   VERBS:  query · act · enhance · review · check          (+ init·enable·digest·session·module·doctor)
   FLOW:   observe → enhance → review → write → snapshot    (human-gated)
   AGENT:  shells `zz <verb>` — TOON output, brief, no prompts (AXI); per-host commands emitted
```

One format. Three nouns. Five verbs. Two processes. One gate. That's zuzuu.
