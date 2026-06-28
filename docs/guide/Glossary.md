# Glossary

The words zuzuu uses, in plain terms — a friendly *view*, not a third definition source. The **precise, canonical definitions** (every load-bearing term + how they relate) live in the repo's model: [The model](https://github.com/h1902y/zuzuu/blob/main/README.md#the-model). For the contributor-facing disambiguator of the overloaded / code-internal terms, see [docs/learn/glossary](https://github.com/h1902y/zuzuu/blob/main/docs/learn/glossary.md).

## The shape of things

- **Envelope** — the one file format: a markdown body + YAML frontmatter, distinguished by its `type`. Everything in zuzuu is an envelope.
- **Note** — one envelope = one fact, optionally runnable. The atom.
- **Module** — a goal-shaped folder of notes, **and a table**: its `module.md` can declare a typed-column **schema** that validates every note in it (a bad write is rejected at the gate); without one it stays schemaless and flexible. The five built-ins: **[[Knowledge]]** (what's true), **Memory** (what happened), **Actions** (what runs), **Instructions** (how to steer), **[[Guardrails]]** (what's enforced).
- **Project** — your `.zuzuu/` [[Module Home|home]] — the whole brain for one repo. The hierarchy is **note › module › project**.

## What you do

- **query** — read what's true (notes, by search + links).
- **act** — run a runnable note, under the guardrails gate.
- **check** — verify the brain's integrity (broken links, orphans, stale).
- **review** — approve or reject a proposed change. **This is the gate** — every write to the brain passes through it.

## What zuzuu does

- **observe** — after your sessions, zuzuu mines the transcript and proposes additions to the brain. It re-reads what the host actually did; it never drives the agent.
- **proposal** — a suggested change waiting at the gate. You **review** it; nothing is written until you approve.
- **generation** — a saved version of one module. Every approval mints one; **rollback** restores a past generation (a pointer flip, not a git revert).

## The pieces around it

- **Host** (or **host agent**) — the coding agent you already run: Claude Code · Codex · Gemini CLI · OpenCode · pi. zuzuu wraps it; the host supplies the intelligence.
- **The gate** — the human-approval step (`review`), and the enforced **[[Guardrails]]** check that can block a tool call before it runs. "The gate is the moat."
- **The home / `.zuzuu/`** — the hidden, git-friendly folder holding your brain. zuzuu finds it from your repo root and never runs `git init` for you.
- **Session** — your work with the agent runs on an invisible git branch; on exit it's **held for review** and squash-merged back only at the merge gate (`zz session land`, or the close card in the workbench), so the brain's history stays clean and nothing lands without your yes. *(`zz session merge` still works as an alias.)*
- **The workbench** — the visual way to run zuzuu in a browser (`zz host web`): a real terminal, a file tree, an editor, and the modules dashboard, all on your own machine. See [[Workbench]].
- **The daemon** — the small local server `zz host web` starts on your machine to power the workbench. It stays on `127.0.0.1` (your computer only).

> Everything here is **shipped and verified** — the wiki's standing rule. Designed-but-unbuilt ideas live in the repo docs, not here.
