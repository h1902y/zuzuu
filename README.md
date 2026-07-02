# zuzuu

[![ci](https://github.com/h1902y/zuzuu/actions/workflows/ci.yml/badge.svg)](https://github.com/h1902y/zuzuu/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/@zuzuucodes/cli)](https://www.npmjs.com/package/@zuzuucodes/cli) [![node](https://img.shields.io/node/v/@zuzuucodes/cli)](package.json) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**Your project directory becomes the coding agent's memory and toolkit — plain files you query on demand, grown by a human-gated loop that learns from how you actually work.** And because a module is a table and a note is a row, the same directory grows into **your personal application**: queryable, conversable, versioned in git.

The host agent you already run — Claude Code, Codex, Gemini CLI, OpenCode, pi — supplies the *brain*. zuzuu gives it an evolving body of **knowledge, memory, actions, and guardrails** as plain markdown in your repo. It **observes** your real sessions, **proposes** what it learned, and — only with your approval — **writes** it back. You get the direct lane; the agent gets the gate. We never run a competing agent loop and never drive the host headlessly.

```
   you converse ──► the agent stages proposals ──► YOU review ──► the app grows
        │                (its only write path)      (the moat)    (a git commit,
        └───────────── your own edits land directly, instantly ──  rollback-able)
```

> `npm i -g @zuzuucodes/cli` — the command is **`zz`**. Zero runtime dependencies, Node ≥ 22.

## Everything is an envelope

One file format underlies everything: **markdown body + YAML frontmatter**, distinguished by `type` (the only required field). A **note** is one such file — one fact, optionally runnable. A **module** is a goal-shaped folder of notes; its `module.md` is the same envelope. A **Project** is one repo's whole accumulated knowledge. The hierarchy: **note › module › Project** — every load-bearing term is defined in [**the model**](docs/MODEL.md).

## Quickstart

```bash
npm install -g @zuzuucodes/cli

cd your-project
zz init                    # plant the Project (.zuzuu/, git-citizen) — or `zz init --root` for a notes-first repo
zz host enable             # wire your agent's lifecycle hooks + the guardrails gate

# … work with your agent normally. zuzuu watches. Then:
zz observe                 # mine your real sessions → evidence-backed proposals
zz review                  # see what it learned, ranked
zz review approve knowledge <id>   # the human gate — the note lands, a generation mints

zz host web                # the workbench: your project as a living map (the World)
```

Your own rows never wait for a gate:

```bash
zz note create crm acme --type account --field company="Acme Corp"   # lands NOW, validated
zz query crm --where "tier>=2" --group-by stage                      # SQL over markdown
zz module import crm --csv leads.csv                                 # one generation, all-or-nothing
```

## What you get

| | |
|---|---|
| **Modules as tables** | a module is a table, a note is a row; typed columns with `required`/`options`/`default`/`label`, **computed columns** (`dateAdd`) derived at index time — [guide](docs/guide/Modules-as-Tables.md) |
| **Query v2** | FTS + graph walks + `--where k>=v` ranges + `--group-by --agg` rollups + saved **views as notes** (`zz query --view m:id`) — all in SQL, zero-dep `node:sqlite` |
| **Two write lanes** | you: instant `note create/delete/set`, CSV/JSON import. The agent: `stage → review` only, enforced in-process AND at the shell — [why](docs/guide/Two-Lanes.md) |
| **The World** | `zz host web` — your whole project as a force-directed map: module islands, semantic zoom, and **pending proposals as ghost nodes** that solidify when you approve — [guide](docs/guide/The-World.md) |
| **Git-native versions** | every approve/create mints a **generation = a git commit**; `zz gen rollback` is forward motion; sync is `git push` |
| **Observe, don't drive** | zuzuu re-parses the transcript your host already wrote — it never wraps or steers the agent; adding a host is one adapter file |

## Borrowed, not invented

| concern | borrowed thesis |
|---|---|
| the file format | **OKF** — `type` the only required field; tolerate + preserve unknown keys |
| running an action safely | **Anthropic's sandbox-runtime** — advisory · contained · sandboxed tiers + a `run.allow` command-axis |
| sessions & versions | **git's object model** — session = branch, generation = commit, rollback = `git restore` (no parallel blob store) |
| the query store | **`node:sqlite`** — FTS5 + recursive-CTE graph walks over your markdown, rebuilt on demand, zero-dep |

## Where zuzuu sits

- **vs agent-harness wrappers** (static CLAUDE.md/skills bundles): our modules **graduate** — the loop grows them from real sessions, through a human gate. A wrapper configures; zuzuu learns.
- **vs personal databases & PKM** (Notion, Airtable, Obsidian, Tana, Anytype): a module is a table there too — but ours is **agent-grown**, **human-gated** (automated memory poisons itself; the gate is the defense none of them ship), **git-native**, and **local-first, zero-dep, plain markdown**. No server, no lock-in — your table is a folder you can read.

## The safety model, in three lines

- **The human gate is the moat.** Every agent write passes `zz review`. One writer (`grow/commit.mjs`) refuses agent-stamped writes in-process; the generated execution gate denies write verbs at the shell. Structural, not a convention.
- **Your writes are validated, not gated** — schema-checked, provenance-logged, minted; instant.
- **Everything rolls back.** A generation is a git commit; rollback is a new forward generation.

## Host coverage

Five hosts ship, each built against that host's real on-disk format: **Claude Code** (transcript JSONL) · **Codex** (rollout JSONL) · **Gemini CLI** (logs.json, thin¹) · **OpenCode** (SQLite) · **pi** (session JSONL). `zz observe` mines them all; the lifecycle hook + `PreToolUse` guardrails gate are wired for Claude Code.

¹ Gemini's `logs.json` is prompt-only — an honest capture gap, not a core difference.

## Documentation

| | |
|---|---|
| [**docs/README.md**](docs/README.md) | the doc index — start here |
| [**docs/MODEL.md**](docs/MODEL.md) | the canonical model: the four planes, every load-bearing term |
| [**docs/guide/**](docs/guide/) | the user wiki — getting started, tables, lanes, the World, recipes |
| [`docs/LOG.md`](docs/LOG.md) | the build journal (append-only; every capability verified on real sessions) |
| [`docs/DESIGN.md`](docs/DESIGN.md) | strategy & rationale |
| [`CHANGELOG.md`](CHANGELOG.md) | releases |

## Repo map

| Path | What |
|---|---|
| [`src/`](src/) + `bin/zuzuu.mjs` | the CLI — zero-dep; `cli/commands.mjs` is the one command table, `grow/commit.mjs` the one write boundary |
| [`web/`](web/) | the workbench — daemon (Hono, localhost-only, token-auth) + React SPA + the World map; staged into the npm package at publish |
| [`tests/`](tests/) | hermetic units (`npm test`) + a real-data observe playground |

**Built in the open**: every capability proven on real sessions before it counts, recorded in [`docs/LOG.md`](docs/LOG.md); day-by-day on X ([@h1902y](https://x.com/h1902y)). Hacking on zuzuu? `git clone && npm link`.

Personal project, early and changing daily. MIT. Issues/ideas welcome.
