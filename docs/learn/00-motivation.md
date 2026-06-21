# 00 · Motivation — why zuzuu exists

> Start here. No code. By the end you know the problem and the bet.

## The problem

You work in a project directory. An AI agent works there too — reads files, runs commands, writes code. Useful. But three things break.

**It forgets.** Every session starts from zero. Conventions, client preferences, the reason you build it this way — gone. You re-explain every time. Nothing compounds.

**Its tools are ad-hoc.** The seven-step thing you do every Friday gets rebuilt from scratch each time, slightly differently, sometimes wrong. There's no kit it can reach for and you can trust.

**Context is expensive and lossy.** The usual fix for forgetting is to stuff everything into the context window. That's slow, costs tokens every turn, and buries the relevant fact in noise so the agent misses it. You can't just give it everything.

These are structural, not bugs in one tool. Memory, toolkit, and attention all work against you.

## The bet

Make the project directory the agent's memory and toolkit. Not a database. Not a SaaS. Plain files in your folder, with a little structure.

It's all one kind of file: a markdown body with a few labeled facts on top (type, tags, links to other files). One idea per file.

- Most files just hold knowledge — a fact, a convention, a preference.
- Some files can also **run** — they carry a script and a statement of what they're allowed to touch. A runbook the agent executes, safely.

That's the key move: a runnable file isn't a different thing. It's a knowledge file that can run itself. "How I build the weekly report" and "build the weekly report" are the same file — one inert, one executable. Knowing and doing aren't separate layers.

The three problems invert:

- **It stops forgetting.** Knowledge is on disk, in your repo, versioned. Still there next session, next month, next machine.
- **Tools stop being ad-hoc.** The Friday report is a file: named, inspectable, reusable, with guardrails on what it can touch.
- **Context stays cheap.** The agent queries the files instead of ingesting them — "find the files tagged client-acme" — and pulls only what it needs. Query on demand, don't swallow the library.

## Why files

We could have built a database or a cloud service. We chose plain files, deliberately:

- **You can read them.** Open the file, see the fact. No opaque store.
- **You own them.** In your repo, on your machine. No lock-in, no account.
- **Git already works.** Versioning, history, rollback, review — for free.
- **They're portable.** A folder moves between machines, branches, and people.

The file structure follows an open standard, so we adopt a convention rather than invent one. You meet it in lesson `02`.

## What makes it yours

As you work, zuzuu watches your sessions — and keeps a record of which files actually got used, run, and recalled. From both, it proposes new files and changes: "you keep doing this; save it as a runnable file?", "this fact came up twice; remember it?"

Nothing is saved without your yes. That one rule — the human approves every change — is the core. Over many sessions the directory fills with your facts and your procedures, gated by your judgment. The system gets opinionated to how you work. That compounding is the point.

## In one sentence

> zuzuu turns your project directory into an agent's memory and toolkit: one kind of file — knowledge that can also run — queried on demand, run safely, and grown by a human-gated loop.

We call that file a **note**. The next page builds the whole model out of it.

---

**Next:** [`01` · The mental model](01-mental-model.md) — the model, built from one unit.
