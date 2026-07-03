# Changelog

All notable changes to `@zuzuucodes/cli`. Versioning: the npm publish workflow
releases on a version bump to `main`; each release gets a git tag from here on
(the v0.2→1.7 span predates this file and is untagged — see `docs/LOG.md` for
that history).

## [Unreleased]

## [2.0.0] — 2026-07-03

### Added
- **The SECRETS-DECLARATION model** (§J.3/§J.5, `docs/specs/2026-07-02-polish-
  showcase-experience.md`): a `type: secret` note is a DECLARATION ONLY — `name` (the
  env var) · `scope` (an allowlist of `module:x`/`tool:x`/`module:tool` callers) ·
  `actor` (`operator-only` default, fail-closed | `agent-allowed`) · `resolves_from`
  (`env` default | `secrets-file` | `fly` | `oidc`) · `rotation_note`/`sensitive`
  (default `true`)/`last_used`. **THE enforced invariant**: `notes/validate.mjs`'s
  write door REFUSES a `type: secret` note carrying ANY value-bearing field
  (`value`/`secret`/`key`/`token`/`password`/`credential`, case-insensitive,
  unconditionally) — the value can never be written to a note, through any write
  path (`note create` · `note set` · `review approve` all funnel through
  `notes/repo.mjs`'s one `writeNote`). Declarations live in a dedicated `secrets`
  module (documented convention — §J.3's own framing; the refusal itself is
  per-TYPE, so it holds regardless of placement). `use/secrets.mjs`'s
  `resolveSecret(home, name, {caller, actor})` is the ONE reader of the host
  store — pure, fs-only (no sqlite index dependency): find the declaration → SCOPE
  check (an unlisted caller, including an absent/empty scope, is a resolution ERROR,
  never a value) → ACTOR gate (`operator-only` refuses under an agent actor,
  mirroring the guardrails gate's fail-closed posture) → the host VALUE
  (`resolves_from: env`/`fly` read `process.env`; `secrets-file` reads the
  `.zuzuu/secrets.env` DEV FALLBACK only — §J.5 retires it as the primary mechanism;
  `oidc` honestly refuses to resolve locally — a per-run, host-side lane). `use/
  act.mjs` wires this into a `secrets: [name]` tool's env-building — resolved BEFORE
  the run starts (any failure refuses the WHOLE run, never a partial one) — and
  substitutes the value into the child's env as `ZZ_<NAME>` (the browser-use
  placeholder-injection pattern: an agent-run tool's context/inputs/return value
  only ever see the NAME). `notes/log.mjs`'s `logRun` grows a `secretNames` option
  that extends its redaction set with whatever those names resolved to in
  `process.env`, so a declared secret's value is masked in `runs.jsonl` even under
  an unrelated input key ("redact at the injection site"). A resolved secret's
  `last_used` is touched by `serve/api.mjs`'s `act` wrapper (an operator-lane write
  — `use/` itself never writes the Project, architecture rule 6) — best-effort, and
  naturally a no-op for an agent-actor run (the write moat refuses a non-operator
  commit). New read-only view: `zz secret list [--json]` (name · scope · actor ·
  sensitive · resolves_from · last_used · a ✓/✗/n-a HOST AVAILABILITY probe — never
  the value) · `zz secret show <name>` (metas only, never the value even for a
  non-sensitive declaration) · `zz secret check` (a doctor for secrets — which
  declared secrets are missing from the host, naming the exact set-command to fix
  each). There is no `secret set`/`secret create` verb — creating a declaration
  rides the ordinary `note create`/stage→review lanes (the value-refusal invariant
  means neither can carry a value either), and setting the VALUE is always a
  terminal call (`export`/`fly secrets set`/…), never a zuzuu-owned file. 707 → 763
  tests. See `docs/guide/Secrets.md` for the full model + the host set-commands per
  `resolves_from`.
