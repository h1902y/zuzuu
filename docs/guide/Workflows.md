# Workflows — three tiers, honestly labeled

A **workflow note** (`type: workflow`) is a DAG of steps. How it *runs* depends on
which of three tiers you invoke — pick the cheapest one that fits the job.

| Tier | Verb | Shape | Good for |
|---|---|---|---|
| **0 · script** | `zz act` | one note, one gated shell command | a single repeatable procedure |
| **0/1 · flow** | `zz note flow` | a WHOLE DAG, synchronous, one process | a multi-step procedure that finishes in seconds |
| **2 · durable run** | `zz run start` / `zz run advance` | a DAG that PAUSES — hours or days — as a note | a procedure with a human step, an external wait, or anything that must survive a crash between steps |

Tiers 0/1 are covered in [[Two Lanes|Two-Lanes]] and the `act`/`flow` verbs. This
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

## Triggers — naming an automation, explicitly fired

A **trigger note** (`type: trigger`) is a gated, versioned way to NAME an
automation — not a scheduler. It adds no new execution authority: firing one is
exactly `zz run start` under a name.

```yaml
---
type: trigger
title: Watch hot leads
run: actions:onboard-lead        # the workflow it fires — a `run start` target
enabled: false                   # the SECOND gate — off until a human flips it
on:
  kind: note-change              # manual | note-change | cron | ingress
  module: crm
  type: lead
  event: update
  where:
    - tier>=2                    # the SAME grammar `zz query --where` parses
---
```

```bash
zz trigger list                      # every trigger note + enabled + blast-radius count
zz trigger show crm:watch-hot-leads  # the note + "current matches: N" (Apollo-style preview)
zz trigger fire crm:watch-hot-leads --dry-run   # preview what WOULD fire — starts nothing
zz trigger enable crm:watch-hot-leads           # the second gate — now it CAN fire
zz trigger fire crm:watch-hot-leads             # → one durable run, same as `run start`
```

**Blast-radius first.** `trigger show`/`trigger fire --dry-run` compute the
`note-change` filter's CURRENT matches (a count + a small sample) before anything
fires — the same safety affordance Apollo's workflow builder shows at review time
("current matches: 5"). It's a pure read over the same index `zz query --where`
uses; nothing is fired to compute it.

**Fire semantics (a documented choice).** A `note-change` trigger's fire starts
**exactly one** durable run — never one per matching row, which is a batch
concern this rung doesn't build. The run's `inputs` carry the trigger's declared
`inputs` plus the matched-note context (`MATCHED_COUNT`, `MATCHED_SAMPLE`). A
`cron` trigger fired manually just runs its target once; `on.expr` is read by
nothing local today — it exists so the note is ready for the hosted scheduler
later with no schema migration.

**The second gate.** `enabled: false` is the default posture — a trigger can be
reviewed-in (staged by an agent, approved by a human) and still stay inert until
`zz trigger enable` explicitly turns it on. This mirrors Argo's layered
def-change gate: review is the first layer, promote/enable is a second.

**Creating one.** There's no `trigger create` verb — a trigger is a note like
any other: `zz note create <module> <id> --type trigger --change '{...}'` (the
operator lane), or an agent **proposes** it via `zz stage … --change '{...}'` →
`zz review approve` (the sanctioned channel — `trigger fire`/`enable`/`disable`
are denied to an agent actor, same as `run start`).

**The exec-gate that denies it stays current.** The agent-denial above is
enforced by a seeded rule note (`protect-brain-exec`), not a hardcoded check —
so `zz init` **reconciles** its pattern to the live write-verb table on every
run (a project seeded before `trigger fire` existed re-arms automatically; a
human's own edits to the rule's action/reason survive) and now seeds it in
**root-mode** too (previously skipped there entirely). `zz doctor` flags a
missing or stale copy so the gap is never silent
(`docs/audits/2026-07-03-triggers-review.md`).

**What a trigger's `run:` must point at.** Every fired run passes through the
durable runner, so `run:` must be a `type: workflow` note — firing at a bare
action refuses with the same "is not a workflow" error `zz run start` gives a
human pointed at that address. Wrap a single action as a trivial one-step
workflow if you want to trigger it.

## Not built yet (on purpose)

- **No unattended scheduler.** A `cron` trigger's `expr` is validated (shape
  only) but never auto-fired locally — a laptop must not fire triggers
  unattended (the honest local/hosted boundary). `zz doctor` names any declared
  cron trigger so the gap stays visible, not silent.
- **No ingress.** `/ingress/<trigger-id>` webhooks are hosted-tier only.
- **No note-change auto-firing.** Nothing watches the index for newly-matching
  rows and fires on its own — `trigger fire` is always explicit today.
- **No daemon.** `zz run advance --all` is a bounded loop in one process, not a
  background service.
- **The web surface exists now** — [Flow](Flow-View), the third projection
  alongside Table/Map: a workflow's steps as a DAG, its runs overlaid live.
  Read-only this pass (no run-control buttons, no canvas editing, no trigger
  blast-radius preview yet) — advancing a run is still `zz run advance` / a
  later pass.
