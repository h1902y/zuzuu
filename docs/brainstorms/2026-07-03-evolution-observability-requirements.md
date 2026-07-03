---
title: Evolution observability — the derived time lens
date: 2026-07-03
type: requirements
status: draft
source: /ce-brainstorm
---

# Evolution observability — the derived time lens

## Summary

Turn *evolution* into a dimension the workbench can switch on over its existing
note→module→project zoom — a **time lens** that shows the verifiable record
(generations, provenance, runs) and narrates what it means, at every level. A
**vital-signs** pulse is the doorway that drills into it. Every insight is a
pure function of the git-native record, so the layer can never lie — it is
audit, arithmetically transformed. It replaces today's scattered observability
(git for evolution, `runs.jsonl` for traces, §G surfaces split across note and
module views) with one living view.

## Problem Frame

zuzuu already records everything durably: every change is a git generation,
every mutation is a `log.jsonl` line, every run appends to `runs.jsonl`, and §G
shipped real surfaces over that record — a note's provenance timeline, a
module's generation strip with per-gen diffs and rollback, plain-file links.
Yet the owner still can't *feel* how the project is evolving. The record is
complete but fragmented: to answer "how did this note get here," "what changed
this week," or "which modules are thriving vs rotting," you cross three tools
and hold the rest in your head. The pain is not missing data — it is the
absence of a single view that renders the project as one evolving, running
system. §G answered "show me this one note's history"; it never answered "show
me the project growing."

## Key Decisions

- KD1. Derived-only, forever. Every insight the layer shows is a computed
  function of the raw record — no LLM synthesis, no stored derived state, no
  new note type, no gate write-path. Education is audit arithmetically
  transformed. This was chosen over a generated "self-writing chronicle"
  precisely so the layer's honesty is structural, not reviewed.
- KD2. Education rides on audit. Every displayed insight is one click from the
  raw generation, `log.jsonl` line, or `runs.jsonl` entry that produces it —
  the §G plain-file creed promoted to the layer's governing law.
- KD3. One lens over the existing zoom, not a fourth view. Evolution is a
  temporal dimension the user toggles on; it rides the workbench's existing
  note→module→project zoom rather than adding a separate destination. Zoomed
  all the way out, the lens *is* the project's chronicle.
- KD4. Unify and extend the shipped surfaces, don't rebuild. The §G timeline
  and generation strip, the Flow run-overlay, and the runs-miner's health
  computation already exist; the fragmentation is fixed by drawing them into
  one lens and filling the gaps (project-level biography, vital-signs,
  derived narration) — not by parallel machinery.
- KD5. Honest silence. When the record doesn't say (e.g. a note with no logged
  timestamp), the layer says "not recorded" — never fabricates. This extends
  §G's existing behavior of rendering "time not recorded" rather than faking a
  date.

## The source-of-truth fan-out

```
        THE RECORD (ground truth)                DERIVED SURFACES (the lens)
  ┌───────────────────────────────┐        ┌──────────────────────────────────┐
  │ git generations (per module)  │        │ NOTE   life story · field/relation│
  │ log.jsonl (per-note mutations)│  ────▶ │        changes · birth lane       │
  │ runs.jsonl (what actually ran)│  pure  │ MODULE generation lineage · growth│
  │ module.md history (schema)    │  funcs │        curve · schema evolution   │
  └───────────────────────────────┘        │ PROJECT scrubbable biography ·    │
             every insight ─────────────────▶       velocity · cross-module shape│
             one click back to its source  │ PULSE  hubs/orphans/stale/failing  │
                                            └──────────────────────────────────┘
```

## Requirements

### The time lens (the spine)

- R1. The workbench provides a time-lens mode that overlays evolution + audit
  onto whatever the user is currently viewing, at the note, module, and project
  zoom levels — the same lens, three scales.
- R2. Toggling the lens changes presentation only; it never mutates the record
  and requires no write to enter. It is a read/compute surface.
- R3. At every level, each displayed event or metric links directly to the raw
  record it derives from (a generation, a `log.jsonl` line, a `runs.jsonl`
  entry, or the plain file), so any insight is verifiable in one click.

### Vital-signs (the doorway)

- R4. A vital-signs pulse presents the project's current derived dynamics at a
  glance — which modules are growing/stable/stale, notes that are hubs vs
  orphans vs stale, the gate's pending-proposal depth, run health per runnable
  note, and generation/approval velocity.
