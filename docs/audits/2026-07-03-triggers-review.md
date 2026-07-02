---
type: audit
title: Adversarial moderation review — TRIGGERS (§I rung 4, the automation layer)
date: 2026-07-03
commit: 554c70699a7362666f5c5ac7b03b955938ea3088
branch: feat/personal-app-roadmap
reviewer: Claude Fable 5 (adversarial moderation)
verdict: ship-after-fixes
---

# Triggers as notes — adversarial review

Scope: commit `554c706` — "triggers as notes (§I rung 4): the model + manual firing +
blast-radius." A `type: trigger` note names WHEN (`on: {kind, …}`) and WHAT
(`run: <workflow-module:id>`) and adds — per its own claim — NO new execution
authority: `zz trigger fire` resolves the target and calls the durable runner's
`startRun`, the exact gate/timeout/generation-pin a manual `zz run start` gets.
Reviewed as the automation layer: a mis-gated trigger fires runs without a human in
the loop, so the gate + fire semantics must be airtight.

Files read in full: `src/grow/trigger.mjs`, `src/notes/validate.mjs` (trigger axis),
`src/cli/verbs/evolution.mjs` (the verbs), `src/grow/run.mjs` (`startRun`), plus the
substrate the claims depend on: `src/cli/commands.mjs` (`gateWriteVerbPattern`/
`writeVerbPaths`), `src/cli/init.mjs` (rule seeding), `src/guardrails/gate.mjs` (rule
evaluation), `src/use/act.mjs` (`runGated` env construction), `src/cli/args.mjs`
(`parseWhere`), `src/notes/index.mjs` (`plan`/`count`/`eavCondition`), and both test
suites. Design intent read: `docs/specs/2026-07-02-polish-showcase-experience.md`
§I.2 (B2/B4), §I.3, §I.4 (#6/#7 + the Apollo blast-radius affordance). 38/38 trigger
tests re-run green locally.

**Verdict: SHIP-AFTER-FIXES.** The moat holds structurally. `fire`/`enable`/`disable`
are `agentInvokable:false` and, crucially, that flag is what places them in the
GENERATED execution-gate deny pattern (`writeVerbPaths` filters exactly
`write|admin ∧ !agentInvokable`) — verified end-to-end: the pattern is seeded into the
live `protect-brain-exec` rule note (`init.mjs:70`) and the gate compiles that stored
pattern at eval time (`gate.mjs:42`). The agent's only path to a trigger is
`stage → review approve` (human), and a reviewed-in trigger lands `enabled:false` —
both test-proven. `fire` refuses a disabled trigger unless `--force`, `--force` is
reachable only through the (gated) `fire` verb, and nothing auto-fires: there is no
scheduler, daemon, `fs.watch`, `setInterval`, or HTTP surface that calls
`fireTrigger`/`setTriggerEnabled` — the sole callers are the CLI verbs. `startRun`
adds no authority (operator-only, generation-pinned, workflow-only), and trigger
`inputs` + matched-note context reach the step as `ZZ_*` env values through an
argv-based `spawnSync` (no `shell:true`), so no shell-fragment injection is possible.
Blast-radius reuses the identical where-grammar and an unlimited `count()`, so it
cannot under-count.

The findings are a systemic gate-staleness observability gap (newly relevant, not
introduced here), a test-coverage gap on the exact second-gate coercion the brief
flagged, and three NITs. None is a blocker.

---

## Findings

### SHOULD-FIX 1 — the generated gate protects only (re-)seeded projects; staleness is silent
`src/cli/init.mjs:184,188` · `src/guardrails/gate.mjs:38-42`
The gate evaluates the pattern STORED in the `protect-brain-exec` rule note, not a
freshly-computed `gateWriteVerbPattern()`. That note is seeded with `writeOnce`
(`init.mjs:162` skips an existing file), so a project initialized BEFORE this commit
keeps its pre-trigger pattern on `zz init` re-run — an agent can shell
`zz trigger fire` there and it is NOT denied until the rule is re-seeded. Root-mode
projects (the personal vault) never seed `protect-brain-*` at all (`init.mjs:184`), so
the exec-gate for trigger-fire relies on opt-in per-module gating. Both are PRE-EXISTING
properties of the gate architecture (every write verb added after first seed goes
stale the same way) — but triggers are the first verb whose whole safety story is "the
agent can't fire it," so the gap now bites. Nothing (`zz doctor`/`zz check`) flags a
stored pattern that diverges from the table.
Fix: on `zz init`/`zz doctor`, reconcile `protect-brain-exec.pattern` to
`gateWriteVerbPattern()` (or warn on divergence) so added write verbs re-arm the gate
on existing installs.

### SHOULD-FIX 2 — the second-gate coercion (`isTriggerEnabled`) is untested on its security-relevant edge
`src/grow/trigger.mjs:68-72`
The behavior is correct by reading — string `"false"`/`"no"`/`"0"`/absent → `false`;
only boolean `true` or `"true"`/`"yes"`/`"1"` → `true`, so an un-coerced
`--field enabled=false` string can never read truthy — but no test exercises the STRING
path. Every fire/enable test uses a boolean `enabled` that round-trips through YAML as a
boolean, so the `ENABLED_TRUE` set (the code that actually stops a string `"false"`
from firing) has zero coverage. The `validateNote enabled boolean-ish` test only
covers the write-door type check, not the fire-time read.
Fix: assert `isTriggerEnabled({enabled:'false'}) === false`,
`({enabled:'true'}) === true`, `({}) === false`, and add a `fireTrigger` case on a note
carrying string `enabled:'false'` that refuses.

### NIT 1 — five independent copies of the where-op list; nothing pins them equal
`validate.mjs:24,43` · `grow/trigger.mjs:78` · `cli/args.mjs:32` · `notes/index.mjs:227`
`parseClauseString` (preview) and `parseWhere` (`zz query --where`) are byte-identical
today, and both feed the same `eavCondition`, so the blast-radius can't diverge from a
real query NOW. But the op sets are mirrored by hand for acyclicity with no test pinning
them equal — add a contains-op (`~`) to `parseWhere`/`EAV_OPS` and forget the trigger
copy and the preview silently drops those clauses (under-count), mitigated only because
`validate` would also reject the unknown op at the write door.
Fix: a pin-test asserting the four op sets are equal, or export one shared constant.

### NIT 2 — a note-change string where-clause with an empty value passes validation
`src/notes/validate.mjs:41-46`
`wellFormedWhereClause`'s string branch checks only `indexOf(op) > 0`, so `'tier>='`
validates and normalizes to `{op:'>=', value:''}`. Harmless (operator/review-approved;
matches lexically against `''`) but sloppy for a shape gate.
Fix: require the operator to leave a non-empty value —
`at > 0 && at + op.length < c.length`.

### NIT 3 — cron `expr` is shape-only; semantic nonsense passes
`src/notes/validate.mjs:CRON_FIELD_RE`
`'99 99 99 99 99'` passes `isParseableCronExpr`. Documented as intentional (local never
fires cron; §I.2 B4), and confirmed correct as a local boundary — flagged only so the
DEFERRED hosted scheduler adds real range validation before it fires anything.

---

## The seven scrutiny points, answered

1. **The gate holds for agents.** PASS. `fire`/`enable`/`disable` are `permission:write,
   agentInvokable:false`, none is a namespace root, so `writeVerbPaths` includes all
   three and `gateWriteVerbPattern` emits `trigger\s+(fire|enable|disable)`. The test at
   `trigger-cli.test.mjs:812` exercises the real generated regex (matches the three
   writes, rejects `list`/`show`) — denial by mechanism, not by asserting a flag. An
   agent cannot start a run it couldn't start directly (the same regex denies
   `zz run start`), cannot enable a trigger it staged (enable is gated; a proposed
   trigger lands `enabled:false`), and `stage → review approve` is the only agent path
   (test: nothing lands until approve; a malformed proposal is refused AT review). Caveat:
   enforcement is the stored-pattern gate — see SHOULD-FIX 1 for the upgrade/root-mode
   staleness.

