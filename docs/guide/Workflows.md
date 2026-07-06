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
  `timeout` is checked lazily, the next time anything calls `advance` on that
  run — for a MANUAL run that's still purely on a human's own cadence (no
  scheduler evaluates it for you); for a run the wake source's local tick
  fired (below), the tick itself re-advances it every cadence while it's
  non-terminal, so a `waiting` unattended run's timeout gets evaluated on the
  tick's own schedule, not a person's.

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
`cron` trigger fired manually just runs its target once. `on.expr` **is** read
locally now: an opted-in Project's local tick evaluates it every cadence (see
"The wake source" below) — the field was designed in ahead of that rung
specifically so no schema migration was needed when firing arrived.

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

## The wake source — an opt-in local tick fires triggers now (rung 1)

**The honest boundary moved, on purpose.** It used to read "a laptop must not
fire triggers unattended" — full stop. As of the wake-source rung
(`docs/plans/2026-07-06-001-feat-wake-source-tick-plan.md`), that boundary is
**crossed, deliberately and narrowly**: a founder who explicitly opts in
(`zz autonomy on`) gets a **local tick** that fires *enabled* triggers while
their machine is awake — still gated, still fail-closed, still no cloud. The
old boundary is not undone; it's been replaced by a stricter, honest one:

> A local tick you opted into (`zz autonomy on`) fires enabled triggers while
> your machine is awake — still gated, still fail-closed, still no cloud. The
> hosted 24/7 tier remains deferred.

```bash
zz autonomy on              # the founder's explicit, auditable opt-in (off by default)
zz autonomy status          # is it on? what did the last tick fire/skip/deny?
zz tick --once              # run one tick by hand — fires due enabled triggers, advances their runs
zz web --autonomy           # the workbench daemon hosts the cadence (shells `zz tick --once`)
zz daemon                   # OR the dedicated tick host — loops the same core in-process
```

**What actually changed, precisely:**

- **`cron` triggers now auto-fire — locally, opt-in.** A `cron` trigger's
  `expr` is evaluated by a zero-dependency matcher (`grow/cron-match.mjs`) on
  every tick; a due-and-unfired window fires exactly once (a `stateDir`
  watermark makes this idempotent across overlapping ticks).
- **`note-change` triggers now auto-fire too** — once per newly-matching row,
  same idempotent watermark.
- **Firing still adds no new execution authority.** A tick-fired trigger goes
  through the exact same `fireTrigger` → `startRun` path a human's
  `zz trigger fire` uses — the tick is a scheduler over that existing gate,
  never a second one.
- **Unattended runs gate their STEPS fail-closed** (a malformed rule, an
  engine error, or an `ask` verdict all *deny* — see `docs/MODEL.md`'s
  actor/gate-posture split), even though the run NOTE is still written through
  the one operator-authorized write door. A manual, human-started run is
  completely unchanged — same fail-open contract as always.
- **No unattended agent spawn — structurally.** An `agent`-binding step inside
  a tick-fired run returns `needsHost:true` and fails that one step cleanly;
  ACP dispatch is daemon-only and the CLI-driven tick can never reach it. This
  isn't a policy the tick has to remember to respect — it's the same
  structural block every other CLI-driven run already hits.
- **Off by default, two independent gates.** Nothing fires until BOTH (a) the
  founder has run `zz autonomy on` for this Project, and (b) the individual
  trigger is `enabled: true`. Either gate closed ⇒ that trigger stays silent.

**Still deferred, hosted-tier only** — this rung does NOT build:

- **No ingress.** `/ingress/<trigger-id>` webhooks, inbound email, and OAuth
  remain hosted-tier only — no unattended *inbound* door on a laptop.
- **No 24/7 tier.** The local tick only runs while your machine is awake and
  something is hosting it (`zz web --autonomy` or `zz daemon`); the Fly-hosted
  always-on tier is a separate, later rung.
- **No rich morning digest.** "What your office did overnight" as a narrative
  surface is a named later rung — this pass gives you the raw decision log
  (`zz doctor`, `zz autonomy status`, the `runs` table), not a curated summary.
- **The web surface's Flow view stays read-only** — [Flow](Flow-View), the
  third projection alongside Table/Map: a workflow's steps as a DAG, its runs
  overlaid live (now including tick-fired ones). No run-control buttons, no
  canvas editing, no trigger blast-radius preview yet — advancing a run is
  still `zz run advance` / a later pass.

**Seeing what fired.** A tick-fired run is not a separate, hidden thing — it
surfaces exactly like a human-started one: it's a row in the `runs` module
table, it pushes live to the workbench over `/ws/zuzuu`, and its steps land in
`runs.jsonl` same as any other. The one ADDITIONAL record is the tick's own
decision log (`grow/tick-state.mjs`'s `stateDir`-scoped `tick.log.jsonl`) —
what each tick fired, skipped (not due / disabled / already-fired), and
denied (a fire attempt that failed) — the unattended equivalent of watching it
happen. `zz doctor` and `zz autonomy status` both read the latest entry so the
switch's position and its last action are never silent.
