---
title: "Ontology-aligned reshape — name evolve, file data as data, demote sessions"
date: 2026-06-24
status: live spec, unshipped
---

# Ontology-aligned reshape

> **What this is.** A four-lens audit (structure · performance · correctness · architecture) of
> the codebase against the canonical [`ONTOLOGY.md`](../ONTOLOGY.md) found the structure
> genuinely elegant **except in one concentrated place: the loop's write-half.** This spec
> formalizes the reshape ledger from that audit (recorded in [`LOG.md`](../LOG.md), 2026-06-24)
> into executable units.
>
> **Sequence (important).** This is **ontology-first**: each unit is *also* an ontology
> question. The intended order is — refine the ontology concept → let it reshape the code.
> So treat the "ontology refinement" line of each unit as the decision, and the "code reshape"
> as its consequence. The safe loop/substrate **hardening** (tests + perf) already shipped
> (PRs #72, #73); this spec is the **structural** follow-on, held deliberately so it's done
> against a sharpened ontology, not rushed.

## The one finding, stated once

The directory tree maps cleanly to the ontology's four layers, and a reader can navigate by the
mental model — that elegance is real and load-bearing (see *Preserve*, below). **The drift is
entirely in the loop's write-half:** the ontology names a four-beat loop — **observe → propose
→ review → evolve** — but only three-and-a-half are concepts in the code. `evolve` has no file;
the loop's *data artifacts* (generation · proposal · log) are filed by who-produces-them rather
than what-they-are; `sessions/` is a surface wearing a core-stage location; and observe's routing
is a small closed taxonomy inside an "open-set" ontology. Five units fix exactly this.

## Reshape units

### R1 — Name `evolve` (extract `grow/evolve.mjs`)  · *highest leverage*

- **Ontology refinement:** is `evolve` a real concept or just "what approve does"? The ontology
  already says yes — *"write the note + mint a generation + log it, named as one because they
  never happen apart."* Make the code agree.
- **Current:** `grow/review.mjs` `approve()` (the gate) inlines the entire write half — the op
  dispatch (`create/update/relate/delete/deprecate`), `mergeEdit`, then `logMutation` + `mint` +
  `archiveProposal`. The most important verb in the system is the only one without a name.
- **Code reshape:** extract a pure `evolve(home, module, proposal)` into `grow/evolve.mjs` (the
  write + mint + log). `review` shrinks to *only* the gate — look up the proposal, take the
  human's decision, on approve call `evolve`, archive.
- **Free correctness win:** `evolve` can be made **atomic** (archive/consume the proposal as part
  of the same beat, or order so a partial mint-failure can't leave a re-appliable proposal),
  closing the one real gate re-entrancy edge the audit flagged.
- **Invariant to preserve (the moat):** `evolve` is internal to `grow/`, called **only** by
  `review.approve` — never registered as a capability, never agent-callable. The DAG stays:
  only review→evolve writes the Project.
- **Risk: High** (safety-critical gate). Characterization-first — the gate tests added in PR #73
  (double-approve idempotency, the atomic post-condition, `relate`/target path-safety) pin the
  behavior the extraction must preserve. Files: new `grow/evolve.mjs`; `grow/review.mjs` slims;
  no `serve/api` surface change (`approve` stays the entry, delegating to gate + evolve).

### R2 — File the loop's data as Data (generation · proposal · log)

- **Ontology refinement:** the ontology classifies **generation, proposal, and the log** as
  **Layer 1 (Data)**, but the code files them in `grow/` (Layer 2, the loop). Decide: are these
  *durable shapes* (Data) or *loop machinery* (process)? The audit's read: ~90% Data already —
  `snapshot.mjs`'s content store + `log.mjs` only import `notes/store`.
- **Code reshape:** separate the *persisted artifact* from the *loop verb that produces it*.
  Candidate split — `notes/generation.mjs` (the content store + generation read/list — the durable
  shape) with `grow/snapshot.mjs` reduced to the `mint`/`rollback` *verbs* calling it; likewise
  the **proposal record** (read/list/archive shape → Data) vs `createProposal`'s *staging* logic
  (stays in `grow/propose.mjs`); `log` is nearly all Data already.
- **Effect:** `grow/` reads as *pure process*; the substrate owns all the durable shapes — the
  "notes is the floor" story becomes literally true for every persisted artifact.
- **Risk: Medium** — mechanical moves + import updates; the loop/snapshot tests pin behavior.
  This is the deepest mismatch *and* the most debatable churn — weigh the elegance against the
  diff size; it may land partially (log + generation-store first).

### R3 — Demote `sessions/` to a surface

- **Ontology refinement:** *session ≡ git branch* is **Layer 3 (surfaces)** in the ontology, yet
  `sessions/` (the largest non-substrate dir, ~700 lines) sits beside `notes/use/grow` as if it
  were a core lifecycle stage. It's imported only by `cli/` and `hosts/hook`.
- **Code reshape (decide):** either physically nest it under the surfaces, **or** restate the
  mental model so the eight top-level dirs aren't read as "the lifecycle." Given session-git is
  safety-critical and widely imported, a physical move is the riskier option — the lighter,
  honest fix may be a layering note + a small relocation of the obvious surface bits.
- **Risk: Medium** (move) — characterization-first on session-git (the single-working-branch
  invariant test exists). Lowest-leverage of the five; can trail.

### R4 — Resolve the `use/act → grow/log` cross-seam

- **Falls out of R2.** Today `use/act.mjs` importing `grow/log.mjs` is the one edge where a
  "read/run" file reaches into "grow". It only looks dirty because the log lives in `grow/`. Once
  the log is Data (R2), `act` logging a run is just *"use writes to the substrate's append-only
  journal"* — no seam violation. **Restate the invariant precisely:** *only `grow/`+`review`
  mutate the Project's **notes/generations**; runs and queries append to the **log**, which is
  Data.* **Risk: Low.**

### R5 — Make routing data-driven (the open-set vs closed-taxonomy tension)  · *carries a decision*

- **Ontology refinement (the real one):** the ontology insists modules are an **open set** with
  "no per-module code, no closed taxonomy" — but `observe.ROUTE` (`grow/observe.mjs`) is a small
  closed taxonomy in code, and it covers only **2 of the 5** standard module kinds
  (`command→actions`, `entity→knowledge`, `fact→knowledge`). Worse, the `correctionTurns`,
  `destructiveFailures`, and `sequences` signals **every adapter mines are routed nowhere** — a
  half-built seam (the audit's only *currently-dead* surface).
- **The decision (pick one):**
  - **(a) Wire** — add `ROUTE` entries + `aggregate` candidate kinds so corrections →
    **Instructions**, destructive-failures → **Guardrails**, sequences → **Actions**. Extends
    observe to all five kinds — the evident design intent and a real capability gain.
  - **(b) Trim** — delete the unrouted producers (the correction lexicon, the destructive/sequence
    assembly). Honors zero-dead-code now; loses half-built intent.
  - **(c) Data-drive** — make routing *declarative*: a candidate kind declares its target module,
    or routing lives as `type: rule`-shaped notes, so the closed list disappears and the open-set
    claim is true end-to-end. The elegant end-state; the bigger build.
- **Recommendation:** fold the decision into this reshape rather than trimming now. (a) is the
  near-term value; (c) is the ontological end-state — likely **wire via a data-driven table**, so
  (a) and (c) are the same change. **Risk: Medium**; real-wire-data discipline applies (the
  correction/destructive signals must be re-verified against genuine host transcripts before
  routing on them).

## Preserve (do not touch in the reshape)

The audit found these genuinely elegant and load-bearing — any reshape must keep them intact:
**everything-is-an-envelope** (one tolerant parser for note · `module.md` · `project.md`); the
**host-agnostic seam** ("add a host = one adapter file + one registry line" is literally true —
no host name branched on in the core); the **single-door moat** (only four importers of `grow/`;
the daemon shells the CLI so the browser can't bypass review); `store.mjs` as the sole
filesystem-layout + path-safety chokepoint; the 53-line `serve/api.mjs` façade; and the
consistent, correctly-placed fail-open (the gate) / fail-soft (logging) / always-exit-0 (the
hook) posture.

## Sequencing & scope

- **Order:** R1 (evolve) first — highest leverage, self-contained, and it sharpens what "the
  gate" even is, which clarifies R2. Then R5 (the routing decision) and R2 (data lift) — both
  larger; R2 may land partially. R3/R4 trail (R4 is a consequence of R2).
- **Each unit:** characterization-first on anything touching the gate (`review`/`evolve`) or
  session-git; root `npm test` + (where web is touched) `cd web && npm test` green at every unit;
  one reviewable commit per unit.
- **Out of scope / non-goals:** redefining the ontology's *concepts* (this is code→ontology
  alignment, not a rewrite of the model — the model refinements here are local sharpenings); the
  **mining/write performance** pass (C1 the per-session-close machine-wide stat-storm, C2 mint
  re-hash, O1 observe re-mine — its own characterization-first follow-up); anything in `web/`
  beyond import updates; the workbench/session-management product work.

## Verification

The reshape is structural, so the proof is *behavior unchanged + structure clarified*: the
existing suite (185 root) stays green through every unit, the gate's characterization tests
(PR #73) pin the evolve extraction byte-for-byte, and a fresh read of `src/` should let a newcomer
trace **observe → propose → review → evolve** to four named files, find every durable artifact in
the Data layer, and see `sessions/` as a surface — i.e. the code finally reads exactly the way
[`ONTOLOGY.md`](../ONTOLOGY.md) teaches it.
