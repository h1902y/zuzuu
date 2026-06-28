# The Workbench (`zz host web`)

The visual way to run zuzuu — a local browser app over your project and its `.zuzuu/` home. **Nothing leaves your machine**: a localhost daemon (token-gated) serves the UI; every note mutation goes through the `zz` CLI itself (one gate, one source of truth).

```bash
zz host web   # the bundled workbench — ships with the CLI; launches and prints the URL  (alias: zz web)
```

## The shell

`zz host web` opens on the **Projects Home** — a launcher listing every project zuzuu knows, each with its health at a glance (notes · tables · pending review · last activity). Open one (or add a folder), and you land in the **per-project shell**: a calm three-region frame —

- a **nav** rail — your sessions (work) and your modules-as-tables (the brain);
- the **stage** — the active surface: a session terminal, a module **grid**, or a note **record**;
- a **wing** — the contextual side panel: the record form, the schema/generations, or the live **review queue**;

— over a footer **ribbon** that keeps the gate in view (● live · ◷ N pending · press **R** to review). It's a **database-style admin over your Project**, not an IDE: you read and edit notes through typed forms, not by hand-editing markdown, and a session terminal is one surface among many.

**No zuzuu home in that folder yet?** Opening it runs the setup for you — `zz init` then `zz host enable` — and drops you into the shell. OpenCode is always available as a host (it launches `zz host code`, which installs it on demand).

## The review ceremony

Pending proposals, ranked, one card at a time — the change, its evidence, the score, the miner's rationale. **Approve / Reject (with a reason) / Skip.** Approvals apply through the CLI gate; each approval writes the note + **mints a generation**. Rejections archive with your reason. The same ceremony opens from the ribbon's pending chip or by pressing **R** anywhere — live in a session's wing, or as a batch from a module. Mirrors `zz review`.

## Modules are tables (the grid)

Drill into a module and you get a **spreadsheet-style grid** — one row per note, columns for its fields. It's not read-only: you can **create, edit, delete, and deprecate** rows right in the grid, and **relate / unrelate** notes to draw (or cut) the links between them. Every one of those edits lands the same way an approval does — as a **reviewable proposal** at the gate, never a silent write — so the grid is a comfortable front-end to the exact same human-gated loop.

If a module declares a **schema** (a typed-column `fields` block in its `module.md`), the grid renders proper typed inputs — **select** (from a fixed option list), **date**, **number**, **link**, text — and a write that breaks the schema (wrong type, a missing required field) is **rejected at the review gate** before it can land. Modules without a schema stay **schemaless and flexible** — any column goes. From the CLI: `zz module schema <m>` views a module's columns, and `zz module add-column / alter-column / drop-column` evolve them.

## Sessions are branches (invisible git)

Every agent session runs on its own `zz/session-<id>` branch — created when the session opens, checkpointed after every turn (secret files are never swept in). When it ends, the branch is **held for review, not auto-merged**: ending a session pops the **close card** with the session's diff, and you choose **Merge** (squash it back as one clean `session:` commit on main) or **Discard** — symmetric with the brain's review gate, so nothing lands without your yes. You never touch git: one main, one working branch. An interrupted session is recovered the same way (**Continue / Merge / Discard**). CLI: `zz session status|land|resume|drop` (`land` takes an optional `<id>` when several sessions are held; the older `merge|continue|discard` still work). Conflicts are never auto-resolved — **Resolve** opens a shell at the held worktree for your hands — and nothing is ever pushed. *(Prefer the old land-on-exit behavior? Set `"autoMerge": true` in `.zuzuu/agent.json` per project.)*

## Run several agents at once

Each session gets **its own git worktree** (a separate checked-out copy on its session branch, under `.zuzuu/.worktrees/`, git-ignored), so you can run **multiple agents concurrently** without colliding over one working tree — and your main checkout never switches branches. On exit a worktree session is **held** (its close card surfaces the diff); merges happen at the gate, serialized on the main tree, and a conflict leaves that worktree in place. `zz doctor` surfaces a worktree left by a crashed session. CLI: `zz session worktree list|open|close|discard`.

## Changes & replay

- **What changed** — every session has a *Changes* view: the files it touched, with per-file diffs.
- **Replay** — a saved `.cast` recording plays back with a seekable scrubber and **per-command chapter markers** (from the shell-integration's command marks).

## Requirements & notes

- One install: `npm i -g @zuzuucodes/cli` includes the workbench (its runtime deps are `optionalDependencies` — a failed native build degrades the workbench, never the CLI; `--omit=optional` skips it). The daemon refuses to reimplement note writes — mutations always go through the CLI.
- Node ≥ 22. The daemon binds localhost only, with a per-launch token. Direct entry: the `zuzuu-web <project-dir>` binary also ships with the CLI.
- The UI ships a warm light **and** dark theme (toggle in the header).
