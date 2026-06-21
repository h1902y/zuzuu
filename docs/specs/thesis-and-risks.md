# zuzuu — Thesis & Risk Register

- **Status:** foundational / pre-build. Settles the seed before any from-scratch build.
- **Date:** 2026-06-17
- **Why this doc:** implementation planning (the CLI-revamp stages) kept circling because the seed wasn't pinned and its failure modes weren't named. This is the artifact that makes "build from scratch" safe: the thesis stated canonically, every loophole with severity and the design commitment that neutralizes it.
- **Companion:** `docs/specs/cli-revamp.md` (the architectural staging). Supersedes nothing there; it sits *above* it — the cli-revamp stages are only worth running if the commitments here hold.

---

## 1. The seed

Two layers over a directory of opinionated files, plus a loop that grows them.

**The data layer.** A file = markdown body + YAML frontmatter (key–value pairs) + typed links to other files. A folder of these is a local, server-less store that shell commands query **relationally and graph-wise**. It is *context-frugal*: the agent **queries** the corpus instead of **ingesting** it — the empirically correct bet (Mem0: ~90% token savings vs full-context; validated in `docs/specs/cli-revamp.md` prior-art brief).

**The actions layer.** Primitive shell commands, composed in a contained shell, are the agent's toolkit. Any operation the user did by hand becomes a callable, inspectable, reusable action.

**The loop.** A terminal-driving agent does what the user used to do by hand in a project directory — decks, reports, client file systems, todo lists. The user just chats. Sessions feed an evolve loop that **proposes** new memory units and new actions, human-gated, so the system grows opinionated to the user's style across sessions.

**The one-line bet:** *an opinionated filesystem + contained shell + a human-gated evolve loop turns the terminal into a project operator that compounds with use.*

## 2. What is genuinely novel vs borrowed

Borrowed (validated prior art — low risk): markdown+frontmatter substrate (OKF, basic-memory, Obsidian), CLI-first tool exposure over MCP (Perplexity defection, YC), filesystem-as-registry (K8s, Nix, oclif), markdown→SQLite index (MarkdownDB, kg), pointer-flip snapshots (git, Nix, Jujutsu).

**Novel (the real bets — where it can break):**
1. Portable, zero-dep, CLI-native **graph + relational query** over markdown.
2. That query layer **wired into a human-gated evolve loop** (sessions → proposed memory/actions).
3. A **contained shell** as the agent's whole toolkit under one safety model.

Risk concentrates exactly on the novel parts. The register below is ordered by severity, not by layer.

---

## 3. Risk register

Severity: **F** = fatal-if-unaddressed (resolve before building) · **S** = serious (shapes the design) · **T** = strategic (name it, decide it).

### R1 (F) — The actions-layer safety model

**The hole.** A regex `PreToolUse` gate cannot contain a shell. Shell is Turing-complete and evasion-rich (base64, `eval`, env indirection, write-then-run, interpreter shell-out). Proven in our own history: a session bypassed the force-push rule with `git -C /path push`. Pattern-matching gives **false safety** — worse than none — the moment agents run arbitrary terminal work.