2. **The enable second-gate.** PASS (behavior). `fireTrigger` refuses when
   `!isTriggerEnabled && !force` (`trigger.mjs:191`). Absent `enabled` reads FALSE (safe
   default off); string `"false"` reads FALSE (no default-enabled coercion bug);
   `--force` is only reachable through the gated `fire` verb (operator-only). No path
   fires a disabled trigger (no note-change auto-fire, no coercion truthiness leak). The
   only gap is coverage — SHOULD-FIX 2.

3. **Fire semantics + authority.** PASS. `fireTrigger → startRun(…, actor='operator')`
   which pins the workflow generation, refuses a non-workflow target with the identical
   `run start` error (test-proven equal wording), and requires operator — no elevation.
   `inputs` are safe: `runGated` builds `env['ZZ_'+k]=String(v)` and calls
   `spawnSync(cmd, args, {env})` with NO shell, so `MATCHED_SAMPLE`
   (`"actions:lead-1,actions:lead-2"`) and any trigger input are inert env VALUES, never
   a command fragment; the `ZZ_` prefix means an input can't overwrite `PATH`/secrets.
   `MATCHED_*` are merged AFTER trigger inputs so they can't be spoofed; the run's
   `IDEMPOTENCY_KEY` is merged after that so a trigger input can't override it. Matched
   context is note ADDRESSES, not contents — no secret leakage into `runs.jsonl`.

