# The Knowledge module

What's TRUE about your project — as **notes you can read in git** and your agent treats as ground truth.

## A note

`.zuzuu/knowledge/items/<id>.md` — text in your voice + typed frontmatter:

```markdown
---
type: knowledge
title: The test suite runs with npm test
tags: [ci, testing]
relations:
  related-to: ci-pipeline
---
Run `npm test` from the repo root. Node ≥ 22.
```

Only `type` is required; unknown keys are preserved. The `id` is the filename. A `relations` map links notes into a typed graph (a bare target like `ci-pipeline` resolves to `knowledge:ci-pipeline`).

## Query on demand — the context-frugal read

A derived `node:sqlite` index (rebuilt from the files, never authoritative — the files are the truth) powers retrieval without loading the corpus into context:

```bash
zz query knowledge "test command"        # full-text search (FTS5), ranked
zz query knowledge --tag ci              # filter by tag/type
zz query knowledge --from knowledge:ci-pipeline --depth 2   # walk the relation graph
zz query knowledge --dry-run             # just the count
```
Output is **TOON** (token-dense, ~40% fewer tokens than JSON) and brief by default; `--full` adds bodies.

## How knowledge gets in — always through you

| Path | What happens |
|---|---|
| `zz observe` | re-reads your real sessions, mines what RECURRED (a hot file, a frequent failure, a recurring command) → evidence-backed **proposals** routed to the right module |
| **`zz review`** | the gate: list proposals, `approve`/`reject`. Approve writes the note + logs the mutation + mints a generation; reject archives. **Nothing enters the brain silently.** |

The gate is the moat: automated memory systems poison themselves with confident-but-wrong reflections — the human gate is the one defense, and the design keeps it cheap (proposals are batched, ranked, and deduped). `zz check` reports health (broken links, orphans, stale/superseded notes).
