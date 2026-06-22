# Reading the code

> How the repo is organized so you can read it end to end — and the rules that keep it that way. Two readers: someone navigating the code for the first time, and someone writing code that has to fit.

The bar: a first-time reader can read the whole repo. Not skim — read. That works only if every file is small, does one thing, and says what it's for. These rules make it true. They're enforced at review, not aspired to.

## The seven rules

**1. One file, one responsibility.** A file does a single, nameable job. If you can't describe it in one sentence without "and," it's two files. (`sessions/` is the example — the git plumbing, the branch policy, the worktree layer, the manifest, and the labels each get their own file.)

**2. Small by default — a soft cap of ~200 lines.** Past it, find the seam. A few files earn an exception (a host adapter, a dense seed table) and justify it in their header. The cap forces rule 1.

**3. Every file opens with a header: *what · why · how it fits*.** One short comment block — what this file is, why it exists, how it connects to its neighbors. The highest-leverage habit for readability. Already common in the project; here it's a rule. Grasp a file's role before reading a line of logic.

**4. Public surface at the top, helpers below.** Exports first, in the order a caller meets them; private helpers underneath. Interface before machinery.

**5. Names mirror the vocabulary.** The code uses the book's words: `note`, `module`, `project`, `query`, `act`, `check`, `review`, `session`. The directories *are* the mental model — `notes/`, `use/`, `grow/`, `guardrails/`, `hosts/`, `sessions/`, `cli/`, `serve/`. If a lesson names a concept, the code spells it the same. No synonyms, no drift.

**6. The brain is written in exactly one place.** The tree is filed by concept (not by a strict dependency layer), so it's a plain DAG — no import cycles. The invariant that matters more than any layer diagram:

```
   use/        grow/                         the rule:
   query        observe → propose             only grow/ writes the brain,
   act          → review → snapshot           and only through review (the gate).
   check        + log (the feedback edge)      use/ only reads and runs.
```

`use/` and the rest never mutate your notes; every change to the brain flows through `grow/review.mjs`. (`act` does append a *run* to the git-ignored `runs.jsonl` via `grow/log` — the append-only feedback record — but that's not the brain.) Read a verb in `use/` and you know it can't rewrite your notes. An import cycle, or a note-write that skips the gate, is a bug — not a shortcut. (`tests/unit/architecture.test.mjs` pins both.)

**7. Tests read as behavior.** A test is named for the behavior it pins, not the function it calls. The suite is executable documentation. When prose and a test disagree, the test wins. Golden values are pasted from real runs, never hand-computed.

## How to read the whole thing

Read by concept, in the order the system works:

1. **`notes/`** — the substrate. Start with `note.mjs` (the atom — the envelope), then `store.mjs`, `index.mjs`. Everything builds on these.
2. **`use/`** — one file per thing you *do* to the brain: `query` (read), `act` (run), `check` (inspect).
3. **`grow/`** — how the brain *grows*, all in one place: `observe → propose → review → snapshot`, with `log` as the feedback edge.
4. **`guardrails/` · `hosts/` · `sessions/`** — what's enforced, how a host is observed, and the session-as-git-branch engine.
5. **`cli/` and `serve/`** — the edges: the `zz` veneer and the `api` façade that ties it together.

Lessons `02`–`08` walk these file by file. This page is the map; those are the tours.

## When you add code

You're adding a page to a book someone will read. Before a pull request:

- Does each new file pass the seven rules?
- Does it keep the DAG acyclic, and route any write to the brain through `review` (rule 6)?
- If it teaches something new about how the system works, does its build rung's lesson in `docs/learn/` get written or updated in the **same** change? (The coupling rule — see the [README](README.md).)

Readable code is a feature here, equal to correctness. A clever file a newcomer can't follow has failed half its job.