4. **Blast-radius honesty.** PASS. `triggerMatches` uses `count(home, filters)` with the
   full module/type/where filters and NO limit (test: count=8 while sample=3), so it
   cannot under-count; `count` and `search` share `plan()`, so the preview applies the
   exact EAV/FTS semantics a real query does. `parseClauseString` is identical to
   `cli/args.mjs parseWhere` (same 6 ops, longest-first, `at>0`, same `{key,op,value}`
   shape). Non-note-change kinds return `applicable:false`, never a misleading 0. (Divergence
   risk only under future op drift — NIT 1.)

5. **Validation completeness.** PASS. A malformed trigger cannot reach disk: the
   `type:'trigger'` axis in `validateNote` gates `on` presence, a closed `on.kind`,
   `note-change` event ∈ {create,update} + well-formed where, a parseable cron shape, a
   `module:id` run target, and boolean-ish `enabled` — enforced at the one write door
   (test: `createNote` refuses; review refuses). A where-clause on a nonexistent field is
   a silent no-match at runtime (correct for sparse EAV, not an error). Cron shape-only is
   the documented local boundary (NIT 3).

6. **The deferred boundary is real.** PASS. `grep` confirms the only callers of
   `fireTrigger`/`setTriggerEnabled` are the CLI verbs; `listTriggers` also feeds a
   read-only `zz doctor` warning. No scheduler, daemon tick, `fs.watch`, `setInterval`,
   ingress route, or note-change watcher fires anything. `zz doctor` names declared cron
   triggers as hosted-only, so the gap is discoverable, not silent. Genuinely absent, not
   half-wired.

7. **Tests.** MOSTLY PASS. They cover agent-denial via the real generated pattern,
   disabled-refusal + `--force`, blast-radius against a real filter (string + object
   clause, count-vs-sample), the stage→review agent-proposes path (+ malformed-refused-at-
   review + defaults-off), one-run-not-per-row, and the not-a-workflow parity. The gap:
   the `enabled` STRING coercion — the exact "string 'false' must not read as true" edge
   the brief calls out — is verified only by reading (SHOULD-FIX 2).

---

## Bottom line

Ship after the two SHOULD-FIXes. The trigger implementation is a faithful, authority-
neutral wrapper over the durable runner: it correctly participates in the generated
moat, the second gate is honest, blast-radius is accurate, and nothing fires unattended
— exactly the safety-floor-first scope §I rung 4 set. SHOULD-FIX 1 (gate re-arm on
upgrade) is systemic and worth a focused pass since triggers make it consequential;
SHOULD-FIX 2 (coercion test) is small and belongs with this commit because the second
gate is the whole point.

---

## Fixed

All four findings addressed, CLI-side (`src/`, `tests/`, `docs/` — `web/` untouched),
gated commits, `npm test` green throughout (663 → 679 tests):