- **`zz secret declare <name>` — an authoring-ergonomics fix for a SCOPED
  declaration.** `zz note create secrets <id> --type secret --field 'scope=[tool:x]'`
  landed `scope` as the raw STRING `"[tool:x]"`, not a list — the (correct) write-door
  scope validation then refused it — because `--field`'s schema-aware coercion
  (`grow/edit.mjs`'s `coerceForField`) only turns a comma/bracket string into a list
  for a column the module's manifest already declares `multi` (`zz module add-column
  secrets scope multi`), so a scoped secret couldn't be authored from the CLI without
  minting that column first. `secret declare` is operator-lane sugar over the SAME
  `note create` write door (validated · logged · minted; the value-refusal invariant
  is untouched) — `--scope tool:x,module:y` (comma AND/OR repeatable) builds a real
  list itself, sidestepping `--field` entirely, so no module/column ceremony is
  required first. `--actor` (default `operator-only`), `--resolves-from` (default
  `env`), `--rotation`, `--sensitive` (default `true`), `--id` (defaults to a
  slugified `name`), `--force` round out the surface. It has **no value flag at
  all** — the invariant isn't just enforced here, it's structurally unreachable
  from this verb's argument surface. Same relationship `zz module new` has to a
  raw manifest create: authoring sugar over an existing write path, not a new one.
  782 → 786 tests. `docs/guide/Secrets.md`'s authoring section shows the working
  command.
- **The TOOL + TOOLKIT model** (§I.6 MCP-native reading, `docs/specs/2026-07-02-
  polish-showcase-experience.md`): no new entity — a `type: action` note IS a tool,
  the module it lives in IS the toolkit, and a module's typed-column `fields` ARE
  the tool's `inputSchema`. `notes/validate.mjs` grows a `binding: shell | agent |
  mcp` field on action notes (absent = `shell` = today's `run:`, full back-compat)
  with a per-binding write-door invariant (shell needs `run:`; agent needs a
  `prompt:` — or reuses `run:` as one when absent; mcp needs `mcp: {server, tool}`)
  plus an optional `secrets: [name]` declaration (a list of secret NAME strings —
  metadata only; resolution into a run's env is a follow-on build). `zz tool list
  [--json]` / `zz tool show <module:id> [--json]` are the new read-only toolkit/tool
  VIEW — every tool grouped by its toolkit, or one tool's full contract (binding ·
  inputSchema · secrets · the run/prompt/mcp target · a toolkit HITL note derived
  from a REAL behavior, `policy.run.allow`) — the basis for a future real
  `tools/list` MCP endpoint. `use/act.mjs` dispatches by binding: `shell` is the
  unchanged existing path; `mcp` is a clean, explicit stub (no fake success — the
  MCP client is a follow-on build); `agent` returns a structured
  `{needsHost:true}` requirement rather than silently no-opping or headless-
  spawning a host session — ACP (the lane that would carry this) is daemon-only
  today (`web/src/server/acp.ts`, not reachable from the CLI), so a hosted daemon
  is the documented follow-on that actually dispatches an agent-binding tool.
  `use/workflow.mjs`'s `note:` composition steps resolve through the SAME `act()`,
  so a composed workflow can't bypass a tool's binding either. See
  `docs/guide/Tools.md` for the full model and what's stubbed vs. built.

### Fixed
- **A trigger's note-change where-clause rejects a value-less operator** (NIT 2,
  `docs/audits/2026-07-03-triggers-review.md`): a string clause like `'tier>='`
  (almost certainly a forgotten right-hand side, not an intentional empty-string
  match) used to validate and normalize to `{op:'>=', value:''}` — sloppy for a
  shape gate. `notes/validate.mjs`'s `wellFormedWhereClause` now requires the
  operator to leave a non-empty value, mirroring `parseClauseString`/`parseWhere`'s
  own first-match-in-order control flow exactly (not testing each op
  independently, which would let a two-char operator's one-char prefix — `>=`'s
  `>` — "rescue" the same empty-value match by re-scanning with a shorter op). A
  structured object clause with an explicit empty-string value
  (`{key,op,value:''}`) is a different, deliberate case and stays accepted.
- **The `--where` comparison operators are now ONE canonical list** (NIT 1,
  `docs/audits/2026-07-03-triggers-review.md`): `cli/args.mjs`'s `parseWhere`
  (`zz query --where`), `notes/index.mjs`'s `EAV_OPS` (the real query engine),
  `notes/validate.mjs`'s trigger where-clause shape check (twice), and
  `grow/trigger.mjs`'s blast-radius clause parser each hand-mirrored the same 6
  operators with nothing pinning them equal — an op added to one copy and
  forgotten in another would silently under-count the trigger blast-radius
  preview (or reject a clause `zz query --where` accepts). `notes/validate.mjs`
  now exports `WHERE_OPS`, the single source; the other four import it. No
  behavior change (the values and order were already identical); a new test
  pins `parseClauseString` and `parseWhere` to parse every clause identically.
- **`isTriggerEnabled`'s string-coercion edge is now test-covered** (SHOULD-FIX 2,
  `docs/audits/2026-07-03-triggers-review.md`): the second gate's read of `enabled`
  was correct by reading — a raw string `"false"`/`"no"`/`"0"` (the un-coerced shape
  `zz stage --field enabled=false` can land) already read as NOT enabled — but had
  zero direct test coverage; every existing fire/enable test used a real boolean,
  which round-trips through YAML on its own and never exercises the string table.
  No behavior change; added direct assertions on the string/boolean/absent matrix
  plus a `fireTrigger` case against a hand-planted string `enabled:'false'` note.
- **The exec-gate can no longer go stale or ship unseeded** (SHOULD-FIX 1,
  `docs/audits/2026-07-03-triggers-review.md`): the `protect-brain-exec` guardrail
  (denies an agent shelling a `zz`/`zuzuu` WRITE verb — the Bash-bypass hole) stores
  its pattern in a seeded rule note, and `zz init` used to seed it ONCE
  (`writeOnce`) — an EXISTING project's stored pattern froze at first-seed, so a
  write verb added later (e.g. `zz trigger fire`) was never denied there until a
  human noticed. Worse, **root-mode never seeded it at all** (a blanket
  `protect-brain-*` filter meant to skip only the two `.zuzuu/`-PATH-scoped rules
  accidentally caught this non-path-scoped one too) — a root-mode Project (the kind
  the personal vault uses) shipped with NO exec-gate rule, full stop. Fixed two
  ways: `zz init` now RECONCILES `protect-brain-exec`'s `pattern` field (and only
  that field — a human's edits to action/tool/reason/body survive) to the live
  `gateWriteVerbPattern()` on every run, converging a stale install instead of
  freezing it; and root-mode now seeds `protect-brain-exec` like classic mode
  does. `zz doctor` also gained a new check: it flags a missing or stale
  `protect-brain-exec` rule as a warning, so the gap is discoverable without
  reading source. Kept the pattern STORED-in-a-note (not computed live at gate
  time) deliberately — every other guardrail rule is a user-editable note, and
  the gate is generic over "whatever rules live in this module," never
  special-cased per rule id; reconciling the one generated field is the fix that
  respects that architecture.
- **The live-audit fixes (map-first for real)**: the World home renders on cold
  caches and survives project-state flaps (fs-fallback + durable-facts steady +
  the mount-race fix); root-mode projects read as Projects in state/health/
  launcher; "New note" is form-first (never an unapprovable proposal); approve
  failures surface the CLI's precise reason; the brain push follows workspace
  switches and degraded graph reads retry instead of rendering an empty project;
  palette Enter prefers the literal note match.
- **The daemon's overview never used the CLI fast path**: the route expected
  `{modules}` but `zz module overview --json` emits a rows array — every project
  fell through to the degraded frontmatter peek. The route now maps the CLI rows
  (which gained `enabled` + `top`: 3 titles per module from ONE brief cross-module
  search) onto the dashboard DTO.
- **The daemon's peek is root-mode aware**: `resolveHome` sniffs the root
  `project.md` marker, so a root-mode project's modules resolve at the repo root
  (they degraded to an empty dashboard before); staged proposals keep reading from
  `.zuzuu/<module>/staged` in both modes.
- `@agentclientprotocol/sdk` added to the root `optionalDependencies` — the ACP
  lane (the Claude Code default) failed to boot from a bare install without it.
- **Cross-module bare-id relations now resolve to their owner module.** A bare
  relation target (`informs: muscle-group-map`) written from another module used
  to be qualified to the *source* module — a nonexistent address — silently losing
  the backlink and false-flagging `zz check`. The index now builds an id→owner map
  and resolves bare targets: same module first, else the unique owner, else the
  source module (honestly flagged broken). Ambiguous ids (owned by several modules)
  stay source-qualified and flagged.
- `zz module overview` counts rows via one `GROUP BY` instead of a full index
  open + row materialization per module.
- `zz query --limit 0` means 0 again (the CLI layer re-broke the index's fix).
- `zz note set` coercion is schema-aware: a declared column coerces by its
  FieldType; `title`/`status` always stay strings (`note set m id title 5` no
  longer stores a number).
- The corpus signature is computed once per index rebuild, not twice.
- **Composed workflow steps under-budgeted the parent's lock-staleness window**
  (audit S1, `docs/audits/2026-07-03-composition-review.md`): `workflowStaleAfterMs`
  budgeted a `note:` step at its own (usually absent, so default 120s) `timeout:`
  — fine for a leaf action, wrong for a `note:` step whose target is a nested
  WORKFLOW that can legitimately run far longer (its own steps + its own
  compensation phase). Under-budgeting let a concurrent re-invocation see the
  parent's still-live lock as stale and steal it mid-nested-run — the exact
  double-run the lock exists to prevent. A `note:` step with no explicit
  `timeout:` of its own is now budgeted at `MAX_TIMEOUT_S` (600s, the cap) — a
  floor, not a precise estimate; an explicit `timeout:` on a note-ref step is
  still honored.

### Added
- **The Flow projection (web, §I rung 5)** — the workbench's THIRD view of a
  Project, `[Table · Map · Flow]`: a `type: workflow` note's `steps:` render as
  a topological left→right DAG (never force physics — dependency order is
  meaning), glyphed by step kind (run · note-ref · wait, the durable runner's
  own closed vocabulary) with detached compensation nodes (a step's
  `compensate:` renders below it, dashed — the Retool "untangle failure from
  the happy path" pattern) and an irreversible-step lock badge. The
  Executions sidebar lists the workflow's runs (id · status · started ·
  progress), each row carrying a compact per-step colored strip (the
  runs×steps state matrix, Airflow's Grid view, condensed to the sidebar);
  selecting a run overlays its LIVE step state onto the same DAG (idle ·
  running · done · failed · waiting rings; a waiting step's badge switches
  from the definition's static signal to the run's actual `waiting_on`;
  compensation edges light "compensated"/"compensate failed" when the run's
  saga actually fired them). New `GET /api/zuzuu/flow` (every workflow note
  project-wide + its run-count/latest-status, composing the existing unified-
  table read — no new CLI verb); the focused DAG and its runs ride the
  existing single-item and per-module reads. Live updates ride the SAME
  brain-state push (`/ws/zuzuu`) the map's ghost nodes already use — no
  bespoke WS wiring. Reached via the header's three-way toggle (disabled +
  tooltipped "no workflows yet" with none), `>flow` in the palette, or
  selecting a workflow note anywhere (map or table) — it focuses Flow instead
  of the ordinary note/record surface. Read-only this pass: no run-control
  buttons, no canvas editing. 50 new pure-model tests (topo-layer assignment,
  the layout geometry, the run-state→node-style join); docs:
  `docs/guide/Flow-View.md`.
- **The Tier-2 DURABLE RUNNER — "the run is a note" (§I.3/§I.4)**: `zz run
  start <workflow-module:id> [--input k=v …]` reads a `type: workflow` note,
  PINS its active generation (`workflow_generation`), and materializes a
  `type: run` note (a new, dedicated `runs` module — deliberately outside
  `STANDARD_MODULES`) whose `steps` mirror the workflow's DAG at
  pending/attempts:0 — no execution yet. `zz run advance <run-id>` is the
  TICK: it re-reads the pinned generation (`notes/generation.mjs`'s new
  `noteAsOf`, a single-note time-travel read — a live edit to the workflow
  after start never reaches an in-flight run), finds the next step whose
  deps are all done, and executes EXACTLY ONE step through the same gated
  `act()`/`runGated` path `act`/`flow` already use, writing the new state
  back through the one write door. `zz run advance --all` is a bounded
  convenience loop (still sequential ticks, never a daemon) that stops at
  done/waiting/failed. A step is `run:` · `note:` (Tier-0/1 composition,
  reused — including recursing into a nested `type: workflow`) · or
  `wait: {on, timeout?}` — a wait parks the run at `status: waiting,
  waiting_on: <signal>` (a multi-day human step is just a note, visible in
  the table) until `zz run signal <run-id> <name>` or `zz run complete
  <run-id> <step-id>` resolves it; a declared `wait.timeout` is evaluated
  lazily on the next advance (no scheduler this rung). `retry: {max}`
  re-picks a failed step up to max attempts (idempotency_key stays STABLE
  across retries); past max the run fails and the saga compensates its done
  steps in reverse completion order, STOPPING (not skipping) at the first
  `irreversible: true` step. Crash-safety = the note IS the state — a
  re-tick after a crash just re-reads it; semantics are honestly
  AT-LEAST-ONCE, never "exactly-once." `src/notes/validate.mjs`'s workflow
  step invariant is generalized alongside this (id + exactly one of
  run/note/wait, was id+run only) — a pre-existing gap that blocked ANY
  workflow using composition or wait steps from ever landing through the
  write door. 48 new tests (`tests/unit/run.test.mjs` +
  `tests/unit/run-cli.test.mjs`); docs: `docs/guide/Workflows.md`.
- **Settings & observability (web, §G)** — the workbench teaches its own
  substrate: every magic moment is one click from the plain file that
  explains it. A note's detail (`NoteDocument`, so every container gets it
  for free) grows a collapsed **History** group above the footer — the
  module's `log.jsonl` filtered to that note, actor-glyphed (human · agent ·
  migration · init) with the op and its "why" (proposal id, backfill marker,
  rename/merge/refactor/rollback breadcrumb) and a relative time (`ts` is
  honestly `null` on most entries today — rendered as "time not recorded,"
  never invented); the footer's "born here" line opens History and scrolls to
  the note's earliest `create` row. The module wing's GENERATIONS section
  becomes a compact horizontal **generation strip** (gen N · relative mint
  time · from-count, active highlighted); opening a chip shows real
  **"what changed"** (a new `GET .../generation/:from/diff/:to` route + `gen
  diff` daemon-catalog entry — the CLI declares no `io` for that cold verb
  yet, so the module/from/to positionals ride as pre-validated `extra`,
  mirroring `module.items`'s query-flag extra) and a **"roll back to here"**
  button that prints the honest consequence ("lands as gen N+1 — a new
  forward generation") before routing through the EXISTING, already-wired
  rollback path. Every note/module surface grows a quiet **plain-file
  caption** (path + copy button, root-mode aware — `<module>/items/<id>.md`
  vs `.zuzuu/<module>/items/<id>.md`; never a file-opener, since a browser
  page can't reach the local filesystem). Settings gains an **"Under the
  hood"** section naming `log.jsonl` · `generations.json` · `module.md` ·
  `project.md` (one sentence + a guide link each) plus daemon facts (port ·
  Project root · root-mode yes/no — `ProjectState` gains a `rootMode` field).
  New guide page: [Observability](https://github.com/h1902y/zuzuu/wiki/Observability).
- **The run safety floor (CLI, §I rung 3)**: `act`/`flow` runs were the one place
  with no bound — `spawnSync` had no timeout, the guardrails gate was fail-open
  for every actor, run-log inputs went to `runs.jsonl` verbatim, and nothing
  stopped two concurrent runs of the same note. Four fixes, all in
  `use/act.mjs`/`use/workflow.mjs`/`use/run-lock.mjs`/`guardrails/gate.mjs`/
  `notes/log.mjs`: (1) every run/step gets a clamped `timeout:` (default 120s,
  cap 600s; `spawnSync({timeout, killSignal: 'SIGKILL'})`) — a timed-out run
  reports `{timedOut:true, success:false}` and logs the marker, a timed-out
  workflow step triggers the normal saga compensation; (2) the gate now reads
  `ctx.actor` — an unattended `agent` actor fails **CLOSED** on a malformed
  rule, an engine error, or an `ask` verdict (nobody is present to answer it),
  while an interactive `operator` keeps the original fail-open, ask-passes
  contract; (3) `logRun` redacts a COPY of `inputs` before writing — any
  secret-shaped key (`/key|token|secret|password|passwd|credential|auth/i`)
  or any value matching a secret loaded from `<home>/secrets.env` — the child
  process still gets the real values; (4) a REFUSE-FAST per-note run lock
  (`use/run-lock.mjs`, keyed `module:id` under the XDG cache dir, deliberately
  NOT `metal/fs.mjs`'s block-and-steal `withLock`) denies a second concurrent
  run of the same note and steals only a stale one (older than that run's own
  timeout + a 30s grace — a workflow's steps share one lock for the whole run).
- **Workflow composition (CLI, §I rung 1)**: a `flow` step now takes `note:
  <module:id>` instead of an inline `run:` string — a step is one or the
  other, never both, validated up front. A `note:` target resolves at run
  time through the SAME path a standalone call would take: a leaf runnable
  note goes through `act()` itself (its own gate, timeout, run-lock, and
  `logRun`); a `type: workflow` note **recurses** into `runWorkflow`, so
  workflows compose workflows across the graph. Both shapes stay Tier-0/1
  invocations (§I.3) — no new execution primitive, only reuse. A visited-set
  of `module:id` addresses (every workflow on the current call stack)
  refuses a direct or transitive cycle BEFORE any lock is touched
  (`workflow cycle: a→b→a`), so a self-reference fails as a named cycle
  instead of deadlocking on its own lock; `MAX_COMPOSITION_DEPTH` (20)
  backstops a long acyclic chain the visited-set alone can't catch. The
  composed call always carries the PARENT's `actor` — never silently
  `operator` — so an agent-run composed workflow keeps the safety floor's
  fail-closed gate posture at every nesting level. A composed target
  acquires its OWN run-lock (refused if it's independently running
  elsewhere); the parent's own lock, acquired once for the whole run, is
  never re-touched. On failure, a referenced workflow runs its OWN saga to
  completion — synchronously, compensations included — BEFORE the failure
  surfaces to the parent as that one step's failure, so a deep composed
  failure unwinds inner-saga-first, outer-saga-last. Every composed run's
  `runs.jsonl` entry gains an optional `via: <module:id>` marker (the
  IMMEDIATE parent, absent on a non-composed run) — the seam the
  runs-miner (§I rung 2) will use to attribute a composed failure to the
  workflow that triggered it. 25 new tests
  (`tests/unit/workflow-composition.test.mjs`).
- **The field-config panel (web, §H.5)** — Airtable's edit-field, made zuzuu:
  an anchored popover (never a modal) from a column header's caret ("Edit
  column") or the Grid toolbar's "+ column" (single-module scope; Everything
  has no single home for one module's column). Maps `FieldDef` one-to-one:
  label + the immutable name (rename is a refactor, never offered here), a
  type picker (the 8 types) plus an orthogonal ƒ-computed toggle with a
  formula input (`dateAdd(a,b)` today), select/multi's options editor with
  stable-hue pill previews, date's ISO-storage teaching line + "default to
  current date" (the `default: now` sentinel), required with the honest
  consequence note (`zz module backfill` heals existing rows, not wired from
  the panel this pass), a static default, and description (now a header
  tooltip + on the module wing's new **Schema/COLUMNS** card, alongside ƒ
  formulas). Save shows "saves as generation N+1 — rollback-able" and shells
  `module add-column`/`alter-column` through the daemon catalog (two new
  routes, `POST/PATCH .../column[/:name]`); the CLI verbs gained `io` catalog
  metadata + a `flag()` boolean coercion fix (`--required false` previously
  couldn't turn the flag off) + a fix where `alter-column` silently dropped a
  column's `computed` formula on any unrelated edit.
- **The zuzuu-native table (web, §H)**: the grid rebuilt on the envelope's own
  doctrines — identity is the id (never a blank first cell), one elastic
  Attributes cell for heterogeneous rows (clickable chips join the filter),
  field-type glyphs in every header, lifecycle-toned status pills, and row
  expansion into `NoteDocument` (§H.6 — the SAME detail component the Record
  stage and the omnibar's detail pane now render too, replacing three bespoke
  layouts with one). **Filtering is one grammar, three entry points**: the
  typed input parses free text (FTS, live) vs `key<op>value`/`#tag` (a
  dismissible where clause on Enter); clicking an Attributes chip or a
  module/type/status facet writes the identical state; the anchored
  `[Filter]`/`[Group]`/`[Sort]` builder panels (Airtable's grid language,
  adopted — never a modal) write it too. **Group-by** collapses rows into
  sections with counts and a per-numeric-column Σ, client-side over the loaded
  page (no daemon route serves `--group-by` through `module items` yet — a
  noted follow-up); the **footer** always shows the row count. **Selection is
  context, the omnibar is the verb** (§H.3.4): hover a row's checkbox or press
  `x`; a live selection surfaces a "Selection" group at the top of ⌘K — export
  as CSV (instant) or delete (a proposal, looping the existing per-row
  stage-delete — no single batch generation yet, a noted gap).
