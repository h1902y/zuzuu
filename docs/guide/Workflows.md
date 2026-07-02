# Workflows — three tiers, honestly labeled

A **workflow note** (`type: workflow`) is a DAG of steps. How it *runs* depends on
which of three tiers you invoke — pick the cheapest one that fits the job.

| Tier | Verb | Shape | Good for |
|---|---|---|---|
| **0 · script** | `zz act` | one note, one gated shell command | a single repeatable procedure |
| **0/1 · flow** | `zz note flow` | a WHOLE DAG, synchronous, one process | a multi-step procedure that finishes in seconds |
| **2 · durable run** | `zz run start` / `zz run advance` | a DAG that PAUSES — hours or days — as a note | a procedure with a human step, an external wait, or anything that must survive a crash between steps |

Tiers 0/1 are covered in [Two Lanes](Two-Lanes.md) and the `act`/`flow` verbs. This
page is Tier 2 — **the durable runner**.

## The core idea: the run is a note

`zz run start`/`zz run advance` never keep a process alive between steps. Instead,
the run's entire state — which step is next, how many times it's been attempted,
what it's waiting on — lives in one markdown note (`type: run`), exactly like every
other fact zuzuu tracks. Advancing the run means: read the note, do ONE thing,
write the note. There is no daemon, no timer, no background job. A run that's
waiting three days for a human to click a button is just a note sitting at
`status: waiting` — visible in the table, queryable, and resumed by a plain command
whenever that human gets around to it.

This is why it's *durable* without needing a real workflow engine: the durability
comes from the substrate you already have (notes + git), not from a process staying
up. See `docs/specs/2026-07-02-polish-showcase-experience.md` §I.3 for the full
rationale ("control plane, not engine").

## Walkthrough

```bash
# a workflow note, like any Tier-0/1 one, but it may ALSO use `wait:` steps
zz note create actions onboard-lead --type workflow --field title="Onboard a lead"
# (steps are usually authored as JSON via --change; shown here as the shape)
```

```yaml
---
type: workflow
title: Onboard a lead
steps:
  - id: enrich
    note: actions:enrich-company        # a note-ref step (Tier-0/1 composition, reused)
  - id: review
    wait: { on: sales-approval, timeout: 48h }
    depends-on: enrich
  - id: create-deal
    note: crm:create-deal
    depends-on: review
    retry: { max: 3 }
---
```

```bash
# start: reads the workflow, PINS its current generation, materializes a run note.
# nothing executes yet.
zz run start actions:onboard-lead --input company=acme

# → onboard-lead-a1b2c3d4  (the run id)

# advance: does EXACTLY ONE thing per call.
zz run advance onboard-lead-a1b2c3d4     # runs `enrich`
zz run advance onboard-lead-a1b2c3d4     # transitions `review` to waiting — STOPS

# ...hours or days later, a human (or a webhook, eventually) resolves the wait...
zz run signal onboard-lead-a1b2c3d4 sales-approval
# (or: zz run complete onboard-lead-a1b2c3d4 review — same thing, by step id)

zz run advance onboard-lead-a1b2c3d4     # runs `create-deal`
```

`zz run advance --all <id>` is a convenience: it loops `advance` for you, but it's
still just sequential ticks in one process — it STOPS the moment the run reaches
`done`, `waiting`, or `failed`. It never becomes a background job.

## The step vocabulary — closed, on purpose

A step is exactly one of:

- **`run:`** — an inline shell command, gated the same way `zz act` gates any run.
- **`note:`** — a reference to another runnable note (`module:id`) — a leaf action,
  or even another `type: workflow` (composition, same rule Tier-0/1 uses).
- **`wait: {on, timeout?}`** — a pause. The run parks at `status: waiting,
  waiting_on: <on>`; `zz run signal`/`zz run complete` resolves it. A declared
  `timeout` is checked lazily, the next time anything calls `advance` on that run
  (there's no scheduler yet — see Roadmap for triggers).

That's it. No BPMN-style sprawl of node types.

## Generation pinning — edits don't retarget in-flight runs

`run start` doesn't just remember *which* workflow a run came from — it pins the
exact **generation** (`workflow_generation`) that was active at start time, and
every `run advance` re-reads the step definitions from THAT generation (via git,
not the live file). Edit the workflow note after a run has started — add a step,
change a command — and the in-flight run is unaffected; it keeps executing the
definition it was PINNED to. This mirrors how durable-execution engines like
Temporal pin a workflow run to the version it started under, so you can safely keep
editing the definition without breaking runs already in flight.

## Retries, failure, and the saga

A step may declare `retry: { max: N }`. A failed step under `max` just stays
`pending` — the next `advance` picks it up again, with `attempts` incremented. Past
`max` (or with no `retry` declared at all — one attempt, no retry), the step is
`failed`, and so is the whole run.

A failed run triggers a **saga**: every completed step's `compensate:` command runs,
in reverse completion order — undoing side effects, best-effort. If a completed step
is marked `irreversible: true` (a submitted form, a sent email — something that
genuinely can't be undone), the saga **stops there** instead of pretending to roll
it back. Steps completed earlier than the irreversible one are left uncompensated,
and the run note records exactly how far compensation got. Honesty over a fake
undo.

## At-least-once, not exactly-once

Say this plainly, because durable-execution marketing rarely does: this runner
gives you **at-least-once** semantics, not exactly-once. A tick executes a step's
side effect and THEN writes the result — "one short invocation" per step, no
two-phase commit. If the process dies in between, the note still shows the step
`pending`, and the next tick will run it again. Each side-effecting step's
`idempotency_key` stays stable across retries so a downstream system CAN recognize
a duplicate if it wants to — but the runner itself makes no exactly-once promise.
Build side-effecting steps (emails, external API calls) to be idempotent, or route
them through an outbox pattern (a future rung).

## Where run notes live

Runs land in their own `runs` module (`zz module items runs`), not inside the
workflow's module — every durable run across every workflow shows up as one
uniform table, and a workflow module's own schema never has to accommodate a run's
very different shape (`steps`, `status: running|waiting|done|failed`,
`workflow_generation`, …).

## Not built yet (on purpose)

- **No scheduler or cron.** A `wait.timeout` is only checked when something calls
  `advance` on that run — nothing fires it proactively. Automated triggers
  (`type: trigger` notes) are a later rung.
- **No daemon.** `zz run advance --all` is a bounded loop in one process, not a
  background service.
- **No web surface** for this rung — the Flow view (a third map projection
  alongside Table/Map) is future work.