**The hard truth.** You cannot have all three of {arbitrary terminal takeover, real containment, no sandbox infra}. Everyone who actually contains agent shells (Vercel Sandbox, Cloudflare Sandbox, Claude's bash tool) uses VM/container isolation.

**Resolved — borrow, don't build (research run `wf_dee3864d-734`).** There is **no single protocol** for local shell containment; Codex/Claude Code/Cursor all independently assembled the *same* stack from OS primitives. zuzuu adopts it as **two layers, three tiers**:

- **Tier 0 — advisory/audit (honest).** The existing regex `guardrails` gate, kept explicitly as an *observation signal, not a boundary* (Anthropic's own data: permission prompts hit ~93% approval → the gate is UX, not security). Optional in-process upgrade: OPA-WASM or Cedar-WASM (zero native dep, sub-ms eval) for declarative, deny-overrides authorization.
- **Tier 1 — local-contained (the R1 fix; default for `zz act`).** **Adopt `@anthropic-ai/sandbox-runtime` (srt)** (Apache-2.0) as an `optionalDependency`/addons-tier backend — it covers **macOS Seatbelt** (`sandbox-exec`, zero-install) *and* **Linux bubblewrap + seccomp + Landlock** (system binaries we `spawn`, so the CLI core stays zero-dep) behind one API. The **session worktree (Wave B) is the directory boundary** — mount only it writable → the "this directory declares its toolkit" intuition with zero extra config. Carve **`.zuzuu/` read-only inside the writable root** (the self-modification attack; Codex carves `.git`/`.codex` — copy verbatim). `zz doctor` detects the Ubuntu 24.04+ AppArmor userns caveat.
- **Tier 2 — sandboxed/untrusted (kernel isolation).** MicroVM for hostile/heavy work: **SmolVM** (Apache-2.0, runs natively on a Mac via Hypervisor.framework — no KVM) locally; **e2b** or **Vercel Sandbox** (Firecracker) for cloud. This is the tier that closes the shared-host-kernel gap.

**Do-now seam (cheap, before any sandbox exists):** standardize `zz act`'s return type to `{stdout, stderr, exitCode, success}` (Cloudflare/e2b/Modal all agree) so the Tier-1/Tier-2 backends drop in cleanly later. Adopt the PreToolUse `exit 2 = block` contract (already zuzuu's shape) and a Deno-2.5-shaped two-axis policy (`filesystem.allow/deny` + `run.allow`).

**Honest residual (the one part with NO prior art):** *no* surveyed product does command-level allowlisting — they all scope filesystem+network and leave the command surface open once inside. zuzuu's "directory declares its *command* toolkit" is therefore a **novel layer above srt**, and its evasion-resistance is unproven. Also unclosed: macOS Seatbelt is Apple-deprecated with no announced successor for headless CLI. Both go in the build's eyes-open column.

### R2 (F) — The data layer doesn't own its writes

**The hole.** A database controls its write path; this "data layer" is a query veneer over a directory that any process — the agent's own `mv`/`sed`/`rm`, other tools, the user — mutates freely. So the index perpetually races reality, typed links rot silently on rename/delete, and there is no referential or transactional integrity. "Best-effort graph" + "agent makes confident decisions from queries" is a correctness trap.

**Commitment.** Treat the index as a *strictly derived, cheaply rebuildable cache* and make derivation cheap enough to run opportunistically (mtime/hash check on read; full rebuild is idempotent and fast). Make **integrity a first-class, queryable capability**, not a hidden assumption: `orphans`, `broken-links`, `cycles`, `stale-index` are verbs the agent (and the human) run. Links carry a stable id, not a path, so rename survives. Accept that absolute integrity is impossible without owning writes — and make *detecting* divergence trivial instead of pretending it can't happen.

### R3 (F) — The node-vs-artifact boundary

**The hole.** Markdown+frontmatter shines for knowledge notes (prose + a few tags). It is a bad fit for the *work products* the thesis names — a 500-row report, a client file tree, a deck, a todo graph with dates/dependencies. The thesis silently conflates "knowledge about the work" with "the work itself."

**Commitment.** Draw the line in the model: the data layer holds **knowledge nodes** (markdown items) and **metadata-about-artifacts** (a node that *describes and points at* a deck/sheet/binary), never the artifacts themselves. Artifacts live as ordinary files the actions layer produces and operates on; the data layer indexes their metadata and relations. Tabular/relational project data (todos, client records) is a candidate for a structured item kind with enforced schema — *not* free-form prose. State explicitly what is a node and what is a file.

### R4 (S) — Context-frugal retrieval hides a meta-knowledge problem

**The hole.** "Query instead of ingest" assumes the agent knows *what to query* — but a good graph/SQL query needs the schema, the tags-in-use, and the link topology, which is itself context. Dataview works because the human knows their vault; an agent does not.

**Commitment.** Ship a cheap, accurate **map surface** alongside recall: a compact, always-current digest of the schema, the live tag/relation vocabulary, and capability list (the "notes/discovery surface" from cli-revamp). The agent reads the *map* (small) to form queries against the *corpus* (large). Retrieval verbs default to `brief` (frontmatter + connection ids), with `full` and `--depth`/`--dry-run` as explicit budget levers.

### R5 (S) — Graph-query at zero-dep is the #1 unproven technical bet

**The hole.** Recursive CTEs handle trees to ~depth 6; real graph patterns (shortest path, multi-hop matching) get expensive and awkward in SQL, and a real graph engine is a dependency. The one Cypher-over-markdown precedent (Yamlink) is editor-locked and "unproven at scale" by its own admission.

**Commitment.** Ship the **relational + bounded-traversal (CTE)** surface first and **benchmark on a real corpus before freezing any verb**. The Cypher/GQL syntax is a deferred UX skin over the proven SQL surface, not a prerequisite. Graph engines / embeddings / DuckDB are `optionalDependencies` (workbench tier), never the core. If benchmarks fail, the honest fallback is "relational + shallow traversal," not a silent dependency.

### R6 (S) — Crystallizing actions captures the mistakes too

**The hole.** Sessions are full of dead-ends, corrections, one-off accidents. Mining "what the agent did" risks minting brittle or wrong procedures (the exploratory `rm` later undone), and a confidently-reused bad action is worse than none. "Is this procedure actually *general*?" is the hard, unsolved part.

**Commitment.** Bias the miners toward **high-precision, low-recall**: require cross-session corroboration before proposing an action (already the guardrails-miner discipline), prefer proposing *parameterized* procedures over literal command transcripts, and surface the supporting sessions as evidence in `review`. A proposed action ships with its provenance and a dry-run; the human gate sees *why* before approving. Never auto-promote.

### R7 (S) — Registry-governed frontmatter fights open-world capture

**The hole.** Real work is open-vocabulary. If every key must pre-exist in a registry, the agent either bottlenecks on the human gate per new key or bypasses the registry — back to freeform. The prior-art lesson is the opposite of governance (OKF requires only `type`; every required field is a write tax).

**Commitment.** The registry is **descriptive, not prescriptive** by default: new keys are accepted and *observed* (the registry learns the live vocabulary), with validation opt-in per item kind where structure genuinely matters (e.g., a guardrail rule's `action`/`pattern`). Required frontmatter is minimal. Governance is a capability a kind can request, not a tax every item pays.

**Resolved — adopt OKF v0.1 verbatim** (Google Cloud, Apache-2.0, published 2026-06-12; research run `wf_dee3864d-734`). It formalizes exactly what `.zuzuu/knowledge/items/` already does, and its rules *are* the descriptive-registry commitment: **exactly one required field, `type`**; **consumers MUST NOT reject unknown keys** (this single rule is what lets miners add metadata across generations with *no schema migration*); markdown links are **bundle-relative** (`/knowledge/items/foo.md`); **broken links are conformant** (so a miner proposal can reference a not-yet-approved item); reserved `index.md` (flat discovery list) + `log.md` (changelog); a **3-rule conformance lint** wired into `zz review`, pure Node, zero deps. Extend additively (`zuzuu_faculty: knowledge`) and stay conformant. Keep the layers separate: **OKF governs the file-format contract; zuzuu's generations/proposals/miners are the human-gated mutation workflow on top.**

### R8 (T) — "Observe, never drive" vs "the agent takes over the terminal"

**The hole.** The repo's identity today is *wrap/serve/observe/evolve — a host we never drive*. The product just described is a **driving harness**: the agent runs the terminal, the user chats. Those are different products with different moats; the data + actions layers are host-agnostic, but "the user just chats with the terminal" is the owned-harness (pi) variant — gated and unbuilt.

**Resolved — decoupled sequence (decided 2026-06-18).** The fork is false: **the faculties are the product and are substrate-neutral; observe and drive are two *ingestion modes*, not two products.** A markdown item / contained action / mined proposal does not care whether the session came from parsing a host's logs (observe) or from a loop zuzuu ran itself (drive). Therefore:

1. **Faculties = the host-neutral core** (`kernel/`: items, query, capability, contained actions, evolve loop) — built on the borrows (OKF + srt + `node:sqlite`), knows nothing about hosts.
2. **Observe = a lean plugin, culled** — capture is an *ingestion adapter*, not the foundation, and shrinks from **5 hosts to 1–2** (Claude Code + maybe OpenCode). Its job is to **solve the loop's cold-start**: the user keeps the agent they already trust, real sessions flow in from day one, faculties accrue value without asking anyone to switch.
3. **Drive = deferred destination** — the owned terminal ("the user just chats") is the pi harness (stage 3), layered on the *same* faculties once the loop has demonstrable value. Building it first triggers a cold-start death spiral (users must abandon a trusted agent for a worse generic one with empty faculties).

**Why this ordering, not just "wrapper is easier":** observe is the trojan horse that seeds the loop; drive is only worth building once the loop has proven value to inject. The moat (the human-gated filesystem-native evolve loop + opinionated substrate) is identical in both modes — it was never the capture pipeline or the owned loop. **Line-count consequence:** v1 ≈ 3,500 (kernel) + ~800 (2-host observe plugin) ≈ 4,300, down from 13,333; drive is additive later, not a rewrite. The clearest over-investment this exposes: five reverse-engineered host log-parsers, four of which only prove host-agnosticism already proven — cull to the hosts that matter.

### R9 (T) — Value is back-loaded; cost is front-loaded and recurring

**The hole.** Day 1 is empty faculties + extra ceremony. Value accrues only after many sessions *and* only if the human keeps paying the review tax. Agents propose faster than humans review → the inbox floods → the gate becomes theater or a stall. The human gate is the moat *and* a throughput mismatch.

**Commitment.** Day-1 value must come from the **terminal agent itself** (a strong contained operator), with faculties as compounding upside, not the entry ticket. Make review **batched, ranked, and cheap** (`eval` ranks; `review` is one-keystroke; trivial/corroborated proposals can be auto-staged for a lighter touch). Measure the loop's payoff (proposals approved per session, faculty hit-rate) so the tax is visibly earned.

### R10 (T) — Faculties rot; differentiation window is closing

**The hole.** "Opinionated to the user" also learns stale conventions and dead facts; without decay detection, Q1's truth misleads in Q3. Separately: Claude Code (memory, skills, hooks), Cursor (rules), Codex are all converging on "chat-with-a-terminal-that-remembers" — the wedge is the *human-gated filesystem-native evolve loop*, but a big lab can bolt it on.

**Commitment.** Adopt **bitemporal validity** (`valid_from`/`superseded_by`) so recall is staleness-aware and rollback-aware via plain queries; add a `stale`/`review-rot` capability. On differentiation: the defensible core is the **loop being genuinely better** (precision of proposals, fit to the user's style), plus local-first + portability — not mere presence of memory. Treat it as a race, not a sure moat.

---

## 4. The load-bearing decisions

Of the three correctness gates, **R1 (safety) is now resolved by borrowing** (adopt srt; tiers above) and **R7 (frontmatter) by adopting OKF**. Two remain open and gate everything:

1. ~~**The safety model (R1)**~~ — **resolved:** Tier-0 advisory gate + Tier-1 srt (Seatbelt/bwrap, worktree-scoped, `.zuzuu/` carved RO) + Tier-2 microVM. Residual: the novel command-axis + Seatbelt deprecation (eyes-open, not blockers).
2. **Write-ownership & integrity (R2)** — *open.* Index is a derived cache; integrity (`orphans`/`broken-links`/`stale-index`) is a queryable capability; links are id-based. The srt worktree boundary helps but doesn't make writes transactional.
3. **The node-vs-artifact boundary (R3)** — *open.* Nodes = knowledge + artifact-metadata; artifacts = files; structured kinds get enforced schema. Needs the explicit line drawn, with examples.

The next tier — the graph-query bet (R5, benchmark-gated) — shapes sequencing but isn't a correctness gate. **R8 (observe-vs-drive) is now resolved** (decoupled sequence: faculties = host-neutral core; observe = lean culled plugin to seed the loop; drive deferred). That resolution sets v1 ≈ 4,300 lines and the 5→2 host cull.

**Deferred graph anchor (not-now).** When the graph layer is taken up, borrow the **Apache AGE** thesis — *graph as a compile-to-SQL façade over a proven relational engine, never separate storage* — not its syntax. Watch **SQL/PGQ** (ISO standard, PostgreSQL 19) as the lower-lock-in successor, and **graphqlite** (97.7% openCypher TCK over SQLite, MIT) as the closest `node:sqlite`-adjacent precedent. **Hard blocker to resolve first:** all of these need a *native compiled extension*, which `node:sqlite` cannot load without FFI/worker/wasm — a dep-footprint question, not a research question. Stays parked per decision.

## 5. What "build from scratch" must answer

A from-scratch build is only safe once it has concrete answers to:

- What is the **trust boundary** for shell execution, and what runs where (local-trusted vs sandboxed)?
- How does a **read know the index is fresh**, and what's the cost of being wrong?
- What is a **node** and what is a **file** — the exact line, with examples (a deck, a 500-row report, a todo with deps)?
- How does the agent **learn what to query** without ingesting the corpus (the map surface)?
- What query power ships in the **core** (relational + CTE) vs **optional** (graph/vector), and what's the benchmark that freezes it?
- ~~Is this the host-agnostic faculty layer, the owned driving harness, or the former now and the latter later?~~ **Resolved (R8):** host-neutral faculty core now; observe as a culled ingestion plugin to seed the loop; owned driving harness deferred as the destination on the same faculties.
- What is **day-1 value** with empty faculties, and how is the review tax kept cheap and visibly earned?

## 6. Verdict

None of these are reasons not to build — they are the spec for what building must answer. The thesis is sound and largely backed by convergent prior art; the danger is entirely in the three novel bets and the safety boundary. Settle §4 (the three load-bearing decisions) and §5 (the seven questions), and the `cli-revamp.md` staging becomes safe to execute — starting, as planned, with the capability-registry collapse.

---

## Appendix A — Worked examples: what a note and an action look like

The two borrows compose through **one substrate**: both files are the same OKF envelope (only `type` required, unknown keys tolerated). An **Action is just a Note** whose frontmatter additionally declares *how to run it* (`run`, `inputs`) and *what it may touch* (`policy`). Same index, same graph queries, same evolve loop, same review gate apply to both.

### A note (knowledge item)

`.zuzuu/knowledge/items/client-acme-deck-style.md`

```markdown
---
type: knowledge              # the ONE OKF-required field
id: client-acme-deck-style
title: Acme prefers minimal blue decks
status: active
created_at: 2026-06-18
tags: [client-acme, design, decks]
relations:                   # typed, bundle-relative links (OKF) → graph edges
  about: /knowledge/items/client-acme.md
  supersedes: /knowledge/items/client-acme-deck-style-v1.md
valid_from: 2026-06-18       # bitemporal (R10) — recall can be staleness-aware
provenance:
  - { session: ses_3f9a21, ref: turn-14 }
---

Acme's brand lead wants decks minimal: a blue (#0B5FFF) accent on white, one
idea per slide, no clip-art. Confirmed twice across sessions.
```

Body = the knowledge (prose). Frontmatter = the queryable metadata + the edges.

### An action (runbook + policy)

`.zuzuu/actions/items/build-weekly-report/index.md` (a directory bundle: `index.md` + `build-weekly-report.sh`)

```markdown
---
type: action                 # same OKF envelope, different type
id: build-weekly-report
title: Build the weekly client report deck
status: active
created_at: 2026-06-18
tags: [reporting, decks]
relations:
  uses: /knowledge/items/client-acme-deck-style.md   # an action can cite a note
inputs:
  - { name: client, required: true }
  - { name: week, required: true }
run: ./build-weekly-report.sh        # the script bundled beside this file
policy:                              # the srt-shaped containment declaration
  tier: contained                    # advisory | contained | sandboxed
  filesystem:                        #   ↓ enforced by srt (Tier 1, kernel-level)
    allowWrite: ["./reports/", "./.tmp/"]
    denyRead:  ["~/.ssh", "~/.aws", "./.zuzuu/"]   # .zuzuu/ carve = self-mod defense
  network:                           #   ↓ enforced by srt (Tier 1)
    allowedDomains: []
  run:                               #   ↓ enforced by ZUZUU (novel command-axis)
    allow: [python3, pandoc, git]
provenance:
  - { session: ses_77b1c0, ref: turn-9 }
---

## What it does
Generates `reports/<client>-<week>.pdf` from the metrics CSV, in the client's
deck style (see relations.uses).

## Steps
1. Pull `data/<client>/metrics.csv`.
2. Render slides via pandoc with the blue-minimal template.
3. Write the PDF to `reports/`.
```

Body = a human-readable runbook. Machine parts = `run` + `inputs` + `policy`.

### Reading the design

**Same substrate, three additions for actions.** A Note has prose + relations. An Action adds exactly `run`, `inputs`, `policy` — nothing else differs, so all the data-layer machinery treats them identically.

**The `policy` block is where the two borrows meet — and it is explicit about who enforces what:**

| Field | Enforced by | Tier |
|---|---|---|
| `filesystem.allowWrite` / `denyRead` | **srt** (Seatbelt / bwrap+Landlock) | 1 — kernel |
| `network.allowedDomains` | **srt** | 1 — kernel |
| `run.allow` (the command toolkit) | **zuzuu** — the novel command-axis layer | 0 — advisory + our check |

srt enforces the filesystem/network rows; `run.allow` ("from this action, only these binaries") is the no-prior-art part built **above** srt (per R1). Policy is **per-action** (the `fence` pattern), not one global allowlist.

**Two file shapes by action type:** a *script* action is a **directory bundle** (`index.md` + its `.sh`, matching the dir-shaped actions module and OKF's reserved `index.md`); a pure *recipe* action (shell steps only, no script) is a **single `.md`** with steps in the body.

**It composes into the graph.** `relations.uses` is a real Action→Knowledge edge — so "what does this deck-builder depend on?" and "if Acme's style changes, which actions are affected?" are graph queries over the same files. The data layer and actions layer are linked through one substrate — the thesis, made concrete.

**Open micro-decision (not blocking):** whether OKF's required `type` *replaces* the current envelope's `kind`/`module` fields or sits alongside them. Cleanest: `type: action` **is** the kind, `module` is derived from the directory — one fewer required field, more OKF-conformant.

---

## References

- `docs/specs/cli-revamp.md` — architectural staging + the 6-angle prior-art brief (workflow `wf_19c67263-4c2`).
- Shell-containment + OKF/AGE research: workflow run `wf_dee3864d-734` (10 angles).
- Key adoptables: `@anthropic-ai/sandbox-runtime` (github.com/anthropic-experimental/sandbox-runtime, Apache-2.0) · OpenAI `codex-linux-sandbox` · macOS `sandbox-exec`/Seatbelt SBPL · bubblewrap + Landlock + seccomp · SmolVM (smol-machines/smolvm) · e2b / Vercel Sandbox · OKF v0.1 (GoogleCloudPlatform/knowledge-catalog/okf) · Apache AGE / SQL-PGQ / graphqlite (deferred graph anchor).
- Grounding dossier: `/tmp/compound-engineering/ce-brainstorm/cli-revamp/grounding.md`.
- Project canon: `docs/DESIGN.md`, `docs/LOG.md`, `CLAUDE.md`.