- R5. Each vital sign drills into the time lens at the relevant level (a stale
  module opens its generation lineage; a failing note opens its run trace).

### Derived signals per level

- R6. Note level: the lens shows the note's life story — when and by which lane
  it was born (agent-proposed-then-approved vs operator-direct), how its fields,
  body, and relations changed across generations, and its provenance chain —
  all derived from `log.jsonl` and the generations that touched it.
- R7. Module level: the lens shows the module's generation lineage (reusing the
  §G strip), what each generation changed, its note-count growth curve, and its
  schema evolution (add/alter/drop-column generations).
- R8. Project level: the lens shows a scrubbable biography that replays the
  project growing across all modules generation by generation, plus generation
  velocity and which modules grew when — the cross-module shape shifting over
  time.

### Trust and derivation invariants

- R9. Every signal is a pure function of the record. No value the layer shows is
  synthesized, guessed, or persisted as derived state; it is recomputed from
  generations/`log.jsonl`/`runs.jsonl` on read.
- R10. The layer adds no new note type and no new stored artifact. It reads what
  the substrate already records.
- R11. When the record is silent on a value, the layer states that honestly
  ("not recorded") and never fabricates a substitute.

## Key Flows

- F1. Understand how a note got here
  - **Trigger:** User opens a note and switches on the time lens.
  - **Steps:** The lens renders the note's life story from its `log.jsonl` and
    generations; the user sees birth lane, each field/relation change, and
    provenance, each event clicking to its raw source.
  - **Outcome:** The user reconstructs the note's history without opening git or
    the file. Covered by R1, R3, R6, R9.
- F2. Read the pulse, then drill
  - **Trigger:** User glances at vital-signs.
  - **Steps:** The pulse shows growing/stale modules, hub/orphan/stale notes,
    pending proposals, and failing runs; the user clicks a failing note and
    lands in its run trace inside the lens.
  - **Outcome:** The user goes from "how is my project doing" to the specific
    evidence in one hop. Covered by R4, R5, R8.
- F3. Watch the project grow
  - **Trigger:** User zooms fully out with the lens on.
  - **Steps:** A scrubbable biography replays generations across modules; the
    archipelago grows as the user scrubs.
  - **Outcome:** The user feels the project's evolution as a continuous story.
    Covered by R8, R9.

## Scope Boundaries

**Outside this layer's identity**
- A generated "self-writing chronicle," LLM narration, or any `type: chronicle`
  note — explicitly cut. Narration is derived (computed facts + templated
  prose), never synthesized.
- A metrics/BI dashboard, external/remote telemetry, or real-time streaming
  observability — this reads git + the local logs, stays local-first, adds no
  new storage.

**Deferred (not this pass)**
- Alerting or push on a vital sign crossing a threshold — the runs-miner already
  stages gated proposals for failing notes; surfacing beyond in-workbench
  display is later.
- Cross-project / fleet-level evolution (the World/global page) — this layer is
  one project's lens.

## Acceptance Examples

- AE1. A note with three logged mutations and one generation-recorded relation
  change shows all four events in the lens, each linking to its raw source;
  nothing is inferred. (R3, R6, R9)
- AE2. Vital-signs shows a module with no generations in the recent window as
  "stale," a note with the highest backlink count as a "hub," and a runnable
  note past the runs-miner failure threshold as "failing." (R4, R5)
- AE3. A note whose `log.jsonl` has no creation timestamp renders "birth: not
  recorded" — not a fabricated or file-mtime-substituted date. (R11)
- AE4. Entering the lens issues no write and mints no generation; the review
  queue and generation log are unchanged by looking. (R2, R10)

## Design references (Mobbin)

Concrete visual targets per surface, so planning starts from patterns rather
than prose. The through-line: every reference is a *derived* view — steal the
ones that summarize the record, not the ones that dump it.

