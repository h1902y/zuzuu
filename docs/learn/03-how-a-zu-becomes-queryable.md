# 03 · How a zu becomes queryable

> Lesson `02` showed the file. A folder of files isn't useful if the agent has to *read all of them* to find anything — that's the expensive-context problem from lesson `00`. This page shows how zuzuu makes a directory of markdown **queryable on demand**, so the agent pulls in only what it needs.

The code is `zuzuu/kernel/index.mjs` (the index) and `zuzuu/capabilities/query.mjs` (the verb), both zero-dep.

## The idea: the files are the brain, the index is a cache

You never query the files directly — you query a small database **built from** them. The rule that keeps this safe:

> **The files are canonical. The index is a regenerable cache.** Corrupt or delete it and nothing is lost — it rebuilds from the files. The index never holds a truth the files don't.

That cache is a single SQLite database (`.zuzuu/.index.db`, git-ignored), built with `node:sqlite` — which ships *inside* Node, so this stays zero-dependency. It holds three small tables derived from every zu:

- **`zus`** — one row per file: its `addr` (`module:id`), type, title, status, body.
- **`prop`** — a key/value row per frontmatter field. Because it's generic key/value, a new frontmatter key needs no schema change — it just becomes more rows. (That's the "tolerate unknown keys" rule from lesson `02`, paying off.)
- **`link`** — one row per relation: `(source, type, target)`. This is the graph.

Plus a full-text index (`fts5`) over titles and bodies for free-text search.

## Staleness: how it stays correct without you thinking about it

Every time you query, the index checks a **signature** of the corpus (every file's path + modification time, hashed). If a file changed, it rebuilds before answering. So the index is *always* current, and you never run a "reindex" command — it's automatic and invisible. Building 5,000 zus takes ~150ms; querying them, ~13ms. (The whole rebuild runs in one database transaction — without that it'd be 60× slower, the kind of detail that decides whether "query on demand" is actually usable.)

## The three ways to query

`kernel/index.mjs` exposes exactly what the `query` verb needs:

```bash
zz query blue                      # free-text search (FTS5)
zz query knowledge --type action   # filter by module / type / tag
zz query --from actions:build --depth 2   # walk relations, up to N hops
zz query --tag client-acme --dry-run      # just a count, before materializing
```

- **Search + filter** is plain SQL over `zus`/`prop`/`fts`.
- **Walking relations** is a *recursive* query over `link` — "give me everything this zu relates to, up to 2 hops out." This is the graph query, and SQLite does it natively (no graph database, no dependency).
- **`--dry-run`** returns a count without loading the rows — the agent's lever for "how big is this before I ask for it."

## Why this is context-frugal — twice

This is the heart of the bet from lesson `00`, and it pays off in two places at once:

1. **The agent queries instead of ingesting.** It doesn't load 500 notes into its context to find one fact — it runs `zz query` and gets back the few that match. The corpus can be huge; the context stays small.
2. **The answer itself is token-dense.** Query output is **TOON**, not JSON — a compact tabular format (`kernel/toon.mjs`):
   ```
   zus[2]{addr,type,title,status}:
     knowledge:acme-style,knowledge,Acme prefers minimal blue decks,active
     actions:build-report,action,Build the report,active
   help[]: query <text> --full · query --from <addr> --depth 2
   ```
   That's ~40% fewer tokens than the equivalent JSON. And it's **brief by default** — id, type, title, status, but *not* the body. The agent sees what exists cheaply, then asks for `--full` only on the one it actually wants. The `help[]` line nudges the next step.

The shape — *brief by default, dense output, fetch the body on demand* — is the same instinct as the whole system: don't hand the agent more than it needs to take the next step.

## What you can build on it

Two capabilities fall out of this index almost for free, and you'll meet them later:

- **`check`** (integrity) — the `link` table makes broken relations a one-line query: a target that isn't a known zu. So "the graph is best-effort" becomes "divergence is *queryable*," not a hidden landmine.
- **`enhance`** — when zuzuu mines what *worked*, it queries this same index for what's used and how things relate.

The index is the quiet workhorse: one regenerable cache that turns a folder of plain files into a brain you can interrogate in milliseconds, without a database server and without a dependency.

---

**Next:** `04` · How an act runs safely — the containment tiers and the `policy` block. *(Written when `act` ships.)*
