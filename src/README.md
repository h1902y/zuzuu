# `src/` — the zuzuu core, read like a book

This is the whole product: ~3.8k lines, zero runtime dependencies (`node:*` only). It's small on purpose — **a first-time reader can read all of it.** This page is the map; the [learn book](../docs/learn/) (mirrored to the GitHub wiki) is the narrated tour. Each layer below links to the lesson that walks it.

## The one idea

**Everything is an envelope** — a markdown body + YAML frontmatter, distinguished by `type`. A *zu* (one fact, optionally runnable) and a *module* manifest are the same shape. You **query** what's true, **act** on what runs, **check** integrity; zuzuu **observes** and **enhances**; you **review**. Five verbs over plain files, every write human-gated.

## The layers (read inward-out)

Dependencies point one direction. Inner layers never import outer ones — read inward and you always stand on solid ground.

```
kernel  ←  capabilities  ←  pipelines  ←  hosts / cli  ←  sessions
primitives   verbs over      processes that   the edges:        session =
(envelope,   the kernel      compose verbs    observe a host,   git branch
 index,      (query·act·     (observe,        drive the CLI
 store…)      enhance…)       digest)
```

| layer | what it is | lesson (wiki) |
|---|---|---|
| [`kernel/`](kernel/) | the primitives — the envelope, the index, the store, generations, the session record | [02](../docs/learn/02-the-seed-in-one-file.md) · [03](../docs/learn/03-how-a-zu-becomes-queryable.md) · [05](../docs/learn/05-how-the-system-grows.md) |
| [`capabilities/`](capabilities/) | one file per verb — `query · act · gate · check · enhance · propose · review` | [03](../docs/learn/03-how-a-zu-becomes-queryable.md) · [04](../docs/learn/04-how-an-act-runs-safely.md) · [05](../docs/learn/05-how-the-system-grows.md) |
| [`pipelines/`](pipelines/) | processes that compose verbs — `observe` (mine → propose), `digest` | [06](../docs/learn/06-observing-a-host.md) |
| [`hosts/`](hosts/) | the observe edge — per-host adapters + the lifecycle hook (Design B: re-parse, never drive) | [06](../docs/learn/06-observing-a-host.md) |
| [`cli/`](cli/) | the `zz` veneer — a thin router over `api`, plus `init`/`enable`/`doctor`/… | [07](../docs/learn/07-the-cli-veneer.md) |
| [`sessions/`](sessions/) | session = a git branch — checkpoints, worktrees, the portable manifest | [08](../docs/learn/08-the-cull.md) |
| [`api.mjs`](api.mjs) | the one façade — `open(cwd)` returns a handle bound to a brain; the CLI + web both consume it | — |

## How to read the whole thing

1. **`kernel/item.mjs`** — the atom (the envelope). Then `store.mjs`, `index.mjs`, `capability.mjs`.
2. **`capabilities/`** — each file is a self-contained answer to "what can you do to a zu?"
3. **`pipelines/`** — how verbs compose into the loop.
4. **`hosts/` + `cli/`** — the edges where the outside world reaches the core.

## The rules that keep it readable

One file, one responsibility · ~200-line soft cap · every file opens with a *what · why · how it fits* header · public surface at the top, helpers below · names mirror the book's vocabulary · imports point inward only · tests read as behavior. The full rules + rationale: [`docs/learn/reading-the-code.md`](../docs/learn/reading-the-code.md).
