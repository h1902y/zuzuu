# The Workbench (`zz host web`)

The visual way to run zuzuu — a local browser app over your Project. **Nothing leaves your machine**: a localhost daemon (token-gated) serves the UI, and every write shells the `zz` CLI itself — one gate, one source of truth, browser included.

```bash
zz host web   # launches and prints the URL  (alias: zz web)
```

## One screen: the World

There is **one screen**, not a dashboard of pages. `zz host web` opens straight onto [[The World|The-World]] — your Project as a living map — with [[The Omnibar|Omnibar]] (`⌘K`) as the one input for everything you do. A "what needs me" pill (pending proposals + held sessions) sits on the map; the footer holds the Table⇄Map⇄Flow toggle, session dock, and Settings. There is no separate module-cards home page and no side nav — the map, the omnibar, the HUD, and the footer *are* the navigation. (An earlier five-card "Home" landing page existed during development and is retired; if you're picturing that, picture the map instead.)

- **Modules, as tables or as a map** — every module is both an island on the World and a grid of rows; `T` (or the header toggle) flips between them, and [[Flow View|Flow-View]] is the third projection for `type: workflow` notes. The grid itself, its schema-aware columns, filtering, and the field-config panel are covered in [[Modules as Tables|Modules-as-Tables]].
- **Every write goes through one door, two lanes.** Creating, editing, or deleting a row from the grid — or from the omnibar's pre-filled `set`/`create` verbs — is **your** write: it lands instantly, validated and provenance-logged, the same operator lane as the CLI's `zz note create/set/delete`. An agent's proposals are the other lane: they render as **ghost nodes** on the map and `proposal`-badged rows in the omnibar until you approve them. Neither lane is "a reviewable proposal" by default — which one you get depends on who's writing. See [[Two Lanes|Two-Lanes]] for the full model.
- **Review** — pending proposals list under the HUD pill and in the omnibar (`R` opens the full gate overlay); approve/reject/skip mirrors `zz review`. Approving a ghost solidifies it into a real node.

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
- Full detail on the surfaces this page only introduces: [[The World|The-World]] (the map), [[The Omnibar|Omnibar]] (the one input), [[Flow View|Flow-View]] (workflow DAGs), [[Observability]] (log.jsonl/generations/module.md, explained in the UI), [[Daemon & API|Daemon-API]] (the HTTP/WS surface, if you're building on it).
