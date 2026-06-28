# Getting Started

## Prerequisites
- **Node ≥ 22** (the OpenCode adapter uses the built-in `node:sqlite`).
- For the *wrap-your-own-agent* path: at least one supported coding agent you've used (a session must exist to observe). **Not needed for `zz host code`** — it brings OpenCode.

## Install
```bash
npm install -g @zuzuucodes/cli    # zero dependencies; provides the `zz` (or `zuzuu`) command
```

## Option A — `zz host code` (no agent yet? one command)
```bash
cd your-project
zz host code      # scaffold the home, install + wire OpenCode, launch it  (alias: zz code)
```
`zz host code` ensures the `.zuzuu/` home, **detects OpenCode and offers to install it** on first run (`npm i -g opencode-ai` — a runtime peer, never an npm dependency, so zuzuu stays zero-dep), wires the hooks, and launches the real `opencode` interactively. We **configure + launch, never fork or drive** it. Flags: `[dir]`, `--model M`, `--yes` (skip the install prompt), `-- …` (passthrough to opencode).

## Option B — wrap the agent you already run
```bash
cd your-project
zz init           # scaffold the home (.zuzuu/, hidden like .git) — behaves like git init
zz host enable    # wire the lifecycle hooks + the enforced guardrails gate  (alias: zz enable)
```

`zz init` is a **git-citizen**: it plants `.zuzuu/` at your repo root and never `git init`s its own. `zz host enable` installs the host hook block so the agent's lifecycle events + every tool call route through zuzuu — invisible, fail-open (it can never break your agent).

## Command grammar (two tiers)
The everyday verbs you reach for stay **flat** — `zz query · act · check · review · stage · observe · digest · status · doctor · init`. The structural, less-frequent verbs live under a **noun namespace** so the surface stays tidy:

- `zz note …` — `fold · set · append · rename · retype · view · flow`
- `zz gen …` — `log · list · rollback · diff · mint`
- `zz session …` — `status · land · hold · resume · drop · worktree · label`
- `zz host …` — `enable · disable · hook · code · web`
- `zz registry …` — `subscribe` (and friends)

**Every old name still works.** If you type a renamed verb (e.g. `zz enable`, `zz web`, `zz log`, `zz session merge`) it runs exactly as before and prints a one-line hint pointing at the new name. Nothing you've memorised breaks.

## Use your agent, then grow the brain
Work normally. Then mine what happened into proposals you review:

```bash
zz observe                       # re-read your real sessions → evidence-backed proposals
zz review                        # see them, ranked
zz review approve actions <id>   # the human gate → writes the note + pins a generation
zz act actions <id>              # run the procedure it just learned
```

`zz observe` re-parses the session transcript your agent already wrote (**Design B** — we never drive the host) and mines recurring commands, hot files, and failures into typed proposals routed to the right module. **Nothing enters the brain without your `zz review` approval** — the human gate is the moat.

Other verbs: `zz query <module> [text]` (FTS + graph) · `zz check` (broken links · orphans · stale) · `zz observe` (mine real sessions → proposals) · `zz digest` (the session-start brief) · `zz session` (every session is a git branch) · `zz gen list <m>` / `zz gen rollback <m> <n>` (a module's generation lineage).

## Where your data lives
- `.zuzuu/<module>/items/<id>.md` — your notes, plain text, **tracked** in git.
- `.zuzuu/<module>/staged/` — pending changes awaiting `zz review`; `generations.json` + `log.jsonl` — each module's tracked lineage + mutation journal.
- A **session is a git branch** (`zz/session-*`) — the branch *is* the record, so there's no session index file. Transient session + gate state lives **outside** the repo, in your XDG cache/state dirs; the only git-ignored entries in `.zuzuu/` are `worktrees/` and each module's `runs.jsonl`.
- Nothing leaves your machine; transcripts are read **read-only**.

## Verify
```bash
zz doctor         # node + git + the home + detected hosts + a crashed session's leftover branch
```
