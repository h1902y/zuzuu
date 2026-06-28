# zuzuu

**Your project directory becomes the coding agent's memory and toolkit — plain markdown notes it queries, runs, and grows from how you actually work, every change human-gated.** Zero dependencies.

```bash
npm install -g @zuzuucodes/cli
zz init && zz host enable        # wrap the agent you already run  (alias: zz enable)
# — or, no agent yet? one command brings a fully-equipped OpenCode —
zz host code                     # (alias: zz code)
```

## Everything is an envelope

One file format underlies the whole system: a **markdown body + YAML frontmatter**, distinguished by `type`. A **note** is one such file — one fact, optionally runnable. A **module** is a goal-shaped folder of notes; a **project** is the `.zuzuu/` home. The hierarchy is **note › module › project**.

You **query** what's true, **act** on what runs, **check** integrity; zuzuu **observes** your sessions and proposes; you **review** every write. Four verbs over plain files.

## This wiki

The **extended user guide** — how-tos, per-host detail, troubleshooting. The repo keeps the canon:

| Where | What |
|---|---|
| [README](https://github.com/h1902y/zuzuu#readme) | front door — what works today |
| [docs/learn/](https://github.com/h1902y/zuzuu/tree/main/docs/learn) | the educative book — the system taught lesson by lesson |
| [docs/LOG.md](https://github.com/h1902y/zuzuu/blob/main/docs/LOG.md) | the build journal (append-only) |
| [docs/DESIGN.md](https://github.com/h1902y/zuzuu/blob/main/docs/DESIGN.md) | strategy & rationale (the *why*) |
| **this wiki** | guides for *using* what's shipped |

> Everything here is shipped **and verified against real sessions** — the project's standing rule. Designed-but-unbuilt things live in the repo docs, not here.

## Pages

- [[Getting Started]] — install → init → your first proposals
- [[Workbench]] — the visual way to run zuzuu (`zz host web`)
- [[Module Standard]] — one envelope, every note and module
- [[Module Home]] — what `zz init` scaffolds and why
- [[Knowledge]] — notes, query-on-demand, the review gate
- [[Guardrails]] — enforced rules on tool calls
- Host guides: [[Claude Code]] · [[Codex]] · [[Gemini CLI]] · [[OpenCode]] · [[pi]]
- [[Troubleshooting]] — `zz doctor` and the usual suspects
- [[Glossary]] — the words zuzuu uses, in plain terms
- [[Roadmap]] — where this is going
