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
