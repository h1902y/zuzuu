# Changelog

All notable changes to `@zuzuucodes/cli`. Versioning: the npm publish workflow
releases on a version bump to `main`; each release gets a git tag from here on
(the v0.2→1.7 span predates this file and is untagged — see `docs/LOG.md` for
that history).

## [Unreleased]

### Fixed
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

### Added
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
