# `src/` — the zuzuu core, filed by concept

This is the whole product: ~3.8k lines, zero runtime dependencies (`node:*` only). It's small on purpose — **a first-time reader can read all of it.** The directories are named for the **mental model**, not for architectural layers, so the code reads the way the system is taught. This page is the map; the [learn book](../docs/learn/) (mirrored to the GitHub wiki) is the narrated tour — each concept below links to its lesson.

## The one idea

**Everything is an envelope** — a markdown body + YAML frontmatter, distinguished by `type`. A **note** (one fact, optionally runnable) and a **module** manifest are the same shape. The data hierarchy is **note › module › Project** (the `.zuzuu/` home). You **use** the Project (query · act · check); zuzuu **observes** and the **loop** grows it; you **review** every write. Plain files, human-gated.

## The directories

```
src/
  notes/       the substrate — what a note IS, where it lives, how you address it
  use/         USE the Project — read · run · inspect
  grow/        GROW the Project — the compounding engine, every write human-gated
  guardrails/  what the agent must NOT do — enforced
  hosts/       OBSERVE a host (Design B: re-parse, never drive)
  sessions/    (surface) the session surface's git plumbing — session ≡ git branch
  cli/         the zz veneer + lifecycle
  serve/       compose · expose · ground
```

| dir | what it holds | lesson (wiki) |
|---|---|---|
| [`notes/`](notes/) | `note` (the atom) · `store` · `index` · `module` · `toon` — the **note › module › project** substrate | [02](../docs/learn/02-the-seed-in-one-file.md) · [03](../docs/learn/03-how-a-note-becomes-queryable.md) |
| [`use/`](use/) | `query` · `act` · `check` — read / run / inspect | [03](../docs/learn/03-how-a-note-becomes-queryable.md) · [04](../docs/learn/04-how-an-act-runs-safely.md) |
| [`grow/`](grow/) | `observe` · `propose` · `review` · `evolve` — the four loop verbs (the durable artifacts `generation`/`log` live in `notes/`) | [05](../docs/learn/05-how-the-system-grows.md) · [06](../docs/learn/06-observing-a-host.md) |
| [`guardrails/`](guardrails/) | `gate` — the enforced `PreToolUse` check | [04](../docs/learn/04-how-an-act-runs-safely.md) |
| [`hosts/`](hosts/) | per-host adapters + `capture` · `signals` · `hook` (Design B) | [06](../docs/learn/06-observing-a-host.md) |
| [`sessions/`](sessions/) | *(a Layer-3 **surface**, not a lifecycle stage)* the git-branch engine — `session-git` (lifecycle) · `session-worktree` (concurrency) · `git` (plumbing) · `labels` | [08](../docs/learn/08-the-cull.md) |
| [`cli/`](cli/) | the `zz` router + `init` · `enable` · `doctor` · `code` · `web` · `session` | [07](../docs/learn/07-the-cli-veneer.md) |
| [`serve/`](serve/) | `api` (the façade) · `registry` (capability dispatch) · `wire` (registerAll) · `digest` | — |

> The eight dirs span the ontology's layers — they are **not** all "the lifecycle": `notes/` is **Data**; `use/` · `grow/` · `guardrails/` · `hosts/` are the **loop + reading**; `cli/` · `serve/` · `sessions/` are **surfaces**. See [`docs/ONTOLOGY.md`](../docs/ONTOLOGY.md).

## The one rule that replaced strict layering

The code used to be filed by a strict dependency layer (`kernel ← capabilities ← …`). Re-filing by concept relaxed that into a plain DAG (no cycles) with **one invariant worth more than the layer diagram**:

> **Only `grow/` (review→evolve) writes the Project's *notes + generations* — and only through `review` (the gate). `use/` reads + runs; a run appends to the *log* (Data), never the notes.**

That's the whole safety story in a sentence: every change to your notes passes the human gate in `grow/review.mjs`; nothing else mutates the Project.

## How to read the whole thing

1. **`notes/note.mjs`** — the atom (the envelope). Then `store`, `index`.
2. **`use/`** — what you *do* with the Project (query/act/check).
3. **`grow/`** — how it *grows* (observe → propose → review → evolve).
4. **`hosts/` + `cli/`** — the edges where the outside world reaches the core; **`serve/`** is the façade that ties it together.

## The rules that keep it readable

One file, one responsibility · ~200-line soft cap · every file opens with a *what · why · how it fits* header · public surface at the top, helpers below · names mirror the book's vocabulary (`note`, `module`, `project`, the verbs) · no import cycles · tests read as behavior. Full rules + rationale: [`docs/learn/reading-the-code.md`](../docs/learn/reading-the-code.md).
