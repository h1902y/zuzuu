# zuzuu

**Your project directory becomes the coding agent's memory and toolkit — plain markdown notes it queries, runs, and grows from how you actually work, every agent change human-gated.** Zero dependencies.

```bash
npm install -g @zuzuucodes/cli
zz init && zz host enable        # wrap the agent you already run  (alias: zz enable)
# — or, no agent yet? one command brings a fully-equipped OpenCode —
zz host code                     # (alias: zz code)
```

## Everything is an envelope

One file format underlies the whole system: a **markdown body + YAML frontmatter**, distinguished by `type`. A **note** is one such file — one fact, optionally runnable. A **module** is a goal-shaped folder of notes; a **project** is the `.zuzuu/` home. The hierarchy is **note › module › project**.

You **query** what's true, **act** on what runs, **check** integrity; zuzuu **observes** your sessions and proposes; you **review** what it proposes — and create/edit/delete your own rows directly, instantly, no review needed ([[Two Lanes|Two-Lanes]]). Four verbs over plain files, two write lanes.

## This wiki

The **extended user guide** — how-tos, per-host detail, troubleshooting. The repo keeps the canon:

| Where | What |
|---|---|
| [README](https://github.com/h1902y/zuzuu#readme) | front door — what works today |
| [docs/learn/](https://github.com/h1902y/zuzuu/tree/main/docs/learn) | the educative book — the system taught lesson by lesson |
| [docs/LOG.md](https://github.com/h1902y/zuzuu/blob/main/docs/LOG.md) | the build journal (append-only) |
| [docs/DESIGN.md](https://github.com/h1902y/zuzuu/blob/main/docs/DESIGN.md) | strategy & rationale (the *why*) |
| **this wiki** | guides for *using* what's shipped |

**New here?** [[Getting Started]] → [[Modules as Tables|Modules-as-Tables]] (your data as queryable tables) → [[Two Lanes|Two-Lanes]] (why the agent is gated and you aren't) → [[The World|The-World]] (your project as a living map). For a full non-coding walkthrough: [[Personal Vault|Recipe-Personal-Vault]].

> Everything here is shipped **and verified against real sessions** — the project's standing rule. Designed-but-unbuilt things live in the repo docs, not here.

## Pages

<!-- page list — keep in sync with docs/guide/README.md's canonical list and _Sidebar.md -->

**Start here**
- [[Getting Started]] — install → init → your first proposals
- [[Module Standard]] — one envelope, every note and module
- [[Module Home]] — what `zz init` scaffolds and why

**Your data**
- [[Modules as Tables|Modules-as-Tables]] — schema, computed columns, views, import/export
- [[Two Lanes|Two-Lanes]] — instant for you, gated for the agent
- [[Knowledge]] — notes, query-on-demand, the two write lanes
- [[Guardrails]] — enforced rules on tool calls

**Automation & execution**
- [[Tools]] — the toolkit/tool model (MCP-native)
- [[Secrets]] — secret declarations, resolution, redaction
- [[Workflows]] — three execution tiers + the durable runner + triggers

**The visual surface**
- [[The World|The-World]] — your project as a living map
- [[Flow View|Flow-View]] — a workflow's DAG + its runs, live
- [[The Omnibar|Omnibar]] — the one input that runs the workbench
- [[Observability]] — log.jsonl/generations/module.md, explained
- [[Workbench]] — the visual way to run zuzuu (`zz host web`)
- [[Daemon & API|Daemon-API]] — the HTTP/WS surface

**Hosts**
- [[Claude Code]] · [[Codex]] · [[Gemini CLI]] · [[OpenCode]] · [[pi]]

**Recipes**
- [[Personal Vault|Recipe-Personal-Vault]] — a real 277-note non-coding vault

**Reference**
- [[Glossary]] — the words zuzuu uses, in plain terms
- [[Troubleshooting]] — `zz doctor` and the usual suspects
- [[Roadmap]] — where this is going

**Project**
- [[Decision Log]] — the committed-decisions list
- [[Inspiration Log]] — prior art, honestly scoped
