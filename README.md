# zuzuu

[![ci](https://github.com/h1902y/zuzuu/actions/workflows/ci.yml/badge.svg)](https://github.com/h1902y/zuzuu/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/@zuzuucodes/cli)](https://www.npmjs.com/package/@zuzuucodes/cli) [![node](https://img.shields.io/node/v/@zuzuucodes/cli)](package.json) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**Your project directory becomes the coding agent's memory and toolkit — plain files you query on demand instead of stuffing into context, grown by a human-gated loop that learns from how you actually work.**

The host agent you already run — Claude Code, Codex, Gemini CLI, OpenCode — supplies the *brain* (the reasoning loop + the model). zuzuu gives it an evolving body of **knowledge, memory, actions, and guardrails** that lives as plain markdown in your repo. It **observes** your real sessions, **proposes** what it learned, and — only with your approval — **writes** it back, versioned. We never run a competing agent loop and never drive the host headlessly.

> Install `npm i -g @zuzuucodes/cli` — the command is **`zz`** (or `zuzuu`). Zero runtime dependencies. Published with provenance; releases auto-publish from `main` via GitHub OIDC.

## Everything is an envelope

One file format underlies the whole system: a **markdown body + YAML frontmatter**, distinguished by `type`.

```markdown
---
type: action            # the only required field
title: Rebuild the deck index
run: npm run build:index
tags: [build, cards]
---
Regenerates `dist/index.json` from `src/cards/`. Safe to run anytime.
```

- A **note** is one such file: one fact, optionally runnable (*knowledge that can also run*). Its id is the filename.
- A **module** is a goal-shaped folder of notes; its `module.md` manifest is the same envelope.
- A **project** is the `.zuzuu/` home — a git-citizen that lives *inside* your repo and never `git init`s its own.

You **query** what's true, **act** on what's runnable, **check** integrity; zuzuu **observes** and **enhances**; you **review**. Five verbs over plain files.

## Quickstart

```bash
npm install -g @zuzuucodes/cli

zz init                      # plant this project's empty zuzuu (.zuzuu/) into this repo (git-style, hidden like .git) — only the guardrails safety floor; modules grow on demand
zz enable                    # wire the lifecycle hooks + the enforced guardrails gate

# … now use your coding agent normally. zuzuu watches. Then:

zz observe                   # mine your real sessions → evidence-backed proposals
zz review                    # see what it learned, ranked
zz review approve actions <id>   # the human gate — writes the note + pins a generation
zz act actions <id>          # run the procedure it just learned
```

Other verbs: `zz query <module> [text]` (FTS + graph), `zz check` (broken links · orphans · stale), `zz enhance`, `zz digest` (the session-start brief), `zz session` (every session is a git branch — `status·merge·worktree·manifest·restore`), `zz module <m> generations|rollback`, `zz doctor`, `zz code` (launch OpenCode pre-wired), `zz web` (the visual workbench), `zz migrate` (upgrade a pre-v2 home).

## The loop

```
   observe            enhance           review            write
   ────────  ──────►  ───────  ──────►  ──────  ──────►  ──────────────
   re-read your       mine what          you approve       the note lands +
   real sessions      recurred →         or reject         a generation is
   (never drive)      typed proposals    (the moat)        pinned (rollback-able)
```

Three things make it safe and sticky:

- **The human gate is the moat.** Every write to the zuzuu passes through `zz review`. Automated memory systems poison themselves with confident-but-wrong reflections; the gate is the one defense, and the design keeps it cheap (proposals are batched, ranked, deduped).
- **Observe, don't drive (Design B).** zuzuu re-parses the transcript your host already wrote — it never wraps, intercepts, or steers the agent. That's why it can't corrupt a session, and why adding a host is one adapter file.
- **Immutable, append-only, rollback-able.** A note is immutable until CRUD'd through the gate; the event log is append-only; a generation is a content-addressed snapshot. Roll a module — or the whole zuzuu — back to any pinned moment with a pointer flip, never a `git revert`.

## Borrowed, not invented

| concern | borrowed thesis |
|---|---|
| the file format | **OKF** — `type` the only required field; tolerate + preserve unknown keys |
| running an action safely | **Anthropic's sandbox-runtime** — advisory · contained · sandboxed tiers + a `run.allow` command-axis |
| sessions & snapshots | **git's object model** — session = branch, content-addressed blobs, rollback = move a pointer |
| the query store | **`node:sqlite`** — FTS5 + recursive-CTE graph walks over your markdown, zero-dep |

## Host coverage

zuzuu is host-agnostic by construction (the capture core iterates detected adapters, never a host name). **Five hosts ship, each built against that host's own real on-disk format** — Claude Code (transcript JSONL), Codex (rollout JSONL), Gemini CLI (logs.json), OpenCode (SQLite), pi (session JSONL). `zz observe` mines them all; the lifecycle hook + the `PreToolUse` guardrails gate (it hard-blocks `rm -rf /` and friends, fails open on anything it can't evaluate) are wired for Claude Code, with the same hook path mapping the other hosts' lifecycle events.

| | Claude Code | Codex | Gemini CLI | OpenCode | pi |
|---|---|---|---|---|---|
| observe (mine sessions) | ✅ rich | ✅ rich | ✅ thin¹ | ✅ rich | ✅ rich |

¹ Gemini's on-disk `logs.json` is prompt-only (tool calls live in checkpoint files), so its shell-signal mining is empty — an honest capture gap, not a core difference.

**Prerequisites:** Node ≥ 22. Hacking on zuzuu itself? `git clone https://github.com/h1902y/zuzuu && cd zuzuu && npm link`.

## Repo map

| Path | What |
|---|---|
| [`src/`](src/) + `bin/zuzuu.mjs` | the CLI — `notes · use · loop · guardrails · hosts · sessions · cli · serve` (~3.8k lines, zero-dep, filed by concept) |
| [`web/`](web/) | the visual workbench — a nested project (daemon + React SPA), staged into the npm package at publish |
| [`tests/`](tests/) | hermetic units (`npm test`) + a real-data observe playground (`node tests/playground/run.mjs 5`) |
| [`docs/`](docs/) | [`learn/`](docs/learn/) (the educative book, read in order) · [`LOG.md`](docs/LOG.md) (build journal) · [`DESIGN.md`](docs/DESIGN.md) (strategy/rationale) · [`inspiration/`](docs/inspiration/) (research shelf) |

## How this is built (the method)

**Prove on real data, record in the journal.** Every capability is verified against *real* sessions (never invented fixtures) before it counts; the record lives in [`docs/LOG.md`](docs/LOG.md) (append-only). The core was rebuilt greenfield in 8 rungs — ~13k → ~3.8k lines — each rung green before the next, taught file-by-file in [`docs/learn/`](docs/learn/). Built in public — day-by-day on X ([@h1902y](https://x.com/h1902y)).

## License & status

Personal project, early and changing daily. MIT. Issues/ideas welcome.
