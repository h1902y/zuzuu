---
type: audit
title: Adversarial moderation review — WORKFLOW COMPOSITION (§I rung 1)
date: 2026-07-03
range: 6a7a72e^..8fabe1c
head: 8fabe1c
branch: feat/personal-app-roadmap
reviewer: Claude Fable 5 (adversarial moderation)
verdict: ship
---

# Workflow composition — adversarial review

Scope: the 3-commit series `6a7a72e..8fabe1c` (note-ref composition · nested saga · docs)
— a workflow step may now be `note: module:id` instead of an inline `run:`, resolving at
run time to `act()` for a leaf action or a recursive `runWorkflow` for a nested workflow.
Reviewed for the composition bugs that hide in the seams: cycle-detection completeness,
actor propagation under recursion (the moat invariant), lock ordering/deadlock, nested
saga order + double-compensation, input scoping, and `via` attribution. Files read in
full: `src/use/workflow.mjs`, `src/use/act.mjs`, `src/notes/log.mjs`, plus the rung-A
floor it composes: `src/use/run-lock.mjs`, `src/guardrails/gate.mjs`. All 25 tests in
`tests/unit/workflow-composition.test.mjs` pass locally.

**Verdict: SHIP.** The security-critical invariants are airtight and tested: the actor is
threaded explicitly through both the recursion branch and the leaf branch (no operator
default leak, proven denied at depth ≥2), the cycle check runs before every lock
acquisition (no deadlock, no diamond false-reject — copy-on-recurse `visited`), and the
nested saga runs inner-then-outer with no double-compensation. No BLOCKER: nothing
note-controllable flips the trust posture, and no composed step can be reached with a
weaker actor than the run started with. One SHOULD-FIX to land before the hosted /
concurrent CRM tier (a documented lock-staleness under-budget that composition newly
introduces). The rest are NITs.

## What holds (verified against code + tests)

- **Actor propagation is airtight (the moat invariant).** `actor` is a dedicated
  parameter threaded, never derived from a note field or from `inputs`. Recursion branch:
  `runWorkflow(..., actor, {...})` (`workflow.mjs:181`). Leaf branch: `ctx = {..., actor}`
  → `act()` → `runGated({..., actor})` (`workflow.mjs:194-195`, `act.mjs:112,127`). The
  `= 'operator'` defaults exist only at the ROOT entry and in `act`'s destructure, and the
  composition path always supplies a concrete actor to both, so there is no path where a
  composed step's `gate()` sees `operator` while the run started `agent`. The top-level
  caller stamps it correctly too (`wire.mjs:37` passes `ctx.actor`). Proven at depth ≥2:
  the nested-workflow denial test (`…test.mjs:259`) asserts `ok === false` for an
  `agent` run whose only failure mode is the gate denying — an operator leak would make
  it pass.
- **Cycle-before-lock, in every path.** There is one `runWorkflow`; its `visited.has`
  and depth checks (`workflow.mjs:236-237`) both precede the single `acquireRunLock`
  (`workflow.mjs:243`). A direct self-ref recurses in, hits the visited guard, and
  returns a named cycle *before* touching the target's lock — no deadlock on its own run
  lock. Direct (`a→a`), transitive (`a→b→a`, `a→b→c→a`) all named in order and tested.
- **Diamonds are not false-rejected.** `visited` is copy-on-recurse
  (`nextVisited = new Set(visited).add(selfAddr)`, `workflow.mjs:238`) and never mutated
  after creation; each child copies before adding. A sibling's completion therefore
  leaves nothing behind, so `A→B, A→C, B→D, C→D` visits `D` twice legally. Tested
  (`…test.mjs:146`). Depth counts nesting levels and interacts cleanly with the cap
  (`depth > 20`): the acyclic-chain test refuses with the depth message and *not* a cycle
  message (`…test.mjs:175`).
- **Lock semantics.** Each composed target acquires its OWN lock (leaf via `act.mjs:122`,
  nested via `workflow.mjs:243`); the parent's own lock is taken once and never re-taken
  by steps. Sequential fan-out (two steps referencing the same leaf) is fine — each `act`
  releases in `finally` before the next step, so there is no self-collision; the refusal
  only bites a genuinely concurrent standalone run (tested at `…test.mjs:275,294`).
- **Nested saga order + no double-compensation.** A failed composed step is never pushed
  to `done` (`workflow.mjs:274` runs only after success), so the parent compensates only
  its OWN completed steps and never the failed composed step. The inner workflow's own
  compensations already ran synchronously inside the recursive call before control
  returned. Order proven (`…test.mjs:194`): `inner-setup-compensated` then
  `outer-setup-compensated`, `compensations.length === 1`.
