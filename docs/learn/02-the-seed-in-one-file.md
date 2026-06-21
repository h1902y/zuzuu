# 02 · The seed in one file

> Lesson `01` said everything is a **note** — one file, knowledge that can also run. This page reads a real one, line by line, inert then runnable. After it you've seen the whole storage format: there is nothing else to learn.

The code that reads these files is `src/notes/note.mjs` — one parser, ~180 lines, zero dependencies. Learn the file here and you've learned what it parses.

## An inert note — a fact

```markdown
---
type: knowledge
title: Acme prefers minimal blue decks
status: active
created_at: 2026-06-21
tags: [client-acme, design]
relations:
  about: client-acme
  supersedes: client-acme-style-v1
---
Acme's brand lead wants decks minimal: a blue (#0B5FFF) accent on white,
one idea per slide, no clip-art.
```

Read it top to bottom:

- **The `---` fences** split the file into *frontmatter* (the labeled data) and *body* (the prose). That's the envelope.
- **`type: knowledge`** is the only field that's *required*. It says what kind of note this is. Everything else is optional.
- **`title`, `status`, `created_at`, `tags`** are recommended, not required. `status` is lifecycle only — `active`, `archived`, or `deprecated`. (A note never records *run* outcomes in itself; those go to the module's log. The file stays pure definition.)
- **`relations`** are typed, id-based edges — the graph. `about: client-acme` points at another note by its id. Rename a file and the id changes, so a relation can dangle — that's fine: `zz check` surfaces broken links, it's not a crash.
- **The body** is for humans and the agent to read.

One thing is *missing* on purpose: there's no `id` field. **The id is the filename.** This file is `client-acme-style.md`, so its id is `client-acme-style`. One fewer thing to write, one fewer thing to keep in sync.

And one rule does a lot of quiet work: **unknown keys are kept, never rejected.** If a miner later wants to add `confidence: 0.8`, it just writes it — old files don't break, the parser preserves it. That's how the brain learns new vocabulary without a migration.

## A runnable note — an action

Now the same envelope, with three more fields that make it *run*:

```markdown
---
type: action
title: Build the weekly client report deck
status: active
inputs:
  - { name: client, required: true }
run: ./build.sh
policy: {"tier":"contained","filesystem":{"allowWrite":["./reports/"]},"run":{"allow":["pandoc"]}}
---
## What it does
Generates `reports/<client>.pdf` from the metrics CSV, in the client's deck style.
```

The body is still a human-readable runbook. The three new fields are the act:

- **`run`** — what to execute (a script path here; could be an inline one-liner).
- **`inputs`** — its parameters.
- **`policy`** — what it's allowed to touch. This is the containment contract: `filesystem`/`network` are enforced by the sandbox; `run.allow` is the command allowlist. (Lesson `04` is all about this.)

That's the entire difference between a fact and a tool: **three fields.** A knowledge note and an action note are the *same envelope* — one just gained the ability to run itself. That fusion is the thing lesson `01` promised, now concrete.

## How the file is written (the format, precisely)

You'll see two styles for collections, and both parse:

- **Block style** — readable, for things you edit by hand:
  ```
  tags:
    - client-acme
    - design
  relations:
    about: client-acme
  ```
- **Inline JSON** — for anything deeper than one level (like `policy`):
  ```
  policy: {"tier":"contained","filesystem":{"allowWrite":["./"]}}
  ```

Inline JSON *is* valid YAML (flow style), so the files stay standard — but the parser only needs to understand the JSON-compatible subset, which is why it needs no YAML library. Scalars with special characters (a guardrail's regex, say) are JSON-quoted so they round-trip exactly: `pattern: "rm\\s+-rf\\s+/"` comes back byte-for-byte.

## What the kernel does with it

`notes/note.mjs` gives the rest of the system four operations over this file, and nothing else needs to know the format:

- **`parse(text, {id})`** → `{ type, body, …frontmatter }`. Never throws; a malformed file becomes an error in a list, not a crash.
- **`serialize(item)`** → the text back, round-trip exact (the id is dropped — it's the filename).
- **`validate(item, schema?)`** → only `type` is required; a module may add its own required fields, but unknown keys are *always* tolerated.
- **`idFromPath(path)`** → the id, from the filename stem.

That's the seed. Every stored thing in zuzuu — every fact, every rule, every tool, even a module's own manifest — is this one file shape, read by this one parser.

---

**Next:** `03` · How a note becomes queryable — the index, query-on-demand, and why that keeps the agent's context cheap. *(Written when the index + `query` ship.)*
