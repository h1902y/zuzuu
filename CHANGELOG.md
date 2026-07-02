# Changelog

All notable changes to `@zuzuucodes/cli`. Versioning: the npm publish workflow
releases on a version bump to `main`; each release gets a git tag from here on
(the v0.2→1.7 span predates this file and is untagged — see `docs/LOG.md` for
that history).

## [Unreleased]

### Fixed
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