| Surface (→ req) | Stealable pattern | Source |
|---|---|---|
| Note lens: field/body diff (→ R6) | Strikethrough-old + highlight-new, "Highlight changes" toggle, version rail + Restore | [Linear version history](https://mobbin.com/screens/6c14e085-9ff5-4e61-9a21-b04f1b0a3433) |
| Note lens: field change (→ R6) | Attribute · New value · Old value columns per change | [Aboard audit events](https://mobbin.com/screens/8c5f9bca-6ac8-4fab-b216-6b058c3a7d21) |
| Note lens: rollback (→ R7) | "Show changes" toggle + Restore-with-confirm dialog | [Fibery version history](https://mobbin.com/screens/eb05e8be-4a16-47f0-94fe-08ad3da74171) |
| Provenance trace (→ R3, R6) | The **"What Changed" derived chip column** — Entity · Event · When · Who · What — the single best pattern; makes an audit table educational at a glance | [Fibery Activity Log](https://mobbin.com/screens/e2d656a6-35ba-4e9a-b5c7-a14e4fa61bb3) · [Audit Log](https://mobbin.com/screens/8ebb779a-53f5-4ba8-b717-ea5b9cda1017) |
| Birth-lane "who" (→ R6) | "Automated" vs a named person in the actor column → render as agent-proposed vs operator-direct | [15Five activity log](https://mobbin.com/screens/0e4eaeeb-0fc4-419e-9c4b-90b61293b012) |
| Derived narration (→ R6) | Each event as a templated human sentence ("A group called X was created") | [1Password](https://mobbin.com/screens/d015635b-1d0a-4357-9281-2c863bf010de) |
| Generation lineage (→ R7, R8) | Vertical commit spine with a **dated left rail** (time axis) | [GitLab Repository graph](https://mobbin.com/screens/52c2a85c-af19-4a9d-b877-5bcf31f8284a) |
| Generation strip (→ R7) | Date-grouped list: actor · message · short id · status glyph | [GitLab Commits](https://mobbin.com/screens/dac0d824-a5f9-434d-9886-51cf7f78bf4f) |
| Per-generation actions (→ R7) | Inline "Rollback here · Changes · Preview" row | [Replit checkpoints](https://mobbin.com/screens/f2674f4f-de7a-4202-8972-ea4f8ac13aa4) |
| Vital-signs velocity (→ R4) | Commits-per-day/weekday charts = generation velocity | [GitLab Repository analytics](https://mobbin.com/screens/7502b390-df85-4d60-b201-aadce0e2034c) |
| Run trace drill-in (→ R5) | DAG graph + run-detail panel (id · status · duration) + filtered event-log tab | [Databricks pipeline run](https://mobbin.com/screens/2a53f9eb-b8e1-4958-afb7-f441acbdf414) |
| Single run trace (→ R5) | Gantt of steps with per-node timing | [StackAI run details](https://mobbin.com/screens/bb0174f4-60aa-4e30-ac5f-73679b160f38) |
| Durable-run trace (→ R5) | State-machine timeline: Timeline · State · Event · Payload | [Zoho execution preview](https://mobbin.com/screens/a9dbcb21-1ffe-4270-9a7a-15948897ebcf) |

**Anti-patterns (the derived-vs-dumped line, KD1):** raw JSON diffs
([Adaline](https://mobbin.com/screens/c53724d7-9387-4a81-8a96-bc74baddd24c)) and
firehose event logs
([Databricks event log](https://mobbin.com/screens/d55b9b90-0c32-4400-86e8-68b000134f5a),
20 identical lines) dump the record instead of deriving from it — the difference
between an audit *log* and an audit *layer*. Derive and summarize; never dump.

**No precedent — the one thing we invent:** the project-level scrubbable
biography (R8, scrub time and watch the archipelago grow) has no Mobbin analog —
every tool renders history as a list or a static graph, none replays the
structure growing. Closest anchors for its time axis: the GitLab dated-spine and
the analytics velocity charts above.

## Outstanding Questions

- The exact derived thresholds (what counts as "stale," "hub," "growing," and
  the run-health window) are for planning. The runs-miner's existing thresholds
  (≥3 consecutive failures or ≥50% rate over ≥4 runs) are the precedent to
  extend.
- Where the lens control lives in the UI (a global toggle beside map/table/flow,
  or an orthogonal time control) and whether the project biography is a
  scrubber or a play-through animation — design decisions for planning.

## Dependencies / Assumptions

- Assumes the git generations, `log.jsonl`, and `runs.jsonl` are the record the
  layer derives from. Direct file edits made outside the `zz` write path are not
  logged; the layer shows what is recorded and says so honestly (R11) rather
  than reconstructing unlogged history.
- Builds on the existing web workbench (map/table/flow), the §G surfaces, the
  Flow run-overlay, the runs-miner, and the daemon's read routes — extending and
  unifying them (KD4), not replacing them.