- **`via` attribution is safe.** `via = ${module}:${id}` is computed from the actual
  immediate parent at run time, not spoofable from note content (`workflow.mjs:172`).
  It is written only when present (`log.mjs:118`), so non-composed `runs.jsonl` entries
  are byte-unchanged — proven (`…test.mjs:349`). Cross-module leaf runs log under their
  OWN module with `via` set (`…test.mjs:45,323`). A composed leaf is gated by the
  TARGET module's own allowlist, not the parent's — correct scoping (`act.mjs:126`).

## Findings

### SHOULD-FIX

- **S1 · Composed workflow steps under-budget the parent's lock-staleness window — a new
  double-run window.** `workflow.mjs:148` (`workflowStaleAfterMs`, used at `:242-243`).
  `runBudget` sums each step's own `resolveTimeoutMs(s.timeout)`; a `note:` step to a
  nested workflow has no `timeout:` of its own, so it is budgeted the 120s default — but
  the nested workflow can legitimately run far longer (its own steps + its own
  compensation phase, recursively). If the parent's staleness window is shorter than the
  real nested duration, a concurrent second invocation of the SAME parent can see the
  parent's lock as stale and STEAL it, running two copies concurrently — the exact
  double-run the lock exists to prevent. This is *new* debt introduced by this rung
  (inline steps are bounded by their own `timeout:`; composed steps are not). The code
  comment (`workflow.mjs:137-145`) documents it as an accepted advisory limitation, and
  locks are advisory codebase-wide, so it does not block merge — but it should be closed
  before the hosted/concurrent CRM tier where long nested workflows + racing invocations
  become realistic. **Fix (one line):** budget a `note:` step at `MAX_TIMEOUT_S` rather
  than its (usually absent) own `timeout` in `workflowStaleAfterMs`, i.e. treat composed
  steps as max-length — still a floor, but far less likely to be stolen mid-nested-run.

### NIT

- **N1 · No compensation cascade into a *completed* nested workflow.** `workflow.mjs:267`.
  If a composed workflow step SUCCEEDS and a later parent step fails, only the composing
  step's own declared `compensate:` shell command runs; the completed nested workflow's
  internal step compensations do NOT re-fire (they only run on inner failure). This is
  correct per the per-workflow saga model, but a composing author must know to attach a
  `compensate:` to roll back a successful nested workflow. **Fix:** document this boundary
  in MODEL.md's flow section (composed steps compensate as a unit, via their own
  `compensate:`).

- **N2 · `timedOut` telemetry is dropped across a nested-workflow step.** `workflow.mjs:183`
  (workflow branch of `runNoteRefStep`) omits `timedOut`, so the parent's step record
  (`:260`) shows `timedOut:false` even when the nested workflow timed out internally.
  Cosmetic only — the failure and error still propagate and the saga still fires. **Fix:**
  thread `timedOut: nested.timedOut` (or derive it) in the workflow-branch return.

- **N3 · Parent inputs pass through to unrelated composed children (least-privilege).**
  `workflow.mjs:175`: a `note:` step with no own `inputs:` inherits ALL parent inputs as
  `ZZ_*` env, including secret-shaped ones, even for an unrelated child note that never
  asked. Intentional and documented (`:173-174`), and marginal atop `act.mjs:84`'s
  existing full `process.env` inheritance — but it is least-privilege debt to revisit when
  typed input ports (§I.1 tool notes) land, so a child gets only inputs it declares.
  **Fix:** none now; note it against the typed-ports work.

- **N4 · Test rigor: two small gaps.** The depth-2 agent-denial assertion uses a loose OR
  (`/ask verdict denied|step 'a' failed/`, `…test.mjs:269`) — since `true` can only fail
  via the gate, tightening it to `/ask verdict denied/` would prove it is the *gate*
  denying, not an incidental failure (the `ok===false` assert already carries the real
  proof, so this is a strengthening, not a hole). Separately, there is no test combining a
  diamond with near-cap depth (a "legal depth-15 diamond passes"); the logic clearly
  handles it (copy-on-recurse + per-level depth), but a single test would lock it in.

- **N5 · `redactInputs` is top-level only** — already self-documented in `log.mjs:44-47`
  and harmless today (inputs flatten to `ZZ_<k>=String(v)` scalars before spawn). No
  action; recorded for completeness.

## Bottom line

Composition reuses the rung-A primitives faithfully and adds no new trust-posture surface:
the actor invariant, cycle-before-lock ordering, and saga non-duplication are correct and
covered by the 25 tests. Ship. Track **S1** (composed-step lock budget) before the hosted
/ concurrent tier, and fold the NITs in opportunistically.
