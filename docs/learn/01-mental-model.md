# 01 · The mental model

> Lesson `00` made the bet. This page gives its shape. After it, every file in the repo reads as a variation on one idea.

One sentence:

> Everything is a **zu**. zus live in a **module**. The module curates itself; you approve.

## The zu — the atom

A zu is one file: a markdown body with labeled data on top (YAML frontmatter). One idea per file.

```markdown
---
type: knowledge
title: Acme prefers minimal blue decks
tags: [client-acme, design]
---
Acme's brand lead wants decks minimal: blue accent on white, one idea per slide.
```

Only `type` is required. Everything else is optional, and unknown fields are tolerated — that rule lets the system learn new vocabulary without breaking old files.

A zu is **pure definition**. It holds content, and optionally an **act**: the inputs, the containment policy, and the implementation (inline or a bundled script) that make it runnable. A zu with an act is a function-as-a-file — knowledge that can run itself. Same file, two jobs.

A zu carries lifecycle state only (active / archived). It never mutates from being run — its outcomes are recorded elsewhere (below). zus link to each other with typed links (`uses`, `supersedes`, `about`). A folder of zus is a graph.

## The module — a goal-shaped, self-curating set of zus

A module is a folder of zus plus one manifest (identity + schema + policy + a human explainer) and an event log.

A module is **goal-shaped**: one module = **one objective it's getting better at**, statable in a single sentence with no "and also." An ecommerce project grows modules for *catalog*, *campaigns*, *fulfillment* — each a bundle of facts + runnable procedures aimed at one outcome. Modules are **not** shaped by capability (there is no "knowledge module" and "actions module" — a zu fuses both, so splitting them would split by layer, the thing to avoid).

That gives the three levels their boundary:

- **project** (`.zuzuu/`) — a standing domain with no finish line. The folder you keep coming back to.
- **module** — one goal, whose zus change together. Born **emergently** when work clusters, not declared upfront.
- **zu** — the atom: one fact, optionally runnable.

A module is **generic** — there is no per-module code. One module differs from another only by the zu `type` it holds, its schema, and its policy defaults.

A module has operations over its zus, and they split in two:

**Mechanical** — deterministic. Given correct parameters, they just run:
- **query** — read/search the zus (on demand, brief by default)
- **create / update / delete** — the write lifecycle

**Agentic** — judgment, not parameters:
- **enhance** — read your conversation and the event log, propose changes (new zus, updates, relations) toward the module's goal
- **approval** — the human sign-off; no write happens without it

The mechanical ones are commands. The agentic ones decide *what* the commands should be, and *whether* to apply them.

## act — the kernel service

Running a zu's act is **not** a module operation. It's a shared kernel service: hand it a runnable zu, it executes the act under containment (a sandbox), captures the result, and records it. Every zu runs the same way, so the mechanism is shared infrastructure — not copied per module.

## The event log — what happened

A zu never records its own outcomes. The module does, in an append-only log (JSONL, schema-bound):
- **mutations** (create / update / delete) — tracked in git, the durable record
- **runs** (each execution) — local telemetry

This log is also what makes `enhance` smart. It reads not just what you *said* (the conversation) but what actually got used, run, and recalled (the log). So it proposes from what *worked*, not just what was mentioned. The loop learns from outcomes.

## The loop

```
observe (session + log) → enhance → propose → approval → write → snapshot
```

A module grows itself from how you work, and every change passes through you. The unit of "how you work" is a **session** — one conversation, which is one git branch. During a session you steer a small stack of objectives; what the session learns flows, at close, into the right module via `enhance`. A snapshot pins the module after each approved change, so any moment rolls back. *(How a session, its git, and its objectives fit together is lesson `05`.)*

## The shape

```
project (.zuzuu/)            a standing domain — a set of modules
└── module                   goal-shaped; a manifest + zus + a log
     ├── manifest             identity · schema · policy · explainer
     ├── zus                  the atoms (content + optional act)
     └── event log            log.jsonl (tracked) · runs.jsonl (local)

   acting across it:
     query · enhance · create/update/delete   ← module operations
     act                                       ← kernel service (runs a zu's act)
     approval                                  ← you, on every write
```

Three responsibilities: **zu declares · act executes · module curates and records.**

## Why it's small

1. **You read it once.** Learn the zu, you've learned every stored thing. Learn the operations, you've learned what the system does.
2. **It extends locally.** A new module or a new kind of zu is a contained change, not a new subsystem.
3. **It composes.** Knowledge and tools are the same file substrate, so they connect for free — an act links to the knowledge it depends on, and "what does this rely on?" is just a query.

---

**Next:** `02` · The seed in one file — read a real zu, inert then runnable, line by line. *(Written when the kernel's zu handling ships.)*