| Finding | Commit | What changed |
|---|---|---|
| **SHOULD-FIX 1** — exec-gate staleness / unseeded in root-mode | [`2073fb6`](../../commit/2073fb6) `fix(guardrails): exec-gate reconciles on init, seeds in root-mode too` | `zz init` now RECONCILES `protect-brain-exec`'s `pattern` field to the live `gateWriteVerbPattern()` on every run (not `writeOnce`) — a human's edits to action/tool/reason/body survive, only the generated field converges. Root-mode now seeds `protect-brain-exec` (previously a blanket `protect-brain-*` filter meant to skip only the two `.zuzuu/`-PATH-scoped rules accidentally caught this non-path-scoped one too — a root-mode Project shipped with NO exec-gate rule at all). `zz doctor` gained a check that flags a missing or stale `protect-brain-exec` pattern. Kept the pattern STORED in a note rather than compiling live at gate time — see "the architecture choice" below. 8 new tests. |
| **SHOULD-FIX 2** — `isTriggerEnabled` string-coercion untested | [`1fb61c0`](../../commit/1fb61c0) `test(triggers): cover isTriggerEnabled's string-coercion edge` | No production change (the coercion was already correct). Added direct assertions on the string/boolean/absent matrix (`'false'`/`'no'`/`'0'`/absent → false; `'true'`/`'yes'`/`'1'`/boolean → true) plus a `fireTrigger` refusal against a hand-planted note carrying the literal string `enabled:'false'`. 5 new tests. |
| **NIT 1** — the where-op list hand-mirrored in 5 places | [`081ba99`](../../commit/081ba99) `refactor(where-ops): one canonical WHERE_OPS constant` | `notes/validate.mjs` exports `WHERE_OPS`, the single source (it's already the acyclic schema-authority module both `grow/` and `cli/` import downward from — `TRIGGER_ON_KINDS` was already this shape). `notes/index.mjs`'s `EAV_OPS`, `cli/args.mjs`'s `parseWhere`, and `grow/trigger.mjs`'s `parseClauseString` all import it instead of re-declaring; `validate.mjs`'s own two copies collapse to one. `parseClauseString` is now exported so a test pins it against `parseWhere` directly — both parse every clause (one per op, an ambiguous multi-op string, malformed/edge inputs) IDENTICALLY. No behavior change. 2 new tests. |
| **NIT 2** — an empty-value where-clause passes validation | [`6230d22`](../../commit/6230d22) `fix(validate): reject a value-less trigger where-clause operator` | `wellFormedWhereClause`'s string branch now requires the operator to leave a non-empty value, via a `for` loop that returns on the FIRST matching op (mirroring `parseClauseString`/`parseWhere`'s own control flow) rather than testing each op independently with `.some()` — the naive independent-test version let a two-char operator's one-char prefix (`>=`'s `>`) "rescue" an empty-value match by re-scanning the same string with the shorter op. An object clause with an explicit empty-string value (`{key,op,value:''}`) is untouched — a deliberate, different case. 1 new test. |
| NIT 3 — cron shape-only validation | *(deferred, as scoped)* | Left as-is — the hosted scheduler's concern, per the review's own note. |

**The SHOULD-FIX 1 architecture choice: stored-and-reconciled, not live-compiled.**
The gate (`src/guardrails/gate.mjs`) is generic over "whatever `type: rule` notes live
in the `instructions`/`guardrails` module" — it has no per-rule-id special case, and
every other seeded rule (`no-root-wipe`, `no-secret-reads`, `confirm-force-push`,
`protect-brain-writes`, `protect-brain-shell`) is a plain user-editable note (a human
can retune action/tool/reason/pattern on any of them, including disabling one
entirely). Compiling `protect-brain-exec`'s pattern LIVE from `gateWriteVerbPattern()`
at gate-eval time would special-case exactly one rule id inside otherwise-generic code,
and would silently override a human's own edit to that one field if they ever had
reason to narrow or widen it by hand. Reconciling instead — `zz init` converges only
the `pattern` field to the live table, leaving everything else on the note exactly as a
human left it — keeps the gate itself generic and respects the existing "rules are
notes" design, while still closing the staleness gap the review found. `zz doctor`'s
new check makes the (now rare, self-healing-on-`zz init`) divergence state visible
either way.

**Is the personal vault (`~/Documents/personal`) currently exposed?** Yes, as of this
audit: it's a root-mode Project seeded before this fix, so it has **no
`protect-brain-exec` rule at all** — an agent shelling a `zz` write verb there (e.g. a
future `zz trigger fire`) is not denied by this specific gate today. The vault itself
was deliberately NOT touched by this change (CLI-only, per the brief). Running `zz
doctor` there will now surface `no protect-brain-exec exec-gate rule — …`, and `zz
init` will seed it (root-mode now ships it, per the fix above) — that reconciliation is
a follow-up action for the vault, not part of this CLI-side fix.