- **The envelope floor**: `title · module · type · status` are never null on a
  landed note — filled at the write boundary (status → `active`, title → body
  first line else humanized id), never overwritten; reads stay tolerant.
  `zz validate` surfaces legacy violations; **`zz module backfill [--dry-run]`**
  heals history through the one door (one generation per module, provenance-
  logged, idempotent). Registry digests floor-normalize so subscriptions don't
  false-drift.
- **The global page (the globe)**: the projects launcher retires into the same
  World+greeting grammar as a project — projects are nodes (sized by note count,
  needs-me ring, emoji), a greeting rolls up review across projects, selecting one
  opens its detail and Open dives in. Cross-project stays a roll-up + registry read
  (never a merged Project). Reachable from any project via the footer's Orbit globe.
- **The projection toggle lives in the top app header** — one always-visible,
  active-state-aware [Table · Map] control beside the project breadcrumb
  ("personal › knowledge"), the visible twin of `T` / `>table` / `>map`. The
  per-stage header strip is retired (sessions keep their Terminal·Changes tabs);
  the breadcrumb + New-note + the Orbit globe all live in the top header now. Esc
  from any table/record stage (no overlay open) returns to the World home.
- **The Everything view (web)**: one table over every module — `zz module items
  --all` (+ `GET /api/zuzuu/items`) serves the whole Project through the same
  filter/sort/paginate contract; the workbench renders it with module as a
  COLUMN (island color dot + facet chips), replacing the per-module sidebar
  entries. `T` flips it into the full World with the same lens spotlighted
  across all islands.
- **The World (web)**: **Table⇄Map is one segmented toggle** — `T` flips a module
  between its two projections; `>table`/`>map` from the palette; the grid's filter
  rides both as a persistent **spotlight** on the island (chip row names + clears
  it; filter and scroll survive the round trip); diving deep into a single island
  offers to **crystallize** it into its table (never hijacking the zoom).
- **The World (web)**: `[[mention]]`s in the agent's streamed conversation glow their
  notes on the map (bare ids resolve to their unique owner; code blocks don't glow).
- **The World (web)**: the workbench's map surface is now a real two-level force
  world (`client/world/` — module bodies with repulsion/collision/affinity springs
  driving per-note physics), ported from the startpage galaxy: constellation chips
  (drag an island, click a module), dotted boundary rings, semantic-zoom label
  bands, addr-keyed everything. **The moat renders in the map**: pending create
  proposals appear as dashed pulsing ghost nodes orbiting their module; approve →
  the ghost solidifies into a real node (live, via the brain push). Replaces the
  fixed-circle ModuleGraph stub.
- **Competitive frame** in the README: vs agent-harness wrappers (our modules
  graduate) and vs Notion/Airtable/Obsidian/Tana/Anytype (agent-grown ·
  human-gated · git-native · local-first).
- Dedicated `check` integrity tests (was the top coverage risk: newly load-bearing
  as the home's trust signal, previously untested).
- **Query engine v2**: `--where` grows comparison operators (`k>=v`, `k<=v`,
  `k>v`, `k<v`, `k!=v` — numeric operands compare numerically, everything else
  lexicographically, which is exactly right for ISO dates); `--group-by <key>
  [--agg count|sum:f|avg:f|min:f|max:f]` rollups run in SQL; `query` gains
  `--where`/`--status` (previously module-items-only).
- **Saved views as notes**: `zz query --view <m:id>` runs the `query:` map a
  `type: view` note carries (module/text/type/status/where/group-by/agg/limit) —
  views are data: gate-governed, versioned, shareable.
- **Computed columns** (first builtin): a FieldDef may declare
  `computed: dateAdd(<dateField>, <numberField>)` — materialized into the index at
  build time (never written to the note file), so a derived date filters/sorts in
  SQL. With it, "activities whose window covers today" is one query:
  `zz query actions --where 'start_date<=D' --where 'end_date>D'`. The corpus
  signature now includes module manifests, so a schema change rebuilds the index.
- **Module export/import**: `zz module export <k> [--csv]` (lossless rows; RFC-4180
  CSV with JSON cells for lists) · `zz module import <k> --json|--csv <file>` —
  bulk rows through the operator lane's batch create (one generation, all-or-nothing,
  schema-validated, agent-denied).
- **`zz graph [--json] [--props a,b]`** — the whole project as one nodes+links
  document (addr-keyed, degrees computed, optional frontmatter columns riding on
  nodes). The map surface reads this through the daemon (`/api/zuzuu/graph`)
  instead of importing `src/notes/index.mjs` internals.
- **Daemon (web)**: `/api/zuzuu/graph`; operator-lane routes (`POST /module/:key/row`,
  `DELETE /module/:key/row/:id` — direct create/delete via the catalog); and
  **`/ws/zuzuu` brain-state push** — the daemon watches module items, staged
  proposals, and manifests, and the client invalidates on push: an agent staging a
  proposal mid-turn surfaces live ("watch it build").
- The `zz` entry sets `process.exitCode` instead of `process.exit()` — a hard exit
  dropped un-flushed stdout at 64KB on pipes, truncating `zz graph --json` for any
  consumer.
- **The operator lane — direct row CRUD** (Phase 1 of the personal-app roadmap):
  `zz note create <m> <id> --type t [--field k=v …] [--body text] [--force]`,
  `zz note delete <m> <id>`, and `zz note create <m> --batch '<json>'` (many rows,
  ONE transaction, ONE generation, all-or-nothing). Instant for the human building
  their own app; still validated + provenance-logged + minted through the one
  write boundary; **agents are refused** — both in-process (`commit` refuses
  `actor:'agent'`) and at the shell (the generated execution gate denies the new
  verbs automatically: write-permission ∧ not agent-invokable). Schema `default`s
  fill absent columns on create.
- **Schema v1.5**: a FieldDef may carry `default` (fills on create) and `label`
  (the UI display name) — `module add-column/alter-column --default v --label l`.
- **Cross-module search**: `zz query --all [text]` searches the whole project
  (the index primitive always could; the verb's surface forced a per-module loop).
- `--json` on `query`, `note view`, `check`, `validate`, `gen log` — the read
  surface a frontend consumes is now uniformly machine-readable.
- **Atomic note writes**: `writeText` is temp+rename — a crash mid-write can no
  longer truncate a source-of-truth note.
- **Advisory cross-process lock** around the write boundary (`commit`) — the CLI,
  the workbench daemon, and any bridge share one project now; interleaved
  commits/mints from concurrent processes go from likely to rare. Lock lives in
  the out-of-repo cache dir, steals stale (>15s) locks, never deadlocks.
- **The runs-miner (CLI, §I rung 2)** — observe's SIBLING, and the designed
  feedback edge finally wired: `runs.jsonl` has been annotated "observe's
  feedback edge" since the safety floor landed, but nothing ever walked it —
  observe mines session transcripts, never runs. `grow/runs-miner.mjs` closes
  that gap. `mineRuns(home, {module?, sinceTs?})` is a PURE function: it groups
  `runs.jsonl` events (one module, or every module the Project has) by the note
  they ran, computing per-note evidence — total runs, failure count/rate, a
  TRAILING consecutive-failure streak (is it failing *right now*, not "has it
  ever"), timedOut count, first/last seen (honestly `null` when `ts` was never
  recorded — every production call site today). A note is flagged at
  `CONSECUTIVE_FAILURE_THRESHOLD` = 3 (three failures in a row) OR
  `FAILURE_RATE_THRESHOLD` = 0.5 over `FAILURE_RATE_MIN_RUNS` = 4 (≥50% failure
  rate, but only once there's enough runs to trust the signal) — both exported,
  documented constants. `observeRuns(home, opts)` synthesizes and stages ONE
  proposal per flagged note (never one per failed run — §I.2 B2, review
  fatigue is the moat's real enemy) through `grow/stage.mjs`, never a direct
  write. The miner does not diagnose a fix — it isn't an LLM — so the shape it
  stages is deliberately minimal: an `update` proposal setting a tolerated
  custom `health: 'needs-attention'` field (never `status`, a separate
  lifecycle some modules give typed meaning to), carrying the evidence + a
  human-readable rationale for whoever reviews it. `change` stays a FIXED
  value regardless of the evolving evidence numbers, so `stage.mjs`'s own
  content-hash id already collapses a re-run over a still-failing note to the
  same staged row; an explicit pending-proposal guard (scoped to
  `source.producer === 'runs-miner'`) belts-and-suspenders the same
  idempotency without blocking an unrelated proposal on the same note.
  `zz observe-runs [module] [--since <iso>] [--dry-run]` is the CLI door,
  mirroring `observe`'s own row exactly in shape (write-permission +
  agentInvokable, so it stays out of the execution gate's deny set); `--dry-run`
  computes evidence + the candidate proposals without staging anything. 23 new
  tests (`tests/unit/runs-miner.test.mjs` + `tests/unit/cli-observe-runs.test.mjs`).
- **Triggers as notes (§I rung 4)** — automation itself is a gated, versioned
  note, built to the SAFETY-FLOOR-FIRST scope this rung set: the trigger MODEL
  + manual/explicit firing + blast-radius — explicitly NOT an unattended
  scheduler (cron auto-fire + ingress webhooks are hosted-tier, §I.2 B4's
  boundary: a laptop must not fire triggers unattended). `type: trigger`
  frontmatter: `on: {kind: manual|note-change|cron|ingress, …}` + `run:
  <workflow-module:id>` + optional `inputs` + `enabled: bool` (the SECOND
  gate, §I.4 #7 — a trigger can be reviewed-in yet stay off). `notes/
  validate.mjs` gates the shape at the one write door every note passes: a
  known `on.kind`, a `note-change` trigger needs `on.event ∈ create|update`
  and (if present) a well-formed `where` — string `'key<op>value'` (the SAME
  grammar `zz query --where` parses, independently mirrored to keep `notes/`
  acyclic) or `{key,op?,value}` — a `cron` trigger needs a parseable 5-field
  `on.expr` (shape only; semantics are the deferred hosted scheduler's job); a
  malformed `run` target (not `module:id`) is refused too. `grow/trigger.mjs`
  is the runtime engine: `triggerMatches(home, trigger)` is the **blast-radius
  safety affordance** (§I.2 B2 / Apollo's "current matches: N") — for a
  `note-change` trigger, a PURE read reusing the SAME index query path `zz
  query --where` uses (`notes/index.mjs`'s `search`/`count`) to count (+
  sample) how many notes its filter currently matches; any other `on.kind`
  reports `applicable:false` rather than a misleading 0. `zz trigger list
  [--json]` lists every trigger note (any module — not confined to a
  dedicated module, unlike `runs`) with its enabled state + blast-radius
  count; `zz trigger show <m:id>` is one trigger's detail + preview. `zz
  trigger fire <m:id> [--dry-run] [--force]` fires EXPLICITLY, right now:
  resolves the `run:` target and starts exactly ONE durable run via
  `grow/run.mjs`'s `startRun` — the identical gate/timeout/generation-pin a
  manual `zz run start` gets (triggers add NO new execution authority).
  Firing semantics (documented choice): a `note-change` trigger's fire starts
  ONE run carrying the trigger's `inputs` PLUS the matched-note context
  (`MATCHED_COUNT`/`MATCHED_SAMPLE`) — never one run per matching row (a
  batch concern, undesigned this pass); a `cron` trigger fired manually just
  runs its target once (`on.expr` read by nothing local). REFUSES a disabled
  trigger unless `--force`; `--dry-run` computes the same preview (incl.
  blast-radius) without starting anything. Because every fire goes through
  the durable runner, `run:` must resolve to a `type: workflow` note — firing
  at a bare action refuses with the SAME "is not a workflow" error `run
  start` gives a human at that address (a documented limitation, not a
  special-cased unwrap). `zz trigger enable|disable <m:id>` is the second
  gate — a plain scoped note edit (`grow/edit.mjs`'s `patchNote`) through the
  one write door. No `trigger create` verb: a trigger is created exactly
  like any other note (`zz note create … --type trigger`, the operator lane)
  or PROPOSED by an agent via `zz stage` → `zz review approve` (the
  sanctioned channel — `trigger fire`/`enable`/`disable` are
  `agentInvokable:false`, denied to an agent actor by the SAME generated
  gate pattern every other durable write uses; verified: the deny-pattern
  test now covers all three). `zz doctor` names any declared `cron` trigger
  as hosted-only, so the local/hosted boundary stays discoverable rather than
  silent. Deferred (documented in `grow/trigger.mjs`'s header + this entry +
  `docs/guide/Workflows.md`): the unattended cron scheduler, ingress
  webhooks, and note-change auto-firing — all hosted-tier, a later focused
  pass. 39 new tests (`tests/unit/trigger.test.mjs` +
  `tests/unit/trigger-cli.test.mjs` + a `cli-doctor.test.mjs` case); docs:
  `docs/guide/Workflows.md`'s new Triggers section + `docs/MODEL.md`.

## [1.8.0] — unpublished

- **Root-mode**: `zz init --root` makes the repo root itself the Project (a root
  `project.md` with `format: zuzuu/…` is the marker; modules live at the root,
  ephemera stay in `.zuzuu/`).
- **Relation edge metadata**: a relation entry may be `{target, note, cite}` —
  commentary and body-citation anchors ride on the edge; `rename`/`fold` repoint
  object entries too.

## [1.7.0] and earlier

Untagged npm releases; the build journal in `docs/LOG.md` is the authoritative
history for this span.
